import { Router } from "express";
import { config } from "../config.js";

export const journalRouter = Router();

const JOURNAL_PROMPT = `你是一个日记整理助手。用户会用随意的白话文描述今天发生的事情，你需要将其整理成结构化的日记。

请分析用户输入，提取以下信息并以 JSON 格式返回（只返回 JSON，不要其他文字）：

{
  "title": "今天的日记标题（10字以内，概括今天）",
  "mood": "心情（一个词，如：开心、疲惫、平静、兴奋、难过、焦虑、满足）",
  "moodEmoji": "对应心情的 emoji（如 😊😫😐🤩😢😰😌）",
  "summary": "用 2-3 句话总结今天",
  "timeline": [
    { "time": "时间段（如：上午、中午12:00、下午3点、晚上）", "event": "发生的事情简述" }
  ],
  "highlights": ["今天的亮点/重要事件"],
  "meals": [
    { "type": "早餐/午餐/晚餐/零食/夜宵", "content": "吃了什么" }
  ],
  "drinks": ["喝了什么"],
  "entertainment": ["玩了什么/看了什么/听了什么"],
  "exercise": ["运动/锻炼内容"],
  "weight": "体重（kg，数字，如用户提到体重则提取，否则为 null）",
  "thoughts": "今天的感想或思考（1-2句话）",
  "tomorrowPlan": "对明天的计划或期待（可为空字符串）"
}

规则：
- 如果用户没提到某类信息，对应字段返回空数组或空字符串
- timeline 按时间顺序排列
- 保持用户原文的语气和风格，不要过度改写
- 心情 emoji 要和心情描述匹配`;

// POST /api/journal/process — process raw journal text with AI
journalRouter.post("/process", async (req, res) => {
  const { rawText } = req.body;
  if (!rawText || typeof rawText !== "string") {
    res.status(400).json({ error: "rawText is required" });
    return;
  }

  if (!config.deepseek.apiKey) {
    res.status(500).json({ error: "DeepSeek API Key 未配置，请在 workbench/server/.env 中设置 ANTHROPIC_AUTH_TOKEN" });
    return;
  }

  try {
    const url = `${config.deepseek.baseUrl}/v1/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.deepseek.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: Buffer.from(JSON.stringify({
        model: config.deepseek.model,
        max_tokens: 2048,
        system: JOURNAL_PROMPT,
        messages: [{ role: "user", content: rawText }],
      }), "utf-8"),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      const detail = err.slice(0, 200) || `HTTP ${response.status}`;
      throw new Error(`DeepSeek API 返回错误: ${detail}`);
    }

    const data = (await response.json()) as {
      content: { type: string; text?: string }[];
    };

    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse JSON from response
    const jsonMatch =
      text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      text.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

    const structured = JSON.parse(jsonStr);
    res.json(structured);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI 请求失败";
    console.error("[Journal] AI error:", msg);
    res.status(500).json({ error: msg });
  }
});
