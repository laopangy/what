import path from "path";

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  ncmCliCommand: process.env.NCM_CLI_PATH || "C:\\Users\\mmhm\\AppData\\Roaming\\npm\\ncm-cli.cmd",
  ncmCliArgs: [] as string[],
  themeImagesDir: process.env.THEME_IMAGES_DIR
    || path.resolve(process.cwd(), "..", "client", "public", "images"),
  deepseek: {
    baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.deepseek.com/anthropic",
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN || "",
    model: process.env.ANTHROPIC_MODEL || "deepseek-v4-pro",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  },
  playback: {
    pollIntervalMs: 5000,
  },
};
