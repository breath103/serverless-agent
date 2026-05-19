import type { MessageParam, TextBlockParam, ToolResultBlockParam, ToolUseBlockParam } from "@anthropic-ai/sdk/resources";

import { BEDROCK_MODEL, bedrockClient } from "./bedrock-client.js";
import type { LlmAssistantContentBlock, LlmAssistantMessage, LlmMessage } from "./llm-message.js";
import { executeCodeTool, type LlmToolDef } from "./tools.js";

const MAX_TOKENS = 32_000;

export class AnthropicClient {
  /**
   * One Claude-on-Bedrock turn: stream-then-await-final, parse tool_use blocks
   * against the single registered tool (`executeCode`).
   */
  async chat(params: {
    system: string;
    messages: LlmMessage[];
    tools: LlmToolDef[];
  }): Promise<LlmAssistantMessage> {
    const response = await bedrockClient.messages.stream({
      model: BEDROCK_MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
      messages: AnthropicClient.renderMessages(params.messages),
      tools: params.tools,
    }).finalMessage();

    return {
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
    };
  }

  private static renderMessages(messages: LlmMessage[]): MessageParam[] {
    return messages.map((msg): MessageParam => {
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
