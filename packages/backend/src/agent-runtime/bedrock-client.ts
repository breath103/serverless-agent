import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";

export const bedrockClient = new AnthropicBedrock();

// `global.*` inference profile routes across every Bedrock region, so the call
// works no matter where the SDK resolves its region from (Lambda runtime in
// prod, ~/.aws/config in dev). Geo profiles (`us.*`, `eu.*`) would require
// the caller to be in a specific source region.
export const BEDROCK_MODEL = "global.anthropic.claude-opus-4-7";
