import OpenAI from "openai";
import type { LLMConfig, ChatMessage, LLMResponse, ToolDefinition } from "./types.js";

export class LLMClient {
  private readonly client: OpenAI;
  private readonly config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async chat(input: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    toolChoice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
    stream?: boolean;
    enableThinking?: boolean;
    thinkingBudget?: number;
  }): Promise<LLMResponse> {
    const openaiMessages = input.messages.map((msg) => {
      if (msg.role === "assistant" && msg.toolCalls) {
        return {
          role: "assistant" as const,
          content: msg.content,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        };
      }
      if (msg.role === "tool") {
        return {
          role: "tool" as const,
          content: msg.content,
          tool_call_id: msg.toolCallId,
        };
      }
      return {
        role: msg.role,
        content: msg.content,
      };
    });

    const params: Record<string, unknown> = {
      model: this.config.model,
      messages: openaiMessages,
      max_tokens: this.config.maxTokens ?? 4096,
      temperature: this.config.temperature ?? 0.7,
    };

    if (input.tools && input.tools.length > 0) {
      params.tools = input.tools;
      if (input.toolChoice) {
        params.tool_choice = input.toolChoice;
      }
    }

    if (this.config.enableThinking) {
      params.enable_thinking = true;
    }

    if (input.enableThinking !== undefined) {
      params.enable_thinking = input.enableThinking;
    }
    if (input.thinkingBudget !== undefined && input.thinkingBudget > 0) {
      params.enable_thinking = true;
      params.thinking_budget = input.thinkingBudget;
    }

    const response = await this.client.chat.completions.create(
      params as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming,
    );

    const choice = response.choices[0]!;
    const message = choice.message;

    return {
      content: message.content ?? null,
      toolCalls: message.tool_calls?.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })) ?? null,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      model: response.model,
      finishReason: choice.finish_reason ?? "stop",
    };
  }
}
