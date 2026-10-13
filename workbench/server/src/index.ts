import express from "express";
import cors from "cors";
import { config, getActiveAiConfig } from "./config.js";
import { musicPlugin } from "./tools/musicPlugin.js";
import { createFitnessPlugin } from "./tools/fitnessPlugin.js";
import { createTimerPlugin } from "./tools/timerPlugin.js";
import { createOutdoorPlugin } from "./tools/outdoorPlugin.js";
import { createJournalGateway, createJournalPlugin } from "./tools/journalPlugin.js";
import { callDeepSeek, createChatHandler } from "./services/chatService.js";
import { createPendingActionStore } from "./services/pendingActions.js";
import { createChatRouter } from "./routes/chat.js";
import { journalRouter } from "./routes/journal.js";
import { errorHandler, logger } from "./middleware/errorHandler.js";

const assistant = createChatHandler({
  plugins: [
    createFitnessPlugin({ baseUrl: config.modules.fitness }),
    createTimerPlugin({ baseUrl: config.modules.tools }),
    createOutdoorPlugin({ baseUrl: config.modules.outdoor }),
    musicPlugin,
    createJournalPlugin({ baseUrl: config.modules.tools }),
  ],
  callModel: callDeepSeek,
  pending: createPendingActionStore(),
});

const app = express();
app.use(cors({ origin: config.cors.origin }));
app.use(express.json({ limit: "1mb" }));
app.use(logger);

app.use("/api/chat", createChatRouter(assistant, createJournalGateway(config.modules.tools)));
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
  res.json({ status: "ok", modules: assistant.modules, timestamp: Date.now() });
});

app.use(errorHandler);

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Workbench server running on http://127.0.0.1:${config.port}`);
  const ai = getActiveAiConfig();
  console.log(`AI provider: DeepSeek, model: ${ai.model}`);
});
