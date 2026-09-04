import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { config } from "./config.js";
import { outdoorRouter } from "./routes/outdoor.js";
import { isVaultUnlocked, unlockVault } from "./vault.js";
import { journeyRouter } from "./routes/journeys.js";

const app = express();
const allowedOrigins = new Set(["http://localhost:5177", "http://127.0.0.1:5177", "http://localhost:5174", "http://127.0.0.1:5174"]);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)) }));
app.use((req, res, next) => {
  if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) {
    res.status(403).json({ success: false, error: "不允许的请求来源" }); return;
  }
  next();
});
app.use(express.json({ limit: "8mb" }));
app.post("/api/storage/unlock", async (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  try {
    await unlockVault(password);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(401).json({ success: false, error: error instanceof Error ? error.message : "解锁失败" });
  }
});
app.use("/api/outdoor", journeyRouter);
app.use("/api/outdoor", outdoorRouter);
app.get("/api/health", (_req, res) => res.json({ status: "ok", module: "outdoor", storage: "encrypted-file", unlocked: isVaultUnlocked(), timestamp: Date.now() }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Do not log user itinerary input, provider URLs or credentials.
  if (error instanceof ZodError) {
    res.status(400).json({ success: false, error: error.issues[0]?.message || "输入格式不正确" });
    return;
  }
  const message = error instanceof Error ? error.message : "服务器内部错误";
  res.status(message === "数据仓库尚未解锁" ? 423 : 500).json({ success: false, error: message });
});

app.listen(config.port, "127.0.0.1", () => console.log(`Outdoor server running on http://localhost:${config.port} (encrypted vault locked)`));
