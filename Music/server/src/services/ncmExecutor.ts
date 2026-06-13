import { exec } from "child_process";
import { config } from "../config.js";
import type { NcmResult } from "../types/ncm.js";

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
    exec(
      cmd,
      { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const msg = stderr || error.message;
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
      }
    );
  });
}

export function clearCache(): void {
  cache.clear();
}
