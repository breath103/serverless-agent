import fs from "node:fs";
import path from "node:path";

/**
 * TypeScript declarations surfaced to the LLM (in the system prompt) AND
 * used by the type-checker to validate generated code.
 *
 * Static part (runtime.d.ts) loaded once at construction. Dynamic part
 * (skill namespaces + per-instance declarations) is appended via
 * constructor argument.
 */
export class TypescriptDeclarations {
  private readonly runtime = fs.readFileSync(
    path.join(import.meta.dirname, "declarations", "runtime.d.ts"),
    "utf-8",
  );

  constructor(private readonly skillDeclarations: string[] = []) {}

  get declarations(): string[] {
    return [this.runtime, ...this.skillDeclarations];
  }
}
