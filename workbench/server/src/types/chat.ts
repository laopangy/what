export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolConfirmation {
  actionId: string;
  summary: string;
  expiresAt: number;
}

export interface ToolCall {
  name: string;
  module?: string;
  label?: string;
  args: Record<string, unknown>;
  result?: unknown;
  confirmation?: ToolConfirmation;
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  navigate?: string;
  journalLocked?: boolean;
  sensitive?: boolean;
}

export interface DeepSeekMessage {
  role: "user" | "assistant";
  content: string | DeepSeekContentBlock[];
}

// Thinking blocks and other provider-specific blocks are passed back unchanged.
export interface DeepSeekContentBlock {
  type: string;
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
  id?: string;
  model?: string;
  stop_reason: string | null;
  content: DeepSeekContentBlock[];
}
