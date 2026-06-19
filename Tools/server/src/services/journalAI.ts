type JournalStructured = {
  title: string; mood: string; moodEmoji: string; summary: string;
  timeline: { time: string; event: string }[];
  highlights: string[]; meals: { type: string; content: string }[];
  drinks: string[]; entertainment: string[]; exercise: string[];
  weight?: number; thoughts: string; tomorrowPlan: string;
};

const SYSTEM_PROMPT = `你是一个日记整理助手。用户会用随意的白话文描述今天发生的事情，你需要将其整理成结构化的日记。

请分析用户输入，提取以下信息并以 JSON 格式返回（只返回 JSON，不要其他文字）：

{
  "title": "今天的日记标题（10字以内，概括今天）",
  "mood": "心情（一个词，如：开心、疲惫、平静、兴奋、难过、焦虑、满足）",
  "moodEmoji": "对应心情的 emoji（如 😊😫😐🤩😢😰😌）",
  "summary": "用 2-3 句话总结今天",
  "timeline": [{ "time": "时间段", "event": "发生的事情简述" }],
  "highlights": ["今天的亮点"],
  "meals": [{ "type": "早餐/午餐/晚餐/零食/夜宵", "content": "吃了什么" }],
  "drinks": ["喝了什么"],
  "entertainment": ["玩了什么/看了什么/听了什么"],
  "exercise": ["运动/锻炼内容"],
  "weight": "体重（kg，数字，如用户提到体重则提取，否则为 null）",
  "thoughts": "今天的感想或思考",
  "tomorrowPlan": "对明天的计划或期待（可为空字符串）"
}`;

const BASE_URL = process.env.ANTHROPIC_BASE_URL || "https://api.deepseek.com/anthropic";
const API_KEY = process.env.ANTHROPIC_AUTH_TOKEN || "";
const MODEL = process.env.ANTHROPIC_MODEL || "deepseek-v4-pro";

export async function structureJournal(rawText: string): Promise<JournalStructured> {
  if (!API_KEY) {
    throw new Error("API Key 未配置，请在 Tools/server/.env 或系统环境变量中设置 ANTHROPIC_AUTH_TOKEN");
  }

  const body = Buffer.from(JSON.stringify({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: rawText }],
  }), "utf-8");

  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err.slice(0, 300) || `HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
  };

  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch =
    text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
    text.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

  return JSON.parse(jsonStr) as JournalStructured;
}
