import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
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
    res.json({
      success: true,
      data: {
        ai: {
          configured: Boolean(config.deepseek.apiKey),
          baseUrl: config.deepseek.baseUrl,
          model: config.deepseek.model,
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
      apiKey: z.string().trim().min(1),
      baseUrl: z.string().url().optional(),
      model: z.string().trim().min(1).optional(),
    }).parse(req.body);
    const baseUrl = body.baseUrl || config.deepseek.baseUrl;
    const model = body.model || config.deepseek.model;

    for (const path of [musicEnvPath, workbenchEnvPath]) {
      setEnvValue(path, "ANTHROPIC_AUTH_TOKEN", body.apiKey);
      setEnvValue(path, "ANTHROPIC_BASE_URL", baseUrl);
      setEnvValue(path, "ANTHROPIC_MODEL", model);
    }
    config.deepseek.apiKey = body.apiKey;
    config.deepseek.baseUrl = baseUrl;
    config.deepseek.model = model;
    res.json({ success: true, data: { configured: true, baseUrl, model } });
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
