import path from "path";
import { readFileSync } from "fs";

// Load .env manually — same pattern as Music/server/src/config.ts
// Must happen BEFORE any process.env reads because ES module imports are hoisted
function loadEnv() {
  try {
    const envPath = path.resolve(import.meta.dirname, "..", ".env");
    const content = readFileSync(envPath, "utf-8");
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
    // .env file is optional
  }
}
loadEnv();

export const config = {
  port: parseInt(process.env.PORT || "3000"),
  ai: {
    baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.deepseek.com/anthropic",
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN || "",
    model: process.env.ANTHROPIC_MODEL || "deepseek-v4-pro",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5174",
  },
  modules: {
    music: process.env.MUSIC_API_URL || "http://localhost:3001",
  },
};

export function getActiveAiConfig() {
  return config.ai;
}
