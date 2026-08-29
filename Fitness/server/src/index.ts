import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { fitnessRouter } from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/fitness", fitnessRouter);
app.get("/api/health", (_req, res) => res.json({ status: "ok", module: "fitness", timestamp: Date.now() }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ success: false, error: "服务器内部错误" });
});
app.listen(config.port, () => console.log(`Fitness server running on http://localhost:${config.port}`));
