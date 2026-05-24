export interface LLMConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  enableThinking?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCallResult {
  toolCallId: string;
  functionName: string;
  arguments: Record<string, unknown>;
  result: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  toolCallId?: string;
}

export interface LLMResponse {
  content: string | null;
  toolCalls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }> | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
  finishReason: string;
}
