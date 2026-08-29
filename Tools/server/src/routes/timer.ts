import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  getAllTimers,
  getTimerById,
  saveTimer,
  deleteTimer,
  getHistoryByTimerId,
  getAllHistory,
} from "../services/storage.js";
import {
  scheduleTimer,
  unscheduleTimer,
  isScheduled,
  triggerTimer,
} from "../services/scheduler.js";
import type { Timer } from "../types/timer.js";

export const timerRouter = Router();

// Zod schema for timer creation/update
const timerSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  description: z.string().default(""),
  cronExpression: z.string().min(1, "Cron 表达式不能为空"),
  taskType: z.enum(["http-request", "shell-command"]),
  taskConfig: z.object({
    url: z.string().optional(),
    method: z.string().optional(),
    body: z.string().optional(),
    command: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
  }).default({}),
  enabled: z.boolean().default(true),
});

const updateTimerSchema = timerSchema.partial();

// GET /api/timer — list all timers
timerRouter.get("/", async (_req, res) => {
  const timers = await getAllTimers();
  // Attach scheduling status
  const enriched = timers.map((t) => ({
    ...t,
    isScheduled: isScheduled(t.id),
  }));
  res.json(enriched);
});

// GET /api/timer/history/all — all execution history
timerRouter.get("/history/all", async (_req, res) => {
  const history = await getAllHistory();
  res.json(history);
});

// POST /api/timer — create timer
timerRouter.post("/", async (req, res) => {
  const parsed = timerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "参数错误", details: parsed.error.issues });
    return;
  }

  const now = new Date().toISOString();
  const timer: Timer = {
    id: uuidv4(),
    ...parsed.data,
    createdAt: now,
    updatedAt: now,
  };

  await saveTimer(timer);
  if (timer.enabled) {
    scheduleTimer(timer);
  }

  res.status(201).json({ ...timer, isScheduled: isScheduled(timer.id) });
});

// GET /api/timer/:id — get single timer
timerRouter.get("/:id", async (req, res) => {
  const timer = await getTimerById(req.params.id);
  if (!timer) {
    res.status(404).json({ error: "定时器不存在" });
    return;
  }
  res.json({ ...timer, isScheduled: isScheduled(timer.id) });
});

// PUT /api/timer/:id — update timer
timerRouter.put("/:id", async (req, res) => {
  const timer = await getTimerById(req.params.id);
  if (!timer) {
    res.status(404).json({ error: "定时器不存在" });
    return;
  }

  const parsed = updateTimerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "参数错误", details: parsed.error.issues });
    return;
  }

  const updated: Timer = {
    ...timer,
    ...parsed.data,
    id: timer.id,
    createdAt: timer.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await saveTimer(updated);

  // Re-schedule
  unscheduleTimer(updated.id);
  if (updated.enabled) {
    scheduleTimer(updated);
  }

  res.json({ ...updated, isScheduled: isScheduled(updated.id) });
});

// DELETE /api/timer/:id — delete timer
timerRouter.delete("/:id", async (req, res) => {
  const timer = await getTimerById(req.params.id);
  if (!timer) {
    res.status(404).json({ error: "定时器不存在" });
    return;
  }

  unscheduleTimer(timer.id);
  await deleteTimer(timer.id);
  res.json({ success: true });
});

// POST /api/timer/:id/toggle — enable/disable timer
timerRouter.post("/:id/toggle", async (req, res) => {
  const timer = await getTimerById(req.params.id);
  if (!timer) {
    res.status(404).json({ error: "定时器不存在" });
    return;
  }

  timer.enabled = !timer.enabled;
  timer.updatedAt = new Date().toISOString();
  await saveTimer(timer);

  if (timer.enabled) {
    scheduleTimer(timer);
  } else {
    unscheduleTimer(timer.id);
  }

  res.json({ ...timer, isScheduled: isScheduled(timer.id) });
});

// POST /api/timer/:id/trigger — manual trigger
timerRouter.post("/:id/trigger", async (req, res) => {
  const timer = await getTimerById(req.params.id);
  if (!timer) {
    res.status(404).json({ error: "定时器不存在" });
    return;
  }

  // Fire and forget (don't block response)
  triggerTimer(timer).catch((err) => {
    console.error(`[Timer] Manual trigger error for "${timer.name}":`, err);
  });

  res.json({ success: true, message: `定时器 "${timer.name}" 已触发` });
});

// GET /api/timer/:id/history — execution history for a timer
timerRouter.get("/:id/history", async (req, res) => {
  const timer = await getTimerById(req.params.id);
  if (!timer) {
    res.status(404).json({ error: "定时器不存在" });
    return;
  }

  const history = await getHistoryByTimerId(timer.id);
  res.json(history);
});
