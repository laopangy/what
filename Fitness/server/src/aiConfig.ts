import { readFileSync } from "fs";
import path from "path";

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // AI is optional; nutrition calculation can still use the local food catalog.
  }
}

const projectRoot = path.resolve(import.meta.dirname, "..", "..", "..");
loadEnvFile(path.resolve(import.meta.dirname, "..", ".env"));
loadEnvFile(path.join(projectRoot, "workbench", "server", ".env"));

export const nutritionAiConfig = {
  baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.deepseek.com/anthropic",
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN || "",
  model: process.env.ANTHROPIC_MODEL || "deepseek-v4-pro",
};
