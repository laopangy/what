import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

export const musicEnvPath = resolve(import.meta.dirname, "..", "..", ".env");
export const workbenchEnvPath = resolve(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "workbench",
  "server",
  ".env",
);

export function setEnvValue(path: string, key: string, value: string): void {
  const lines = existsSync(path) ? readFileSync(path, "utf-8").split(/\r?\n/) : [];
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);

  while (lines.length > 0 && lines.at(-1) === "") lines.pop();
  writeFileSync(path, `${lines.join("\n")}\n`, "utf-8");
}

export function clearEnvValue(path: string, key: string): void {
  setEnvValue(path, key, "");
}
