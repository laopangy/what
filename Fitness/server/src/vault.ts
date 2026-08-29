import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import { config } from "./config.js";

export interface VaultData {
  timers?: unknown[];
  history?: unknown[];
  journals?: unknown[];
  fitness?: unknown;
}

interface VaultEnvelope {
  version: 1;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

const ITERATIONS = 310_000;
const lockFile = `${config.vaultFile}.lock`;
let activePassword: string | null = null;

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function withFileLock<T>(action: () => T | Promise<T>): Promise<T> {
  mkdirSync(path.dirname(config.vaultFile), { recursive: true });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const descriptor = openSync(lockFile, "wx");
      try {
        writeFileSync(descriptor, String(Date.now()), "utf8");
        return await action();
      } finally {
        closeSync(descriptor);
        if (existsSync(lockFile)) unlinkSync(lockFile);
      }
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lockFile).mtimeMs > 30_000) unlinkSync(lockFile);
      } catch {
        // Another process released the lock.
      }
      await wait(25);
    }
  }
  throw new Error("加密数据文件正忙，请稍后重试");
}

function decrypt(password: string): VaultData {
  if (!existsSync(config.vaultFile)) return {};
  try {
    const envelope = JSON.parse(readFileSync(config.vaultFile, "utf8")) as VaultEnvelope;
    if (envelope.version !== 1) throw new Error("unsupported");
    const salt = Buffer.from(envelope.salt, "base64");
    const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8")) as VaultData;
  } catch {
    throw new Error("密码错误或加密数据文件已损坏");
  }
}

function encrypt(password: string, data: VaultData): void {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  const envelope: VaultEnvelope = {
    version: 1,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  const temporaryFile = `${config.vaultFile}.${process.pid}.tmp`;
  writeFileSync(temporaryFile, JSON.stringify(envelope), "utf8");
  renameSync(temporaryFile, config.vaultFile);
}

export async function unlockVault(password: string): Promise<void> {
  if (!password) throw new Error("请输入密码");
  await withFileLock(() => {
    const data = decrypt(password);
    if (!existsSync(config.vaultFile)) encrypt(password, data);
  });
  activePassword = password;
}

export function isVaultUnlocked(): boolean {
  return activePassword !== null;
}

export async function readVault(): Promise<VaultData> {
  if (!activePassword) throw new Error("数据仓库尚未解锁");
  return withFileLock(() => decrypt(activePassword as string));
}

export async function updateVault<T>(updater: (data: VaultData) => T): Promise<T> {
  if (!activePassword) throw new Error("数据仓库尚未解锁");
  return withFileLock(() => {
    const password = activePassword as string;
    const data = decrypt(password);
    const result = updater(data);
    encrypt(password, data);
    return result;
  });
}
