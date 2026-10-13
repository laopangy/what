export type ConfirmationStatus = "pending" | "running" | "done" | "failed" | "cancelled" | "expired";

export interface ToolConfirmation {
  actionId: string;
  summary: string;
  expiresAt: number;
  status?: ConfirmationStatus;
}

export interface ToolCall {
  name: string;
  module?: string;
  label?: string;
  args: Record<string, unknown>;
  result?: unknown;
  confirmation?: ToolConfirmation;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
  sensitive?: boolean;
  masked?: boolean;
  journalLocked?: boolean;
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  navigate?: string;
  journalLocked?: boolean;
  sensitive?: boolean;
}

export interface ConfirmedAction {
  summary: string;
  result: unknown;
}
