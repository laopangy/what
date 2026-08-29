import path from "path";
import { existsSync, mkdirSync } from "fs";

const dataDir = process.env.DATA_DIR || path.resolve(import.meta.dirname, "..", "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

export const config = { port: Number(process.env.PORT || 3003), dataFile: path.join(dataDir, "fitness.json") };
