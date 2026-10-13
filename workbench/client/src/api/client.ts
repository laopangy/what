import type { ChatResponse, ConfirmedAction } from "../types/chat";

const BASE = "/api";
const TOKEN_HEADER = "X-Journal-Token";

export interface ApiResult<T> {
  status: number;
  success: boolean;
  data?: T;
  error?: string;
  retryAfter?: number;
}

const tokenHeaders = (token?: string | null): Record<string, string> => (token ? { [TOKEN_HEADER]: token } : {});

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as Partial<ApiResult<T>>;
  return {
    ...payload,
    status: res.status,
    success: res.ok && payload.success === true,
    error: payload.error ?? (res.ok ? undefined : `工作台服务异常（HTTP ${res.status}）`),
  };
}

export const chatApi = {
  send: (messages: { role: "user" | "assistant"; content: string }[], journalToken?: string | null) =>
    request<ChatResponse>("POST", "/chat", { messages }, tokenHeaders(journalToken)),
  confirmAction: (actionId: string, journalToken?: string | null) =>
    request<ConfirmedAction>("POST", `/chat/actions/${encodeURIComponent(actionId)}/confirm`, undefined, tokenHeaders(journalToken)),
  cancelAction: (actionId: string) => request<never>("POST", `/chat/actions/${encodeURIComponent(actionId)}/cancel`),
  unlockJournal: (password: string) => request<{ token: string; expiresAt: number }>("POST", "/chat/journal/unlock", { password }),
  // keepalive lets the revoke request finish while the page is being hidden or closed.
  lockJournal: (journalToken: string) =>
    fetch(`${BASE}/chat/journal/lock`, { method: "POST", keepalive: true, headers: tokenHeaders(journalToken) }),
};
