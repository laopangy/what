import "dotenv/config";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { registerPlugin } from "./tools/toolRegistry.js";
import { musicPlugin } from "./tools/musicPlugin.js";
import { chatRouter } from "./routes/chat.js";
import { errorHandler, logger } from "./middleware/errorHandler.js";

registerPlugin(musicPlugin);

const app = express();
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());
app.use(logger);

app.use("/api/chat", chatRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", modules: ["music"], timestamp: Date.now() });
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Workbench server running on http://localhost:${config.port}`);
  console.log(`DeepSeek model: ${config.deepseek.model}`);
});
