import { getActiveAiConfig } from "../config.js";

export interface OpenAiFunctionCall {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

export interface OpenAiMessageOutput {
  type: "message";
  content?: Array<{ type: "output_text"; text: string }>;
}

export interface OpenAiReasoningOutput {
  type: "reasoning";
  [key: string]: unknown;
}

export type OpenAiOutputItem =
  | OpenAiFunctionCall
  | OpenAiMessageOutput
  | OpenAiReasoningOutput
  | { type: string; [key: string]: unknown };

export interface OpenAiResponse {
  id: string;
  status: "completed" | "incomplete" | "failed" | "in_progress" | "cancelled" | "queued";
  output: OpenAiOutputItem[];
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export async function callOpenAiResponse(body: Record<string, unknown>): Promise<OpenAiResponse> {
  const active = getActiveAiConfig();
  if (active.provider !== "openai") {
    throw new Error("当前 AI 提供商不是 OpenAI");
  }
  if (!active.apiKey) {
    throw new Error("OpenAI API Key 未配置");
  }

  const response = await fetch(endpoint(active.baseUrl, "responses"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${active.apiKey}`,
    },
    body: Buffer.from(JSON.stringify({ model: active.model, store: false, ...body }), "utf-8"),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${detail}`);
  }

  const data = (await response.json()) as OpenAiResponse;
  if (data.status === "failed") {
    throw new Error(`OpenAI API 请求失败：${data.error?.message || "未知错误"}`);
  }
  return data;
}

export async function callAiText(
  systemPrompt: string,
  userMessage: string,
  maxOutputTokens = 4096,
): Promise<string> {
  const active = getActiveAiConfig();

  if (!active.apiKey) {
    throw new Error(`${active.provider === "openai" ? "OpenAI" : "DeepSeek"} API Key 未配置`);
  }

  if (active.provider === "openai") {
    const data = await callOpenAiResponse({
      instructions: systemPrompt,
      input: userMessage,
      max_output_tokens: maxOutputTokens,
    });
    const text = data.output
      .filter((item): item is OpenAiMessageOutput => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .map((item) => item.text)
      .join("")
      .trim();
    if (!text && data.status === "incomplete") {
      throw new Error(`OpenAI 响应未完成：${data.incomplete_details?.reason || "未知原因"}`);
    }
    return text;
  }

  const response = await fetch(endpoint(active.baseUrl, "v1/messages"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-api-key": active.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: Buffer.from(JSON.stringify({
      model: active.model,
      max_tokens: maxOutputTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }), "utf-8"),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${detail}`);
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  return data.content
    ?.filter((item) => item.type === "text")
    .map((item) => item.text ?? "")
    .join("")
    .trim() ?? "";
}
