import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const draftSchema = z.object({
  tasks: z.array(z.object({
    subject: z.string().trim().min(2).max(200),
    description: z.string().trim().min(1).max(10000),
    estimatedHours: z.number().positive().max(1000).nullable(),
    estimateBasis: z.enum(["explicit", "inferred", "missing"]),
    rationale: z.string().trim().max(500),
  })).min(1).max(8),
});

function getAiConfig() {
  const envPath = path.resolve(import.meta.dirname, "..", "..", "..", "..", "workbench", "server", ".env");
  const values: Record<string, string> = {};
  try {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^(ANTHROPIC_AUTH_TOKEN|ANTHROPIC_BASE_URL|ANTHROPIC_MODEL)=(.*)$/);
      if (match) values[match[1]] = match[2].trim();
    }
  } catch { /* use environment */ }
  return {
    token: process.env.ANTHROPIC_AUTH_TOKEN || values.ANTHROPIC_AUTH_TOKEN || "",
    baseUrl: process.env.ANTHROPIC_BASE_URL || values.ANTHROPIC_BASE_URL || "https://api.deepseek.com/anthropic",
    model: process.env.ANTHROPIC_MODEL || values.ANTHROPIC_MODEL || "deepseek-v4-pro",
  };
}

export async function analyzeYunxiaoText(text: string, requirementSubject: string) {
  const config = getAiConfig();
  if (!config.token) throw new Error("DeepSeek 未配置，请先在账号与服务设置中配置 AI Key");
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": config.token,
      "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 3000,
      thinking: { type: "disabled" },
      system: `你是云效任务整理助手。根据用户文字拆分可独立执行的任务，最多 8 条。只返回 JSON：{"tasks":[{"subject":"简短任务标题","description":"Markdown 任务描述，列出需求和验收标准，不虚构未提到的事实","estimatedHours":2,"estimateBasis":"explicit|inferred|missing","rationale":"工时依据"}]}。明确提到的工时按小时换算，estimateBasis=explicit；可合理推断但未明确的工时标为 inferred，说明假设；无法合理估算则 estimatedHours=null、estimateBasis=missing。不要把已经花费的实际工时当作预计工时。`,
      messages: [{ role: "user", content: `父需求：${requirementSubject}\n\n待整理文字：\n${text}` }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`AI 分析失败（HTTP ${response.status}）`);
  const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const output = data.content?.filter((block) => block.type === "text")
    .map((block) => block.text ?? "").join("").trim() ?? "";
  const json = output.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? output.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("AI 没有返回可读取的任务数据，请重试");
  try {
    return draftSchema.parse(JSON.parse(json));
  } catch {
    throw new Error("AI 返回的任务格式不完整，请调整描述后重试");
  }
}
