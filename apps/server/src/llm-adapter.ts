import type { ModelGateway } from "./model-gateway.js";

export interface LLMCallable {
  chat(input: {
    system: string;
    messages: Array<{ role: string; content: string }>;
    responseFormat?: { type: string };
  }): Promise<{ content: string }>;
}

export function asLLMCallable(gateway: ModelGateway): LLMCallable | null {
  if (!gateway.chatWithTools) return null;
  return {
    async chat(input) {
      const result = await gateway.chatWithTools!({
        messages: [
          { role: "system", content: input.system },
          ...input.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
        systemPrompt: input.system,
      });
      const response = result.response as any;
      return { content: response?.content ?? response?.choices?.[0]?.message?.content ?? "{}" };
    },
  };
}
