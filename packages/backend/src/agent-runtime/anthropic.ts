import Anthropic from "@anthropic-ai/sdk";
import type { TextBlockParam, ToolResultBlockParam, ToolUseBlockParam } from "@anthropic-ai/sdk/resources";

import type { LlmAssistantContentBlock, LlmAssistantMessage, LlmMessage } from "./llm-message.js";
import { executeCodeTool, type LlmToolDef } from "./tools.js";

const MODEL = "claude-opus-4-6";
const MAX_TOKENS = 32_000;
// Dollars per 1M tokens. Ephemeral 5-min cache: write = 1.25x input, read = 0.1x input.
// https://platform.claude.com/docs/en/about-claude/pricing
const PRICING = { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.50 };

type LlmUsage = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  costs: { input: number; output: number; cacheWrite: number; cacheRead: number };
};

type LlmChatResult = {
  message: LlmAssistantMessage;
  usage: LlmUsage;
};

/**
 * Minimal Anthropic wrapper for the chat loop. One model, one tool,
 * stream-then-await-final semantics.
 */
export class AnthropicClient {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(params: {
    system: string;
    messages: LlmMessage[];
    tools: LlmToolDef[];
  }): Promise<LlmChatResult> {
    const renderedMessages = AnthropicClient.renderMessages(params.messages);

    const response = await this.client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
      messages: renderedMessages,
      tools: params.tools,
    }).finalMessage();

    return {
      message: {
        role: "assistant",
        content: response.content.map((block): LlmAssistantContentBlock => {
          switch (block.type) {
            case "text":
              return { type: "text", text: block.text };
            case "tool_use":
              if (block.name !== executeCodeTool.name) {
                throw new Error(`Unexpected tool from LLM: ${block.name}`);
              }
              return {
                type: "tool_use",
                id: block.id,
                name: "executeCode",
                input: executeCodeTool.input.parse(block.input),
              };
            default:
              throw new Error(`Unexpected content block type: ${block.type}`);
          }
        }),
      },
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
        costs: {
          input: (response.usage.input_tokens * PRICING.input) / 1_000_000,
          output: (response.usage.output_tokens * PRICING.output) / 1_000_000,
          cacheWrite: ((response.usage.cache_creation_input_tokens ?? 0) * PRICING.cacheWrite) / 1_000_000,
          cacheRead: ((response.usage.cache_read_input_tokens ?? 0) * PRICING.cacheRead) / 1_000_000,
        },
      },
    };
  }

  private static renderMessages(messages: LlmMessage[]): Anthropic.MessageParam[] {
    return messages.map((msg): Anthropic.MessageParam => {
      switch (msg.role) {
        case "assistant":
          return {
            role: "assistant",
            content: msg.content.map((block) => {
              switch (block.type) {
                case "text":
                  return { type: "text", text: block.text } satisfies TextBlockParam;
                case "tool_use":
                  return {
                    type: "tool_use",
                    id: block.id,
                    name: block.name,
                    input: block.input,
                  } satisfies ToolUseBlockParam;
              }
            }),
          };
        case "user":
          return {
            role: "user",
            content: msg.content.map((block) => {
              switch (block.type) {
                case "text":
                  return { type: "text", text: block.text } satisfies TextBlockParam;
                case "tool_result":
                  return {
                    type: "tool_result",
                    tool_use_id: block.tool_use_id,
                    content: JSON.stringify(block.result, null, 2),
                  } satisfies ToolResultBlockParam;
              }
            }),
          };
      }
    });
  }
}
