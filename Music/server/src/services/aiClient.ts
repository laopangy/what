import { getActiveAiConfig } from "../config.js";

interface OpenAiOutputText {
  type: "output_text";
  text: string;
}

interface OpenAiMessageOutput {
  type: "message";
  content?: OpenAiOutputText[];
}

interface OpenAiResponse {
  output?: OpenAiMessageOutput[];
  status?: string;
  incomplete_details?: { reason?: string } | null;
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export async function callAiText(
  systemPrompt: string,
  userMessage: string,
  maxOutputTokens = 16384,
): Promise<string> {
  const active = getActiveAiConfig();

  if (!active.apiKey) {
    throw new Error(`${active.provider === "openai" ? "OpenAI" : "DeepSeek"} API Key 未配置`);
  }

  if (active.provider === "openai") {
    const response = await fetch(endpoint(active.baseUrl, "responses"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${active.apiKey}`,
      },
      body: Buffer.from(JSON.stringify({
        model: active.model,
        instructions: systemPrompt,
        input: userMessage,
        max_output_tokens: maxOutputTokens,
        store: false,
      }), "utf-8"),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${detail}`);
    }

    const data = (await response.json()) as OpenAiResponse;
    const text = data.output
      ?.filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text)
      .join("")
      .trim() ?? "";

    console.log(`[aiClient] OpenAI response status: ${data.status}, length: ${text.length}`);
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

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
  };
  const text = data.content
    ?.filter((item) => item.type === "text")
    .map((item) => item.text ?? "")
    .join("")
    .trim() ?? "";
  console.log(`[aiClient] DeepSeek response stop_reason: ${data.stop_reason}, length: ${text.length}`);
  return text;
}
