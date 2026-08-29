import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  plugins: [react(), tailwindcss()],
  server: { port: 5176, proxy: { "/api": "http://localhost:3003" } },
}));
