import express from "express";
import cors from "cors";
import { config, getActiveAiConfig } from "./config.js";
import { registerPlugin } from "./tools/toolRegistry.js";
import { musicPlugin } from "./tools/musicPlugin.js";
import { chatRouter } from "./routes/chat.js";
import { journalRouter } from "./routes/journal.js";
import { errorHandler, logger } from "./middleware/errorHandler.js";

registerPlugin(musicPlugin);

const app = express();
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());
app.use(logger);

app.use("/api/chat", chatRouter);
app.use("/api/journal", journalRouter);

// Proxy Music server user/auth endpoints for the client
app.use("/api/music", async (req, res) => {
  try {
    const target = `${config.modules.music}${req.url}`;
    const fetchRes = await fetch(target, {
      method: req.method,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      // Buffer avoids ByteString error on Node.js v23+ Windows
      body: req.method !== "GET" && req.method !== "HEAD" ? Buffer.from(JSON.stringify(req.body), "utf-8") : undefined,
    });
    const json = await fetchRes.json();
    res.status(fetchRes.status).json(json);
  } catch {
    res.status(502).json({ error: "Music server unreachable" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", modules: ["music"], timestamp: Date.now() });
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Workbench server running on http://localhost:${config.port}`);
  const ai = getActiveAiConfig();
  console.log(`AI provider: DeepSeek, model: ${ai.model}`);
});
