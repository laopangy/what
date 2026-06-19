import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  getAllEntries,
  getEntryById,
  getEntryByDate,
  saveEntry,
  deleteEntry,
} from "../services/journalStorage.js";
import { structureJournal } from "../services/journalAI.js";
import type { JournalEntry } from "../types/journal.js";

export const journalRouter = Router();

const createSchema = z.object({
  rawText: z.string().min(1, "内容不能为空"),
  date: z.string().optional(),
});

// POST /api/journal — create a journal entry (AI-processed)
journalRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "参数错误", details: parsed.error.issues });
    return;
  }

  const { rawText, date } = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  const entryDate = date || today;

  // Check if entry already exists for this date
  const existing = getEntryByDate(entryDate);
  if (existing) {
    res.status(409).json({
      error: "该日期已有日记",
      existingId: existing.id,
      message: "今天已经写过日记了，你可以更新或删除已有的日记",
    });
    return;
  }

  const now = new Date().toISOString();
  let structured;
  let aiError: string | null = null;

  try {
    structured = await structureJournal(rawText);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI 处理失败";
    console.error("[Journal] AI processing error:", msg);
    aiError = msg;
    // Fallback: save with basic structure so diary isn't lost
    structured = {
      title: rawText.slice(0, 20) || "今日日记",
      mood: "平静",
      moodEmoji: "😐",
      summary: rawText.slice(0, 100),
      timeline: [],
      highlights: [],
      meals: [],
      drinks: [],
      entertainment: [],
      exercise: [],
      weight: undefined,
      thoughts: rawText,
      tomorrowPlan: "",
    };
  }

  const entry: JournalEntry = {
    id: uuidv4(),
    date: entryDate,
    rawText,
    structured,
    createdAt: now,
    updatedAt: now,
  };

  saveEntry(entry);
  res.status(201).json({ ...entry, aiError });
});

// GET /api/journal — list all entries
journalRouter.get("/", (_req, res) => {
  const entries = getAllEntries();
  res.json(entries);
});

// GET /api/journal/date/:date — get entry by date
journalRouter.get("/date/:date", (req, res) => {
  const entry = getEntryByDate(req.params.date);
  if (!entry) {
    res.status(404).json({ error: "该日期没有日记" });
    return;
  }
  res.json(entry);
});

// GET /api/journal/:id — get single entry
journalRouter.get("/:id", (req, res) => {
  const entry = getEntryById(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "日记不存在" });
    return;
  }
  res.json(entry);
});

const updateSchema = z.object({
  rawText: z.string().min(1, "内容不能为空"),
});

// PUT /api/journal/:id — update a journal entry (re-process with AI)
journalRouter.put("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "参数错误", details: parsed.error.issues });
    return;
  }

  const existing = getEntryById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "日记不存在" });
    return;
  }

  const { rawText } = parsed.data;
  const now = new Date().toISOString();
  let structured;
  let aiError: string | null = null;

  try {
    structured = await structureJournal(rawText);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI 处理失败";
    console.error("[Journal] AI processing error on update:", msg);
    aiError = msg;
    // Fallback: keep old structure but update rawText
    structured = {
      ...existing.structured,
      summary: rawText.slice(0, 100),
      thoughts: rawText,
    };
  }

  const updated: JournalEntry = {
    ...existing,
    rawText,
    structured,
    updatedAt: now,
  };

  saveEntry(updated);
  res.json({ ...updated, aiError });
});

// POST /api/journal/:id/reprocess — re-run AI on existing entry
journalRouter.post("/:id/reprocess", async (req, res) => {
  const entry = getEntryById(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "日记不存在" });
    return;
  }

  const now = new Date().toISOString();
  let structured;
  let aiError: string | null = null;

  try {
    structured = await structureJournal(entry.rawText);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI 处理失败";
    console.error("[Journal] AI reprocess error:", msg);
    aiError = msg;
    structured = {
      ...entry.structured,
      summary: entry.rawText.slice(0, 100),
      thoughts: entry.rawText,
    };
  }

  const updated: JournalEntry = {
    ...entry,
    structured,
    updatedAt: now,
  };

  saveEntry(updated);
  res.json({ ...updated, aiError });
});

// DELETE /api/journal/:id — delete entry
journalRouter.delete("/:id", (req, res) => {
  const entry = getEntryById(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "日记不存在" });
    return;
  }
  deleteEntry(entry.id);
  res.json({ success: true });
});
