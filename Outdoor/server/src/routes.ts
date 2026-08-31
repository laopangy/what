import { Router } from "express";
import { z } from "zod";
import { deletePlan, readState, savePlan, saveSettings } from "./storage.js";
import { generateItinerary, parseIntent } from "./planner.js";
import type { GenerateResult, Itinerary, TransportMode, TripIntent } from "./types.js";

export const outdoorRouter = Router();
const generateSchema = z.object({
  query: z.string().trim().min(2).max(500),
  mode: z.enum(["driving", "rail", "cycling"]).optional(),
  overrides: z.object({
    origin: z.string().trim().min(1).max(40).optional(),
    destination: z.string().trim().min(1).max(80).optional(),
    dayLabel: z.string().trim().min(1).max(20).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    maxOneWayMinutes: z.number().int().min(15).max(1440).optional(),
    intensity: z.enum(["relaxed", "moderate", "challenging"]).optional(),
  }).optional(),
});
const settingsSchema = z.object({
  homeAddress: z.string().trim().min(2, "请输入完整的家庭地址").max(120),
});

outdoorRouter.post("/generate", async (req, res, next) => {
  try {
    const input = generateSchema.parse(req.body);
    const state = await readState();
    const parsed = parseIntent(input.query, state.settings.homeAddress || undefined);
    const intent = { ...parsed, ...(input.overrides || {}) } as TripIntent;
    const plan = generateItinerary(intent, input.mode as TransportMode | undefined);
    const modeLabels = { driving: "自驾", rail: "高铁", cycling: "骑行" } as const;
    const result: GenerateResult = {
      plan,
      analysis: {
        source: "local-rules",
        summary: `已生成 ${plan.stops.length} 个节点的完整闭环行程`,
        steps: [
          { title: "识别出行条件", detail: `${intent.dayLabel} ${intent.startTime} 出发，${intent.endTime} 前后到家，单程上限 ${intent.maxOneWayMinutes} 分钟` },
          { title: "确定闭环起点", detail: `${intent.origin} → ${plan.intent.destination} → ${intent.origin}${state.settings.homeAddress === intent.origin ? "（已使用家庭地址）" : ""}` },
          { title: "选择交通方案", detail: `候选：${intent.transportModes.map((mode) => modeLabels[mode]).join("、")}；当前采用：${modeLabels[plan.transportMode]}` },
          { title: "编排行程节点", detail: `已安排出发、交通接驳、活动、用餐、休息和返程，共 ${plan.stops.length} 站` },
          { title: "检查时间与风险", detail: plan.warnings[0] || "时间窗口与单程限制检查通过" },
        ],
      },
    };
    res.json(result);
  } catch (error) { next(error); }
});

outdoorRouter.get("/settings", async (_req, res, next) => {
  try { res.json((await readState()).settings); } catch (error) { next(error); }
});

outdoorRouter.put("/settings", async (req, res, next) => {
  try { res.json(await saveSettings(settingsSchema.parse(req.body))); } catch (error) { next(error); }
});

outdoorRouter.get("/plans", async (_req, res, next) => {
  try { res.json((await readState()).plans); } catch (error) { next(error); }
});

outdoorRouter.post("/plans", async (req, res, next) => {
  try { res.status(201).json(await savePlan(req.body as Itinerary)); } catch (error) { next(error); }
});

outdoorRouter.put("/plans/:id", async (req, res, next) => {
  try { res.json(await savePlan({ ...(req.body as Itinerary), id: String(req.params.id) })); } catch (error) { next(error); }
});

outdoorRouter.delete("/plans/:id", async (req, res, next) => {
  try {
    const deleted = await deletePlan(String(req.params.id));
    res.status(deleted ? 200 : 404).json(deleted ? { success: true } : { success: false, error: "行程不存在" });
  } catch (error) { next(error); }
});
