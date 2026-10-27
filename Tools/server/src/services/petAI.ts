import { readFileSync } from "node:fs";
import path from "node:path";

export interface PetDialogueMessage {
  role: "user" | "assistant";
  text: string;
}

interface PetAiConfig {
  token: string;
  baseUrl: string;
  model: string;
}

interface PetDialogueInput {
  petName: string;
  personality: string;
  currentAction: string;
  mood: number;
  message: string;
  history: PetDialogueMessage[];
}

interface PetDialogueOptions {
  config?: PetAiConfig;
  fetchImpl?: typeof fetch;
}

export function getPetAiConfig(): PetAiConfig {
  const envPath = path.resolve(import.meta.dirname, "..", "..", "..", "..", "workbench", "server", ".env");
  const values: Record<string, string> = {};
  try {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^(ANTHROPIC_AUTH_TOKEN|ANTHROPIC_BASE_URL|ANTHROPIC_MODEL)=(.*)$/);
      if (match) values[match[1]] = match[2].trim();
    }
  } catch { /* use process environment */ }
  return {
    token: process.env.ANTHROPIC_AUTH_TOKEN || values.ANTHROPIC_AUTH_TOKEN || "",
    baseUrl: process.env.ANTHROPIC_BASE_URL || values.ANTHROPIC_BASE_URL || "https://api.deepseek.com/anthropic",
    model: process.env.ANTHROPIC_MODEL || values.ANTHROPIC_MODEL || "deepseek-v4-pro",
  };
}

export function getPetAiStatus() {
  const config = getPetAiConfig();
  return { configured: Boolean(config.token), provider: "DeepSeek", model: config.model };
}

export async function callPetDialogue(input: PetDialogueInput, options: PetDialogueOptions = {}): Promise<string> {
  const config = options.config ?? getPetAiConfig();
  if (!config.token) throw new Error("DeepSeek 未配置，请先在账号与服务设置中配置 AI Key");
  const fetchImpl = options.fetchImpl ?? fetch;
  const history = input.history.slice(-8).map((message) => ({ role: message.role, content: message.text }));
  const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-api-key": config.token,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 180,
      thinking: { type: "disabled" },
      system: `你是用户的桌面灵宠“${input.petName}”。性格：${input.personality}。当前动作：${input.currentAction}，心情值：${input.mood}/100。用符合角色性格的自然中文回应，最多 60 个汉字，不使用 Markdown，不声称读取了未提供的工作台内容，不编造已经完成的操作。`,
      messages: [...history, { role: "user", content: input.message }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`灵宠对话失败（HTTP ${response.status}）`);
  const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.filter((block) => block.type === "text").map((block) => block.text ?? "").join("").trim() ?? "";
  if (!text) throw new Error("灵宠没有返回可读取的回复，请重试");
  return Array.from(text).slice(0, 60).join("");
}
