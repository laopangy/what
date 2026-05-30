const BASE = "/api";

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<{ success: boolean; data?: T; error?: string }> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  return res.json();
}

export const chatApi = {
  send: (messages: { role: "user" | "assistant"; content: string }[]) =>
    request<{ content: string; toolCalls: unknown[] }>("POST", "/chat", { messages }),
};
