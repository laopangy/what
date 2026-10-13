import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { journalLock, JournalLockError } from "../services/journalLock.js";

const TOKEN_HEADER = "X-Journal-Token";
const unlockSchema = z.object({ password: z.string().min(1, "请输入密码") });

export const journalLockRouter = Router();

journalLockRouter.post("/unlock", (req, res) => {
  const parsed = unlockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "请输入密码" });
    return;
  }
  try {
    res.json({ success: true, ...journalLock.unlock(parsed.data.password) });
  } catch (error: unknown) {
    if (!(error instanceof JournalLockError)) throw error;
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    res.status(error.status).json({ success: false, error: error.message, retryAfter: error.retryAfter });
  }
});

journalLockRouter.post("/lock", (req, res) => {
  journalLock.lock(req.get(TOKEN_HEADER));
  res.json({ success: true });
});

export const requireJournalToken: RequestHandler = (req, res, next) => {
  if (journalLock.isValid(req.get(TOKEN_HEADER))) {
    next();
    return;
  }
  res.status(401).json({ success: false, error: "随手记已锁定，请输入工作台数据密码", code: "JOURNAL_LOCKED" });
};
