export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
}

export interface DeepSeekMessage {
  role: "user" | "assistant" | "system";
  content: string | DeepSeekContentBlock[];
}

export interface DeepSeekContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface DeepSeekTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface DeepSeekResponse {
  id: string;
  model: string;
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  content: DeepSeekContentBlock[];
}
