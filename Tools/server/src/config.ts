import path from "path";
import { readFileSync, mkdirSync, existsSync } from "fs";

function loadEnvFrom(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // file not found or unreadable — skip
  }
}

function loadEnv() {
  // Load own .env first
  loadEnvFrom(path.resolve(import.meta.dirname, "..", ".env"));
  // Also load workbench .env for shared keys (DeepSeek API key etc.)
  loadEnvFrom(path.resolve(import.meta.dirname, "..", "..", "..", "workbench", "server", ".env"));
}
loadEnv();

const dataDir = process.env.DATA_DIR
  || path.resolve(import.meta.dirname, "..", "data");

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export const config = {
  port: parseInt(process.env.PORT || "3002"),
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5175",
  },
  dataDir,
  timersFile: path.join(dataDir, "timers.json"),
  historyFile: path.join(dataDir, "history.json"),
  maxHistory: 100,
  moduleName: "tools",
};
