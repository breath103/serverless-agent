import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

type TypeCheckResult =
  | { ok: true }
  | { ok: false; errors: string[] };

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: false,
  noImplicitAny: false,
  noEmit: true,
  noLib: true,
};

const CODE_FILE = "/virtual/code.ts";
const DECLARATIONS_FILE = "/virtual/declarations.d.ts";
const SANDBOX_LIB_FILE = "/virtual/sandbox-lib.d.ts";
const AGENT_FILE_PREFIX = "/virtual/agent/";

// ── Module-level setup (survives across Lambda warm starts) ─────────────────

// Pre-parse the custom sandbox lib once at module load.
// With noLib: true, TypeScript never touches lib.esnext.d.ts or any disk-based libs.
const sandboxLibContent = fs.readFileSync(
  path.join(import.meta.dirname, "declarations", "sandbox-lib.d.ts"),
  "utf-8",
);
const sandboxLibSource = ts.createSourceFile(
  SANDBOX_LIB_FILE,
  sandboxLibContent,
  ts.ScriptTarget.ESNext,
);

// Fully virtual host — no disk I/O at all.
const baseVirtualHost: ts.CompilerHost = {
  getSourceFile: () => undefined,
  getDefaultLibFileName: () => SANDBOX_LIB_FILE,
  writeFile: () => {},
  getCurrentDirectory: () => "/",
  getCanonicalFileName: (f) => f,
  useCaseSensitiveFileNames: () => true,
  getNewLine: () => "\n",
  fileExists: () => false,
  readFile: () => undefined,
};

const HAS_IMPORT = /^import\s/m;

/**
 * Type-checker using a custom minimal lib (sandbox-lib.d.ts) instead of
 * the massive lib.esnext.d.ts chain. All files are virtual — zero disk I/O
 * during check(). The sandbox lib is pre-parsed once at module load.
 *
 * Supports two modes:
 * - Script mode (no imports): checked as module with `export {}` appended
 * - Module mode (has imports): checks as ESNext module, resolves imports from agent files
 */
export class TypeChecker {
  private readonly declarationsSource: ts.SourceFile;
  /** Cache of parsed agent file source files. Invalidated when content changes. */
  private readonly agentFileSourceCache = new Map<string, { content: string; source: ts.SourceFile }>();

  constructor(declarations: string[]) {
    const declarationsContent = declarations.join("\n\n");
    this.declarationsSource = ts.createSourceFile(
      DECLARATIONS_FILE,
      declarationsContent,
      ts.ScriptTarget.ESNext,
    );
  }

  /**
   * Type-check agent code.
   * @param agentFiles Only the files actually imported by this code (pre-resolved).
   */
  check(code: string, agentFiles: Map<string, string> = new Map<string, string>()): TypeCheckResult {
    if (HAS_IMPORT.test(code)) {
      return this.checkModule(code, agentFiles);
    }
    return this.checkScript(code);
  }

  /** Script mode: check as module (export {} forces module scope for top-level await). */
  private checkScript(code: string): TypeCheckResult {
    // Append `export {}` so TypeScript treats this as a module, enabling:
    // - Top-level await (valid in ESNext modules)
    // - interface/type declarations (valid at module scope, not inside IIFE)
    const moduleCode = `${code}\nexport {};`;
    const codeSource = ts.createSourceFile(CODE_FILE, moduleCode, ts.ScriptTarget.ESNext);
    const host = this.buildHost(codeSource, new Map<string, ts.SourceFile>());

    const program = ts.createProgram(
      [SANDBOX_LIB_FILE, DECLARATIONS_FILE, CODE_FILE],
      COMPILER_OPTIONS,
      host,
    );

    return this.collectDiagnostics(program, code);
  }

  /** Module mode: check as ESNext module with import resolution. */
  private checkModule(code: string, agentFiles: Map<string, string>): TypeCheckResult {
    const agentFileSources = this.buildAgentFileSources(agentFiles);
    const codeSource = ts.createSourceFile(CODE_FILE, code, ts.ScriptTarget.ESNext);
    const host = this.buildHost(codeSource, agentFileSources);

    const rootFiles = [
      SANDBOX_LIB_FILE,
      DECLARATIONS_FILE,
      CODE_FILE,
      ...agentFileSources.keys(),
    ];

    const program = ts.createProgram(rootFiles, COMPILER_OPTIONS, host);
    return this.collectDiagnostics(program, code);
  }

  /** Get or parse an agent file source, with content-based cache invalidation. */
  private getAgentFileSource(virtualPath: string, content: string): ts.SourceFile {
    const cached = this.agentFileSourceCache.get(virtualPath);
    if (cached && cached.content === content) return cached.source;

    const source = ts.createSourceFile(virtualPath, content, ts.ScriptTarget.ESNext);
    this.agentFileSourceCache.set(virtualPath, { content, source });
    return source;
  }

  /** Build virtual paths → source files from the resolved agent files. */
  private buildAgentFileSources(agentFiles: Map<string, string>): Map<string, ts.SourceFile> {
    const sources = new Map<string, ts.SourceFile>();
    agentFiles.forEach((content, filePath) => {
      const virtualPath = `${AGENT_FILE_PREFIX}${filePath}`;
      sources.set(virtualPath, this.getAgentFileSource(virtualPath, content));
    });
    return sources;
  }

  private collectDiagnostics(program: ts.Program, originalCode: string): TypeCheckResult {
    const diagnostics = ts.getPreEmitDiagnostics(program)
      .filter((d) => d.file?.fileName === CODE_FILE);

    if (diagnostics.length === 0) {
      return { ok: true };
    }

    const codeLines = originalCode.split("\n");
    const errors = diagnostics.map((d) => {
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      if (d.start === undefined || !d.file) {
        return message;
      }
      const { line } = d.file.getLineAndCharacterOfPosition(d.start);
      const codeLine = codeLines[line];
      if (line < 0 || line >= codeLines.length || !codeLine) {
        return `Line ${line + 1}: ${message}`;
      }
      return `Line ${line + 1}: ${message}\n  | ${codeLine.trimStart()}`;
    });

    return { ok: false, errors };
  }

  private buildHost(codeSource: ts.SourceFile, agentFileSources: Map<string, ts.SourceFile>): ts.CompilerHost {
    const allVirtualPaths = new Set([
      SANDBOX_LIB_FILE,
      DECLARATIONS_FILE,
      CODE_FILE,
      ...agentFileSources.keys(),
    ]);

    return {
      ...baseVirtualHost,
      fileExists: (f) => allVirtualPaths.has(f),
      getSourceFile: (fileName) => {
        if (fileName === CODE_FILE) return codeSource;
        if (fileName === DECLARATIONS_FILE) return this.declarationsSource;
        if (fileName === SANDBOX_LIB_FILE) return sandboxLibSource;
        return agentFileSources.get(fileName);
      },
      resolveModuleNames: (moduleNames) => {
        return moduleNames.map((name): ts.ResolvedModule | undefined => {
          // Resolve bare specifiers like "lib/getMarketSummary" to agent files
          const withExt = name.endsWith(".ts") ? name : `${name}.ts`;
          const virtualPath = `${AGENT_FILE_PREFIX}${withExt}`;
          if (agentFileSources.has(virtualPath)) {
            return { resolvedFileName: virtualPath };
          }
          return undefined;
        });
      },
    };
  }
}
