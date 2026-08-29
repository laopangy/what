import { Router } from "express";
import { z } from "zod";
import { config, getActiveAiConfig } from "../config.js";
import { isLoggedIn } from "../services/authHelper.js";
import { musicEnvPath, setEnvValue, workbenchEnvPath } from "../services/envFile.js";
import {
  checkQQLoginQr,
  createQQLoginQr,
  getQQLoginStatus,
  logoutQQMusic,
} from "../services/qqMusic.js";

export const settingsRouter = Router();

settingsRouter.use((req, res, next) => {
  const origin = req.get("origin");
  if (
    origin
    && origin !== "null"
    && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
    && !origin.startsWith("file://")
  ) {
    res.status(403).json({ success: false, error: "设置接口仅允许本机客户端访问" });
    return;
  }
  next();
});

settingsRouter.get("/status", async (_req, res, next) => {
  try {
    const activeAi = getActiveAiConfig();
    res.json({
      success: true,
      data: {
        ai: {
          configured: Boolean(activeAi.apiKey),
          provider: activeAi.provider,
          baseUrl: activeAi.baseUrl,
          model: activeAi.model,
        },
        netease: await isLoggedIn(),
        qq: getQQLoginStatus(),
      },
    });
  } catch (error) { next(error); }
});

settingsRouter.post("/ai", (req, res, next) => {
  try {
    const body = z.object({
      provider: z.enum(["deepseek", "openai"]),
      apiKey: z.string().trim().min(1),
      baseUrl: z.string().url().optional(),
      model: z.string().trim().min(1).optional(),
    }).parse(req.body);
    const target = config.ai[body.provider];
    const baseUrl = body.baseUrl || target.baseUrl;
    const model = body.model || target.model;
    const keys = body.provider === "openai"
      ? { apiKey: "OPENAI_API_KEY", baseUrl: "OPENAI_BASE_URL", model: "OPENAI_MODEL" }
      : { apiKey: "ANTHROPIC_AUTH_TOKEN", baseUrl: "ANTHROPIC_BASE_URL", model: "ANTHROPIC_MODEL" };

    for (const path of [musicEnvPath, workbenchEnvPath]) {
      setEnvValue(path, "AI_PROVIDER", body.provider);
      setEnvValue(path, keys.apiKey, body.apiKey);
      setEnvValue(path, keys.baseUrl, baseUrl);
      setEnvValue(path, keys.model, model);
    }
    config.ai.provider = body.provider;
    target.apiKey = body.apiKey;
    target.baseUrl = baseUrl;
    target.model = model;
    res.json({ success: true, data: { configured: true, provider: body.provider, baseUrl, model } });
  } catch (error) { next(error); }
});

settingsRouter.post("/qq/login-qr", async (_req, res, next) => {
  try {
    if (getQQLoginStatus().loggedIn) {
      res.json({ success: true, data: { alreadyLoggedIn: true } });
      return;
    }
    res.json({ success: true, data: await createQQLoginQr() });
  } catch (error) { next(error); }
});

settingsRouter.post("/qq/login-check", async (req, res, next) => {
  try {
    const { qrKey } = z.object({ qrKey: z.string().uuid() }).parse(req.body);
    res.json({ success: true, data: await checkQQLoginQr(qrKey) });
  } catch (error) { next(error); }
});

settingsRouter.post("/qq/logout", (_req, res, next) => {
  try {
    logoutQQMusic();
    res.json({ success: true });
  } catch (error) { next(error); }
});
