import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { config } from "./config.js";
import { outdoorRouter } from "./routes.js";
import { isVaultUnlocked, unlockVault } from "./vault.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.post("/api/storage/unlock", async (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  try {
    await unlockVault(password);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(401).json({ success: false, error: error instanceof Error ? error.message : "解锁失败" });
  }
});
app.use("/api/outdoor", outdoorRouter);
app.get("/api/health", (_req, res) => res.json({ status: "ok", module: "outdoor", storage: "encrypted-file", unlocked: isVaultUnlocked(), timestamp: Date.now() }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof ZodError) {
    res.status(400).json({ success: false, error: error.issues[0]?.message || "输入格式不正确" });
    return;
  }
  const message = error instanceof Error ? error.message : "服务器内部错误";
  res.status(message === "数据仓库尚未解锁" ? 423 : 500).json({ success: false, error: message });
});

app.listen(config.port, () => console.log(`Outdoor server running on http://localhost:${config.port} (encrypted vault locked)`));
