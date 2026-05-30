export const config = {
  port: parseInt(process.env.PORT || "3000"),
  deepseek: {
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
