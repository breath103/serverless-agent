import vm from "node:vm";

import type { JsonValue } from "../types/json.js";
import type { TypeChecker } from "./type-checker.js";
import type { SkillCall } from "./types.js";

const TIMEOUT_MS = 30_000;

type CodeExecutorResult =
  | { type: "success"; data: { reads: JsonValue[]; skillCalls: SkillCall[] } }
  | { type: "failure"; data: { reads: JsonValue[]; skillCalls: SkillCall[]; error: string } };

/**
 * Runs agent-generated code in a sandboxed VM.
 *
 * Skills get bound into the sandbox (each one traced — method calls
 * record to `skillCalls` via the proxy in skills.ts before returning).
 * Plus a handful of safe globals (JSON, Date, Math, fetch, etc.).
 */
export class CodeExecutor {
  constructor(private readonly typeChecker: TypeChecker) {}

  async execute(opts: {
    code: string;
    skills: Record<string, object>;
    skillCalls: SkillCall[];
  }): Promise<CodeExecutorResult> {
    const { code, skills, skillCalls } = opts;

    const check = this.typeChecker.check(code);
    if (!check.ok) {
      return {
        type: "failure",
        data: { reads: [], skillCalls, error: `Type errors:\n${check.errors.join("\n")}` },
      };
    }

    const reads: JsonValue[] = [];

    // eslint-disable-next-line @typescript-eslint/no-restricted-types -- sandbox boundary: LLM-generated code passes anything
    function read(value: unknown): void {
      reads.push(JSON.parse(JSON.stringify(value)) as JsonValue);
    }

    const sandbox = {
      ...skills,
      read,
      console,
      JSON,
      Date,
      Math,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      Promise,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      setTimeout,
      fetch,
    };

    const ctx = vm.createContext(sandbox);

    try {
      const executableCode = `(async () => {\n${code}\n})()`;
      const script = new vm.Script(executableCode, { filename: "agent-code.js" });
      const promise = script.runInContext(ctx) as Promise<void>;

      await Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Execution timed out (30s)")), TIMEOUT_MS)),
      ]);

      return { type: "success", data: { reads, skillCalls } };
    } catch (err) {
      return {
        type: "failure",
        data: { reads, skillCalls, error: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}
