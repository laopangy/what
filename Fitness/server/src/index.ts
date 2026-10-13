import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { fitnessRouter } from "./routes.js";
import { isVaultUnlocked, unlockVault } from "./vault.js";

const app = express();
app.use(cors({ origin: (origin, callback) => callback(null, !origin || config.allowedOrigins.has(origin)) }));
app.use((req, res, next) => {
  if (req.headers.origin && !config.allowedOrigins.has(req.headers.origin)) {
    res.status(403).json({ success: false, error: "不允许的请求来源" });
    return;
  }
  next();
});
app.use(express.json());
app.post("/api/storage/unlock", async (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  try {
    await unlockVault(password);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(401).json({ success: false, error: error instanceof Error ? error.message : "解锁失败" });
  }
});
app.use("/api/fitness", fitnessRouter);
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", module: "fitness", storage: "encrypted-file", unlocked: isVaultUnlocked(), timestamp: Date.now() });
});
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const message = error instanceof Error ? error.message : "服务器内部错误";
  res.status(message === "数据仓库尚未解锁" ? 423 : 500).json({ success: false, error: message });
});
async function start(): Promise<void> {
  app.listen(config.port, "127.0.0.1", () => console.log(`Fitness server running on http://localhost:${config.port} (encrypted vault locked)`));
}

start().catch((error: unknown) => {
  console.error("Fitness server failed to start:", error);
  process.exitCode = 1;
});
