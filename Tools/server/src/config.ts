import path from "path";
import { readFileSync } from "fs";

function loadEnvFrom(filePath: string, allowedKeys?: ReadonlySet<string>): void {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (allowedKeys && !allowedKeys.has(key)) continue;
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
  loadEnvFrom(
    path.resolve(import.meta.dirname, "..", "..", "..", "workbench", "server", ".env"),
    new Set(["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "ANTHROPIC_MODEL"]),
  );
}
loadEnv();

export const config = {
  port: parseInt(process.env.PORT || "3002"),
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5175",
  },
  vaultFile: process.env.VAULT_FILE || path.resolve(import.meta.dirname, "..", "..", "..", "data", "what.vault"),
  maxHistory: 100,
  moduleName: "tools",
};
