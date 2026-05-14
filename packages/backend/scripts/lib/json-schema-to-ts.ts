/**
 * JSON Schema → TypeScript type string converter.
 */

export type JsonSchema = {
  // eslint-disable-next-line @typescript-eslint/no-restricted-types
  [key: string]: unknown;
  type?: string;
  const?: string | number | boolean;
  enum?: (string | number)[];
  properties?: Record<string, JsonSchema | undefined>;
  required?: string[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  items?: JsonSchema;
  description?: string;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
};

export function jsonSchemaToTs(schema: JsonSchema, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (schema.$ref) {
    return schema.$ref.split("/").pop() ?? "unknown";
  }

  if (schema.const !== undefined) {
    return typeof schema.const === "string" ? `"${schema.const}"` : String(schema.const);
  }

  if (schema.enum) {
    return schema.enum.map((v) => (typeof v === "string" ? `"${v}"` : String(v))).join(" | ");
  }

  if (schema.oneOf) {
    return schema.oneOf.map((s) => jsonSchemaToTs(s, indent)).join(" | ");
  }
  if (schema.anyOf) {
    return schema.anyOf.map((s) => jsonSchemaToTs(s, indent)).join(" | ");
  }

  // Tuple: { type: "array", prefixItems: [...] }
  if (schema.type === "array" && schema.prefixItems) {
    const items = (schema.prefixItems as JsonSchema[]).map((s) => jsonSchemaToTs(s, indent));
    return `[${items.join(", ")}]`;
  }

  if (schema.type === "array" && schema.items) {
    const itemType = jsonSchemaToTs(schema.items, indent);
    if (itemType.includes("\n")) return `Array<${itemType}>`;
    const needsParens = itemType.includes("|");
    return needsParens ? `(${itemType})[]` : `${itemType}[]`;
  }

  if (schema.type === "object") {
    const required = new Set(schema.required ?? []);
    const fields = Object.entries(schema.properties ?? {})
      .filter((entry): entry is [string, JsonSchema] => entry[1] != null)
      .map(([key, prop]) => {
        const hasDefault = prop.default !== undefined;
        const opt = (required.has(key) && !hasDefault) ? "" : "?";
        const parts: string[] = [];
        if (hasDefault) parts.push(`default: ${JSON.stringify(prop.default)}`);
        const min = prop.minimum as number | undefined;
        const max = prop.maximum as number | undefined;
        if (min !== undefined && max !== undefined) parts.push(`min: ${min}, max: ${max}`);
        else if (min !== undefined) parts.push(`min: ${min}`);
        else if (max !== undefined) parts.push(`max: ${max}`);
        if (prop.description) parts.push(prop.description);
        const comment = parts.length > 0 ? ` // ${parts.join(". ")}` : "";
        return `${pad}  ${key}${opt}: ${jsonSchemaToTs(prop, indent + 1)};${comment}`;
      });

    if (fields.length === 0) {
      const ap = schema.additionalProperties;
      if (ap && typeof ap === "object") {
        const valueType = Object.keys(ap).length === 0 ? "unknown" : jsonSchemaToTs(ap, indent);
        return `Record<string, ${valueType}>`;
      }
      return "Record<string, never>";
    }
    return `{\n${fields.join("\n")}\n${pad}}`;
  }

  switch (schema.type) {
    case "string": return "string";
    case "number": case "integer": return "number";
    case "boolean": return "boolean";
    case "null": return "null";
  }

  return "unknown";
}
