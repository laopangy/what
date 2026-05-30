import express from "express";
import cors from "cors";
import { createServer } from "http";
import { config } from "./config.js";
import { setupWebSocket } from "./services/wsManager.js";
import { errorHandler, logger } from "./middleware/errorHandler.js";
import { playbackRouter } from "./routes/playback.js";
import { searchRouter } from "./routes/search.js";
import { playlistRouter } from "./routes/playlist.js";
import { recommendRouter } from "./routes/recommend.js";
import { userRouter } from "./routes/user.js";
import { songRouter } from "./routes/song.js";
import { themeRouter } from "./routes/theme.js";

const app = express();
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());
app.use(logger);

app.use("/api/playback", playbackRouter);
app.use("/api/search", searchRouter);
app.use("/api/playlist", playlistRouter);
app.use("/api/recommend", recommendRouter);
app.use("/api/user", userRouter);
app.use("/api/song", songRouter);
app.use("/api/theme", themeRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.use(errorHandler);

const server = createServer(app);
setupWebSocket(server);

server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`DeepSeek model: ${config.deepseek.model}`);
});
