import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";

// Pinned to us-east-1 — independent of the ambient AWS_REGION used by DDB/S3/IoT
// clients (those target the app's region; Bedrock model availability dictates ours).
export const bedrockClient = new AnthropicBedrock({ awsRegion: "us-east-1" });

export const BEDROCK_MODEL = "us.anthropic.claude-opus-4-7";
