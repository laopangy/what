import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { errorHandler, logger } from "./middleware/errorHandler.js";
import { timerRouter } from "./routes/timer.js";
import { journalRouter } from "./routes/journal.js";
import { restoreSchedules } from "./services/scheduler.js";
import { isVaultUnlocked, unlockVault } from "./vault.js";

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ];
    if (!origin || allowed.includes(origin) || origin.startsWith("file://")) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in dev
    }
  },
}));
app.use(express.json());
app.use(logger);

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
app.use("/api/journal", journalRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", storage: "encrypted-file", unlocked: isVaultUnlocked(), timestamp: Date.now() });
});

app.use(errorHandler);

async function start(): Promise<void> {
  app.listen(config.port, () => {
    console.log(`Timer server running on http://localhost:${config.port} (encrypted vault locked)`);
  });
}

start().catch((error: unknown) => {
  console.error("Tools server failed to start:", error);
  process.exitCode = 1;
});
