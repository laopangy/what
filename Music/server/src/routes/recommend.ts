import { Router } from "express";
import { runNcm } from "../services/ncmExecutor.js";

export const recommendRouter = Router();

recommendRouter.get("/daily", async (_req, res, next) => {
  try {
    const result = await runNcm("recommend", "daily");
    res.json(result);
  } catch (e) { next(e); }
});

recommendRouter.get("/fm", async (_req, res, next) => {
  try {
    const result = await runNcm("recommend", "fm");
    res.json(result);
  } catch (e) { next(e); }
});
