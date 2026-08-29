import path from "path";

export const config = {
  port: Number(process.env.PORT || 3003),
  vaultFile: process.env.VAULT_FILE || path.resolve(import.meta.dirname, "..", "..", "..", "data", "what.vault"),
};
