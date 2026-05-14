#!/usr/bin/env -S node --import tsx
/**
 * Generate per-skill TypeScript declarations for the agent sandbox.
 * Reads Zod schemas from each skill factory's `.definition` and writes `.d.ts` files
 * that get injected into the LLM system prompt.
 *
 * Run: ./packages/backend/scripts/generate-declarations.ts
 */
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import { skillNamespace } from "../src/agent-runtime/skill-runtimes/define.js";
import { skillFactories } from "../src/agent-runtime/skill-runtimes/index.js";
import { entries } from "../src/lib/object.js";
import type { JsonSchema } from "./lib/json-schema-to-ts.js";
import { jsonSchemaToTs } from "./lib/json-schema-to-ts.js";
const OUT_DIR = path.resolve(import.meta.dirname, "../src/agent-runtime/declarations/skills");

// ── Helpers ──────────────────────────────────────────────────────────────────
interface SkillFactory {
  readonly id: string;
  readonly definition: {
    entities: Record<string, z.ZodType>;
    methods: Record<string, { params?: z.ZodType; returns?: z.ZodType }>;
  };
}

/** Recursively inline all $ref/$defs so schemas are self-contained for comparison. */
function inlineRefs(schema: JsonSchema, defs?: Record<string, JsonSchema>, seen = new Set<string>()): JsonSchema {
  const allDefs: Record<string, JsonSchema | undefined> = { ...defs, ...schema.$defs };

  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop()!;
    if (seen.has(refName)) return {}; // break circular ref
    const def = allDefs[refName];
    if (def) {
      seen.add(refName);
      return inlineRefs(def, allDefs, seen);
    }
    return schema;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema: _, $defs: __, ...rest } = schema;
  const out: JsonSchema = { ...rest };

  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, v ? inlineRefs(v as JsonSchema, allDefs, new Set(seen)) : v]),
    );
  }
  if (out.items) out.items = inlineRefs(out.items, allDefs, new Set(seen));
  if (out.prefixItems) out.prefixItems = (out.prefixItems as JsonSchema[]).map((s) => inlineRefs(s, allDefs, new Set(seen)));
  if (out.oneOf) out.oneOf = out.oneOf.map((s) => inlineRefs(s, allDefs, new Set(seen)));
  if (out.anyOf) out.anyOf = out.anyOf.map((s) => inlineRefs(s, allDefs, new Set(seen)));
  if (out.additionalProperties && typeof out.additionalProperties === "object") {
    out.additionalProperties = inlineRefs(out.additionalProperties, allDefs, new Set(seen));
  }

  return out;
}

function stripDescriptions(schema: JsonSchema): JsonSchema {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { description: _, ...rest } = schema;
  const out: JsonSchema = { ...rest };
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties)
        .filter((entry): entry is [string, JsonSchema] => entry[1] != null)
        .map(([k, v]) => [k, stripDescriptions(v)]),
    );
  }
  if (out.items) out.items = stripDescriptions(out.items);
  if (out.prefixItems) out.prefixItems = (out.prefixItems as JsonSchema[]).map((s) => stripDescriptions(s));
  if (out.oneOf) out.oneOf = out.oneOf.map((s) => stripDescriptions(s));
  if (out.anyOf) out.anyOf = out.anyOf.map((s) => stripDescriptions(s));
  if (out.additionalProperties && typeof out.additionalProperties === "object") {
    out.additionalProperties = stripDescriptions(out.additionalProperties);
  }
  return out;
}

function canonicalize(schema: JsonSchema): string {
  return JSON.stringify(stripDescriptions(inlineRefs(schema)));
}

function generateSkillDeclaration(skill: SkillFactory): string {
  const { entities, methods } = skill.definition;
  const namespace = skillNamespace({ skillId: skill.id });

  const entityJsonSchemas = new Map<string, { schema: JsonSchema; canonical: string }>();
  entries(entities).forEach(([name, zodSchema]) => {
    const schema = z.toJSONSchema(zodSchema, { unrepresentable: "any" }) as JsonSchema;
    entityJsonSchemas.set(name, { schema, canonical: canonicalize(schema) });
  });

  const entityInterfaces = [...entityJsonSchemas.entries()].map(
    ([name, { schema }]) => {
      const isUnion = schema.oneOf ?? schema.anyOf;
      if (isUnion) {
        return `  type ${name} = ${resolveSchema(schema, 1, name)};`;
      }
      // Scalar type alias (non-object entity)
      if (schema.type !== "object" || !schema.properties) {
        const ts = resolveSchema(schema, 1, name);
        const desc = schema.description ? ` // ${schema.description}` : "";
        return `  type ${name} = ${ts};${desc}`;
      }
      return `  interface ${name} ${resolveSchema(schema, 1, name)}`;
    },
  );

  /** Try to match a JSON schema against known entities, returning the TS type string and matched entity schema, or null. */
  function tryResolveEntity(jsonSchema: JsonSchema, exclude?: string): { type: string; schema: JsonSchema } | null {
    const canonical = canonicalize(jsonSchema);
    for (const [name, entity] of entityJsonSchemas) {
      if (name === exclude) continue;
      if (canonical === entity.canonical) return { type: `${namespace}.${name}`, schema: entity.schema };
    }
    return null;
  }

  /** Recursively resolve a JSON schema to TS, substituting known entity references. */
  function resolveSchema(jsonSchema: JsonSchema, indent: number, selfName?: string): string {
    // Direct entity match (skip self to avoid circular reference)
    const direct = tryResolveEntity(jsonSchema, selfName);
    if (direct) return direct.type;

    // Union types — resolve each variant
    if (jsonSchema.oneOf) {
      return jsonSchema.oneOf.map((s) => resolveSchema(inlineRefs(s, jsonSchema.$defs), indent, selfName)).join(" | ");
    }
    if (jsonSchema.anyOf) {
      return jsonSchema.anyOf.map((s) => resolveSchema(inlineRefs(s, jsonSchema.$defs), indent, selfName)).join(" | ");
    }

    // Tuple — resolve each element
    if (jsonSchema.type === "array" && jsonSchema.prefixItems) {
      const items = (jsonSchema.prefixItems as JsonSchema[]).map((s) => resolveSchema(inlineRefs(s, jsonSchema.$defs), indent, selfName));
      return `[${items.join(", ")}]`;
    }

    // Array — check if items match an entity; otherwise recurse so that
    // nested properties (e.g. `Array<{ other: <Entity-shape> }>`) still get
    // substituted with their declared entity type.
    if (jsonSchema.type === "array" && jsonSchema.items) {
      const resolvedItems = inlineRefs(jsonSchema.items, jsonSchema.$defs);
      const itemType = tryResolveEntity(resolvedItems);
      if (itemType) return `${itemType.type}[]`;
      const inner = resolveSchema(resolvedItems, indent);
      if (inner.includes("\n")) return `Array<${inner}>`;
      const needsParens = inner.includes("|");
      return needsParens ? `(${inner})[]` : `${inner}[]`;
    }

    // Object — recursively resolve each property
    if (jsonSchema.type === "object" && jsonSchema.properties) {
      const required = new Set(jsonSchema.required ?? []);
      const pad = "  ".repeat(indent);
      const fields = Object.entries(jsonSchema.properties)
        .filter((entry): entry is [string, JsonSchema] => entry[1] != null)
        .map(([key, prop]) => {
          const resolved = inlineRefs(prop, jsonSchema.$defs);
          const hasDefault = prop.default !== undefined;
          const opt = (required.has(key) && !hasDefault) ? "" : "?";
          const match = tryResolveEntity(resolved);
          const resolvedType = match ? match.type : resolveSchema(resolved, indent + 1);
          // Suppress description when it's identical to the entity type's own description
          const suppressDesc = match && prop.description === match.schema.description;
          const parts: string[] = [];
          if (hasDefault) parts.push(`default: ${JSON.stringify(prop.default)}`);
          const min = prop.minimum as number | undefined;
          const max = prop.maximum as number | undefined;
          if (min !== undefined && max !== undefined) parts.push(`min: ${min}, max: ${max}`);
          else if (min !== undefined) parts.push(`min: ${min}`);
          else if (max !== undefined) parts.push(`max: ${max}`);
          if (prop.description && !suppressDesc) parts.push(prop.description);
          const comment = parts.length > 0 ? ` // ${parts.join(". ")}` : "";
          return `${pad}  ${key}${opt}: ${resolvedType};${comment}`;
        });
      return `{\n${fields.join("\n")}\n${pad}}`;
    }

    return jsonSchemaToTs(jsonSchema, indent);
  }

  function resolveReturnType(zodSchema: z.ZodType, indent: number): string {
    const jsonSchema = z.toJSONSchema(zodSchema, { unrepresentable: "any" }) as JsonSchema;
    return resolveSchema(jsonSchema, indent);
  }

  const methodLines = entries(methods).map(([name, method]) => {
    const returnsType = method.returns ? resolveReturnType(method.returns, 2) : "void";
    if (!method.params) {
      return `    ${name}(): Promise<${returnsType}>;`;
    }
    const paramsSchema = z.toJSONSchema(method.params, { unrepresentable: "any" }) as JsonSchema;
    const paramsType = resolveSchema(paramsSchema, 2);
    if (paramsType === "Record<string, never>") {
      return `    ${name}(): Promise<${returnsType}>;`;
    }
    return `    ${name}(params: ${paramsType}): Promise<${returnsType}>;`;
  });

  return [
    `declare namespace ${namespace} {`,
    ...entityInterfaces,
    "  interface Skill {",
    ...methodLines,
    "  }",
    "}",
    "",
  ].join("\n");
}

// ── Generate ─────────────────────────────────────────────────────────────────
function main(): void {
  const skills: SkillFactory[] = skillFactories;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  skills.forEach((skill) => {
    const content = generateSkillDeclaration(skill);
    const outPath = path.join(OUT_DIR, `${skill.id}.generated.d.ts`);
    fs.writeFileSync(outPath, content);
    console.log(`Written ${path.relative(process.cwd(), outPath)}`);
  });
}

main();
