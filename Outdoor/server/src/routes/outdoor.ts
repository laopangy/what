import { Router } from "express";
import { z } from "zod";
import { deletePlan, readState, saveSettings } from "../storage.js";

export const outdoorRouter = Router();
outdoorRouter.post("/generate", (_req, res) => {
  res.status(410).json({ success: false, error: "旧版模板规划已停用，请使用五步行程规划" });
});
outdoorRouter.get("/settings", async (_req, res, next) => {
  try { res.json((await readState()).settings); } catch (error) { next(error); }
});
outdoorRouter.put("/settings", async (req, res, next) => {
  try { res.json(await saveSettings(z.object({ homeAddress: z.string().trim().min(2).max(500) }).parse(req.body))); }
  catch (error) { next(error); }
});
outdoorRouter.get("/plans", async (_req, res, next) => {
  try { res.json((await readState()).plans); } catch (error) { next(error); }
});
outdoorRouter.post("/plans", (_req, res) => {
  res.status(410).json({ success: false, error: "旧版行程只读，请重新规划后保存" });
});
outdoorRouter.put("/plans/:id", (_req, res) => {
  res.status(410).json({ success: false, error: "旧版行程只读，请重新规划后保存" });
});
outdoorRouter.delete("/plans/:id", async (req, res, next) => {
  try {
    const deleted = await deletePlan(z.string().uuid().parse(req.params.id));
    res.status(deleted ? 200 : 404).json(deleted ? { success: true } : { success: false, error: "行程不存在" });
  } catch (error) { next(error); }
});
