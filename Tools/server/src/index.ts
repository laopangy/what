import express from "express";
import cors from "cors";
import path from "node:path";
import { config } from "./config.js";
import { errorHandler, logger } from "./middleware/errorHandler.js";
import { timerRouter } from "./routes/timer.js";
import { journalRouter } from "./routes/journal.js";
import { journalLockRouter, requireJournalToken } from "./routes/journalLock.js";
import { petRouter } from "./routes/pet.js";
import { yunxiaoRouter } from "./routes/yunxiao.js";
import { restoreSchedules } from "./services/scheduler.js";
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
app.use(express.json({ limit: "12mb" }));
app.use(logger);
app.use("/pet-assets", express.static(path.resolve(import.meta.dirname, "..", "assets", "pets"), {
  immutable: true,
  maxAge: "7d",
}));

app.post("/api/storage/unlock", async (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  try {
    await unlockVault(password);
    await restoreSchedules();
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(401).json({ success: false, error: error instanceof Error ? error.message : "解锁失败" });
  }
});

app.use("/api/timer", timerRouter);
app.use("/api/journal-lock", journalLockRouter);
app.use("/api/journal", requireJournalToken, journalRouter);
app.use("/api/pets", petRouter);
app.use("/api/yunxiao", yunxiaoRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", storage: "encrypted-file", unlocked: isVaultUnlocked(), timestamp: Date.now() });
});

app.use(errorHandler);

async function start(): Promise<void> {
  app.listen(config.port, "127.0.0.1", () => {
    console.log(`Timer server running on http://localhost:${config.port} (encrypted vault locked)`);
  });
}

start().catch((error: unknown) => {
  console.error("Tools server failed to start:", error);
  process.exitCode = 1;
});
