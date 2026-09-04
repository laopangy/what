import { Router } from "express";
import { z } from "zod";
import { Amap } from "../amap.js";
import { credentialSchema, draftSchema, journeySchema, placeSchema } from "../journeySchema.js";
import { mapStatus, readCredentials, saveCredentials } from "../mapSettings.js";
import { buildJourney, recommend } from "../journeyPlanner.js";
import { deleteJourney, readJourneys, saveJourney } from "../journeyStorage.js";

export const journeyRouter = Router();
const provider = async () => new Amap((await readCredentials())?.serviceKey || "");
journeyRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
journeyRouter.get("/map/status", async (_req, res, next) => {
  try { res.json(await mapStatus()); } catch (error) { next(error); }
});
journeyRouter.put("/map/config", async (req, res, next) => {
  try { await saveCredentials(credentialSchema.parse(req.body)); res.json(await mapStatus()); } catch (error) { next(error); }
});
journeyRouter.get("/map/sdk", async (_req, res, next) => {
  try {
    const credentials = await readCredentials();
    if (!credentials?.jsKey || !credentials.securityCode) { res.status(503).json({success: false, error: "请先配置高德 Web 端 Key 和安全密钥"}); return; }
    // JS credentials are necessarily browser-visible in this local desktop integration.
    // Web Service credentials never leave the server.
    res.json({ key: credentials.jsKey, securityCode: credentials.securityCode });
  } catch (error) { next(error); }
});
journeyRouter.post("/places", async (req, res, next) => {
  try {
    const input = z.object({ query: z.string().trim().max(60), near: placeSchema.optional(), type: z.enum(["hotel", "place"]).optional() }).parse(req.body);
    if (!input.query && !input.near) throw new Error("请输入要搜索的地点");
    res.json(await (await provider()).search(input.query, { near: input.near, type: input.type === "hotel" ? "100000" : undefined }));
  } catch (error) { next(error); }
});
journeyRouter.post("/recommend", async (req, res, next) => {
  try { res.json(await recommend(draftSchema.parse(req.body), await provider())); } catch (error) { next(error); }
});
journeyRouter.post("/journeys/generate", async (req, res, next) => {
  try { res.json(await buildJourney(draftSchema.parse(req.body), await provider())); } catch (error) { next(error); }
});
journeyRouter.get("/journeys", async (_req, res, next) => {
  try { res.json(await readJourneys()); } catch (error) { next(error); }
});
journeyRouter.post("/journeys", async (req, res, next) => {
  try { res.status(201).json(await saveJourney(journeySchema.parse(req.body))); } catch (error) { next(error); }
});
journeyRouter.delete("/journeys/:id", async (req, res, next) => {
  try { await deleteJourney(z.string().uuid().parse(req.params.id)); res.json({success: true}); } catch (error) { next(error); }
});
