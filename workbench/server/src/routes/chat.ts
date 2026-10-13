import { Router } from "express";
import { z } from "zod";
import type { ChatAssistant } from "../services/chatService.js";
import type { JournalGateway } from "../tools/journalPlugin.js";

const TOKEN_HEADER = "X-Journal-Token";
const TOKEN_PATTERN = /^[\w-]{20,200}$/;

const chatSchema = z.object({
  messages: z
    .array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(20_000, "单条消息太长了"),
    }))
    .min(1, "消息不能为空")
    .max(100, "对话太长了，请清空后重新开始"),
});
const actionIdSchema = z.string().uuid();
const unlockSchema = z.object({ password: z.string().min(1, "请输入密码").max(1_000, "密码太长了") });

// The token is forwarded to module services only; it never reaches the model or the logs.
const journalToken = (value: string | undefined) => (value && TOKEN_PATTERN.test(value) ? value : undefined);

export function createChatRouter(assistant: ChatAssistant, journal: JournalGateway): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "参数错误" });
      return;
    }
    const data = await assistant.handleChat(parsed.data.messages, { journalToken: journalToken(req.get(TOKEN_HEADER)) });
    res.json({ success: true, data });
  });

  router.post("/actions/:id/confirm", async (req, res) => {
    const id = actionIdSchema.safeParse(req.params.id);
    const outcome = id.success
      ? await assistant.confirmAction(id.data, { journalToken: journalToken(req.get(TOKEN_HEADER)) })
      : null;
    if (!outcome) {
      res.status(404).json({ success: false, error: "确认已过期或已处理" });
      return;
    }
    res.json({ success: true, data: outcome });
  });

  router.post("/actions/:id/cancel", (req, res) => {
    assistant.cancelAction(req.params.id);
    res.json({ success: true });
  });

  router.post("/journal/unlock", async (req, res) => {
    const parsed = unlockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "请输入密码" });
      return;
    }
    const result = await journal.unlock(parsed.data.password);
    if (result.ok) {
      res.json({ success: true, data: { token: result.token, expiresAt: result.expiresAt } });
      return;
    }
    if (result.retryAfter) res.set("Retry-After", String(result.retryAfter));
    res.status(result.status).json({ success: false, error: result.error, retryAfter: result.retryAfter });
  });

  router.post("/journal/lock", async (req, res) => {
    const token = journalToken(req.get(TOKEN_HEADER));
    if (token) await journal.lock(token);
    res.json({ success: true });
  });

  return router;
}
