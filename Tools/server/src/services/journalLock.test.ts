import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "journal-lock-"));
process.env.VAULT_FILE = path.join(directory, "test.vault");
after(() => rmSync(directory, { recursive: true, force: true }));

const { createJournalLock, JournalLockError } = await import("./journalLock.js");

const PASSWORD = "vault-pass";

function createClockedLock(vaultUnlocked = true) {
  let clock = 1_000_000;
  const lock = createJournalLock({ vaultUnlocked: () => vaultUnlocked, verifyPassword: (value) => value === PASSWORD, now: () => clock });
  return { lock, advance: (milliseconds: number) => { clock += milliseconds; } };
}

const rejectsWith = (action: () => unknown, status: number, retryAfter?: number) =>
  assert.throws(action, (error: unknown) => error instanceof JournalLockError && error.status === status && error.retryAfter === retryAfter);

test("工作台数据密码换取令牌，锁定后立即失效", () => {
  const { lock } = createClockedLock();
  const { token } = lock.unlock(PASSWORD);
  assert.equal(lock.isValid(token), true);
  assert.equal(lock.isValid(undefined), false);
  assert.equal(lock.isValid("forged-token"), false);
  lock.lock(token);
  assert.equal(lock.isValid(token), false);
});

test("令牌 12 小时后过期", () => {
  const { lock, advance } = createClockedLock();
  const { token } = lock.unlock(PASSWORD);
  advance(12 * 60 * 60 * 1000 - 1);
  assert.equal(lock.isValid(token), true);
  advance(1);
  assert.equal(lock.isValid(token), false);
});

test("连续 5 次密码错误冷却 30 秒，冷却期间正确密码也被拒", () => {
  const { lock, advance } = createClockedLock();
  for (let attempt = 0; attempt < 4; attempt += 1) rejectsWith(() => lock.unlock("wrong"), 401);
  rejectsWith(() => lock.unlock("wrong"), 429, 30);
  advance(10_000);
  rejectsWith(() => lock.unlock(PASSWORD), 429, 20);
  advance(20_000);
  assert.ok(lock.unlock(PASSWORD).token);
});

test("解锁成功后清零失败次数", () => {
  const { lock } = createClockedLock();
  for (let attempt = 0; attempt < 4; attempt += 1) rejectsWith(() => lock.unlock("wrong"), 401);
  lock.unlock(PASSWORD);
  for (let attempt = 0; attempt < 4; attempt += 1) rejectsWith(() => lock.unlock("wrong"), 401);
});

test("数据仓库未解锁时拒绝进入随手记", () => {
  const { lock } = createClockedLock(false);
  rejectsWith(() => lock.unlock(PASSWORD), 423);
});

test("随手记接口必须携带有效令牌", async (t) => {
  const vault = await import("../vault.js");
  const { journalLockRouter, requireJournalToken } = await import("../routes/journalLock.js");
  const { journalRouter } = await import("../routes/journal.js");
  const { default: express } = await import("express");

  await vault.unlockVault(PASSWORD);
  assert.equal(vault.verifyVaultPassword(PASSWORD), true);
  assert.equal(vault.verifyVaultPassword("wrong"), false);

  const app = express();
  app.use(express.json());
  app.use("/api/journal-lock", journalLockRouter);
  app.use("/api/journal", requireJournalToken, journalRouter);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => { server.closeAllConnections(); server.close(); });
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const unlock = (password: string) => fetch(`${base}/api/journal-lock/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const locked = await fetch(`${base}/api/journal`);
  assert.equal(locked.status, 401);
  assert.equal((await locked.json()).code, "JOURNAL_LOCKED");

  assert.equal((await unlock("")).status, 400);
  assert.equal((await unlock("wrong")).status, 401);

  const unlocked = await unlock(PASSWORD);
  assert.equal(unlocked.status, 200);
  const { token } = await unlocked.json() as { token: string };

  const list = await fetch(`${base}/api/journal`, { headers: { "X-Journal-Token": token } });
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), []);

  await fetch(`${base}/api/journal-lock/lock`, { method: "POST", headers: { "X-Journal-Token": token } });
  assert.equal((await fetch(`${base}/api/journal`, { headers: { "X-Journal-Token": token } })).status, 401);
});
