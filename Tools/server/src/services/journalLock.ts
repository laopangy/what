import { randomBytes } from "crypto";
import { isVaultUnlocked, verifyVaultPassword } from "../vault.js";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

export class JournalLockError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfter?: number) {
    super(message);
  }
}

interface JournalLockDeps {
  vaultUnlocked: () => boolean;
  verifyPassword: (password: string) => boolean;
  now?: () => number;
}

export function createJournalLock({ vaultUnlocked, verifyPassword, now = Date.now }: JournalLockDeps) {
  const sessions = new Map<string, number>();
  let failedAttempts = 0;
  let blockedUntil = 0;

  const cooldownError = () => {
    const seconds = Math.ceil((blockedUntil - now()) / 1000);
    return new JournalLockError(`密码错误次数过多，请 ${seconds} 秒后再试`, 429, seconds);
  };

  return {
    unlock(password: string): { token: string; expiresAt: number } {
      if (!vaultUnlocked()) throw new JournalLockError("数据仓库尚未解锁，请先在工作台输入数据密码", 423);
      if (now() < blockedUntil) throw cooldownError();
      if (!verifyPassword(password)) {
        failedAttempts += 1;
        if (failedAttempts < MAX_FAILED_ATTEMPTS) throw new JournalLockError("密码错误，请重新输入", 401);
        failedAttempts = 0;
        blockedUntil = now() + COOLDOWN_MS;
        throw cooldownError();
      }
      failedAttempts = 0;
      const issuedAt = now();
      for (const [token, expiresAt] of sessions) if (expiresAt <= issuedAt) sessions.delete(token);
      const token = randomBytes(32).toString("base64url");
      const expiresAt = issuedAt + SESSION_TTL_MS;
      sessions.set(token, expiresAt);
      return { token, expiresAt };
    },

    isValid(token: string | undefined): boolean {
      const expiresAt = token ? sessions.get(token) : undefined;
      if (expiresAt === undefined) return false;
      if (expiresAt > now()) return true;
      sessions.delete(token as string);
      return false;
    },

    lock(token: string | undefined): void {
      if (token) sessions.delete(token);
    },
  };
}

export const journalLock = createJournalLock({ vaultUnlocked: isVaultUnlocked, verifyPassword: verifyVaultPassword });
