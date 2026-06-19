import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { errorHandler, logger } from "./middleware/errorHandler.js";
import { timerRouter } from "./routes/timer.js";
import { journalRouter } from "./routes/journal.js";
import { restoreSchedules } from "./services/scheduler.js";

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

app.use("/api/timer", timerRouter);
app.use("/api/journal", journalRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.use(errorHandler);

// Restore saved schedules on startup
restoreSchedules();

app.listen(config.port, () => {
  console.log(`Timer server running on http://localhost:${config.port}`);
});
