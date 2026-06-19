import { spawn } from "child_process";
import { config } from "../config.js";
import type { NcmResult } from "../types/ncm.js";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL: Record<string, number> = {
  state: 5_000,
  search: 120_000,
  playlist: 60_000,
  default: 30_000,
};

const MUTATION_COMMANDS = [
  "play", "pause", "resume", "stop", "next", "prev", "seek", "volume",
  "like", "dislike", "playlist",
];

function isMutation(command: string, args: string[] = []): boolean {
  if (MUTATION_COMMANDS.some((m) => command.startsWith(m))) return true;
  // queue with subcommands (add, clear) are mutations; queue alone is read-only
  if (command === "queue" && args.length > 0) return true;
  return false;
}

function getCacheTTL(command: string): number {
  for (const [key, ttl] of Object.entries(CACHE_TTL)) {
    if (command.startsWith(key)) return ttl;
  }
  return CACHE_TTL.default;
}

export async function runNcm<T = unknown>(
  command: string,
  ...args: string[]
): Promise<NcmResult<T>> {
  const cacheKey = `${command}:${args.join(",")}`;

  if (!isMutation(command, args)) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return { success: true, data: cached.data as T };
    }
  } else {
    cache.clear();
  }

  return new Promise((resolve) => {
    const allArgs = [command, ...args, "--output", "json"];
    const quoted = allArgs.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
    const cmd = `${config.ncmCliCommand} ${config.ncmCliArgs.join(" ")} ${quoted.join(" ")}`;
    console.log(`[ncmExecutor] ${command} ${args.join(" ")}`);

    // Write command to temp .bat file to avoid ByteString error on Node.js v24+
    // Node.js v23+ validates spawn args for Latin-1, but song names/search keywords
    // often contain Chinese characters (e.g. U+4F60 '你')
    const tmpFile = join(tmpdir(), `ncm-${randomUUID()}.bat`);
    const batContent = `@echo off\r\nchcp 65001 >nul 2>&1\r\n${cmd}\r\n`;
    writeFileSync(tmpFile, batContent, "utf8");

    const child = spawn("cmd.exe", ["/c", tmpFile], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill();
      cleanup();
      resolve({ success: false, error: "Command timed out" });
    }, 30_000);

    const cleanup = () => {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
    };

    child.on("close", (code) => {
      clearTimeout(timeout);
      cleanup();

      if (code !== 0 && code !== null) {
        const msg = stderr || `Exit code: ${code}`;
        resolve({ success: false, error: msg });
        return;
      }

      const trimmed = stdout.trim();
      if (!trimmed && isMutation(command, args)) {
        console.warn(`[ncmExecutor] empty stdout for mutation: ${command} ${args.join(" ")}`);
        resolve({ success: true, data: { ok: true } as T });
        return;
      }
      try {
        const data = JSON.parse(trimmed) as T;
        if (!isMutation(command, args)) {
          cache.set(cacheKey, { data, expiry: Date.now() + getCacheTTL(command) });
        }
        resolve({ success: true, data });
      } catch {
        resolve({ success: false, error: `Failed to parse JSON: ${stdout.slice(0, 200)}` });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      cleanup();
      resolve({ success: false, error: err.message });
    });
  });
}

export function clearCache(): void {
  cache.clear();
}
