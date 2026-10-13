import path from "path";
import { readFileSync } from "fs";

// Load .env manually — must happen BEFORE any process.env reads,
// because ES module imports are hoisted and run before index.ts's dotenv.config().
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

function cookieStr(): string {
  const raw = process.env.NETEASE_COOKIE || "";
  if (!raw) return "";
  // Already a valid cookie string — don't mangle it
  if (/^(MUSIC_U=|MUSIC_A_T=|MUSIC_R_T=)/.test(raw)) return raw;
  // Legacy: single token value → wrap with MUSIC_U=
  return `MUSIC_U=${raw}`;
}

const CLIENT_PORTS = [5173, 5174, 5175, 5176, 5177];

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  ncmCliCommand: process.env.NCM_CLI_PATH
    || (process.env.APPDATA ? path.join(process.env.APPDATA, "npm", "ncm-cli.cmd") : "ncm-cli.cmd"),
  ncmCliArgs: [] as string[],
  themeImagesDir: process.env.THEME_IMAGES_DIR
    || path.resolve(process.cwd(), "..", "client", "public", "images"),
  ai: {
    baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.deepseek.com/anthropic",
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN || "",
    model: process.env.ANTHROPIC_MODEL || "deepseek-v4-pro",
  },
  // Local front-ends plus the packaged Electron page; "null" stays rejected because any site can send it from a sandboxed iframe.
  allowedOrigins: new Set([
    ...CLIENT_PORTS.flatMap((port) => [`http://localhost:${port}`, `http://127.0.0.1:${port}`]),
    "file://",
  ]),
  netease: {
    cookie: cookieStr(),
  },
  qq: {
    cookie: process.env.QQ_MUSIC_COOKIE || "",
  },
  playback: {
    pollIntervalMs: 15000,
  },
};

export function getActiveAiConfig() {
  return config.ai;
}
