import path from "path";

const CLIENT_PORTS = [5173, 5174, 5175, 5176, 5177];

export const config = {
  port: Number(process.env.PORT || 3003),
  // Local front-ends plus the packaged Electron page; "null" stays rejected because any site can send it from a sandboxed iframe.
  allowedOrigins: new Set([
    ...CLIENT_PORTS.flatMap((port) => [`http://localhost:${port}`, `http://127.0.0.1:${port}`]),
    "file://",
  ]),
  vaultFile: process.env.VAULT_FILE || path.resolve(import.meta.dirname, "..", "..", "..", "data", "what.vault"),
};
