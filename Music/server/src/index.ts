import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
// Load .env from server directory (not CWD)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env"), override: true });

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { config, getActiveAiConfig } from "./config.js";
import { setupWebSocket } from "./services/wsManager.js";
import { errorHandler, logger } from "./middleware/errorHandler.js";
import { playbackRouter } from "./routes/playback.js";
import { searchRouter } from "./routes/search.js";
import { playlistRouter } from "./routes/playlist.js";
import { recommendRouter } from "./routes/recommend.js";
import { userRouter } from "./routes/user.js";
import { songRouter } from "./routes/song.js";
import { themeRouter } from "./routes/theme.js";
import { analyzeRouter } from "./routes/analyze.js";
import { settingsRouter } from "./routes/settings.js";
import { qqRouter } from "./routes/qq.js";

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
app.use(logger);

app.use("/api/playback", playbackRouter);
app.use("/api/search", searchRouter);
app.use("/api/playlist", playlistRouter);
app.use("/api/recommend", recommendRouter);
app.use("/api/user", userRouter);
app.use("/api/song", songRouter);
app.use("/api/theme", themeRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/qq", qqRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.use(errorHandler);

const server = createServer(app);
setupWebSocket(server);

server.listen(config.port, "127.0.0.1", () => {
  console.log(`Server running on http://localhost:${config.port}`);
  const ai = getActiveAiConfig();
  console.log(`AI provider: DeepSeek, model: ${ai.model}`);
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const { stopMpv } = await import("./services/mpvController.js");
  await stopMpv();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
