import { Router } from "express";
import { z } from "zod";
import { PET_CATALOG } from "../types/pet.js";
import { publishPetState, subscribeToPetEvents } from "../services/petEvents.js";
import {
  getDesktopPetData,
  recordPetInteraction,
  updatePetPosition,
  updatePetSettings,
} from "../services/petStorage.js";

export const petRouter = Router();

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  activePetId: z.string().min(1).max(64).optional(),
  customName: z.string().trim().min(1).max(24).optional(),
  scale: z.number().min(0.65).max(1.6).optional(),
  opacity: z.number().min(0.45).max(1).optional(),
  autonomous: z.boolean().optional(),
  activityLevel: z.enum(["quiet", "normal", "lively"]).optional(),
  dialogueEnabled: z.boolean().optional(),
  followCursor: z.boolean().optional(),
  eventLinkEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
}).strict();

const positionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
}).strict();

const interactionSchema = z.object({
  type: z.enum(["click", "double-click", "pet", "feed", "play", "wake", "sleep"]),
}).strict();

petRouter.get("/", async (_req, res) => {
  const state = await getDesktopPetData();
  res.json({
    success: true,
    catalog: PET_CATALOG,
    state,
    capabilities: {
      customImage: false,
      imageGeneration: false,
      aiDialogue: false,
    },
  });
});

petRouter.get("/events", async (req, res) => {
  subscribeToPetEvents(req, res, await getDesktopPetData());
});

petRouter.put("/settings", async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "参数错误", details: parsed.error.issues });
    return;
  }
  try {
    const state = await updatePetSettings(parsed.data);
    publishPetState(state);
    res.json({ success: true, state });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "保存失败";
    res.status(message === "该灵宠尚未开放" ? 409 : 500).json({ success: false, error: message });
  }
});

petRouter.put("/position", async (req, res) => {
  const parsed = positionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "参数错误", details: parsed.error.issues });
    return;
  }
  const state = await updatePetPosition(parsed.data);
  publishPetState(state);
  res.json({ success: true, state });
});

petRouter.post("/interactions", async (req, res) => {
  const parsed = interactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "参数错误", details: parsed.error.issues });
    return;
  }
  const result = await recordPetInteraction(parsed.data.type);
  publishPetState(result.data);
  res.json({ success: true, state: result.data, rewarded: result.rewarded });
});
