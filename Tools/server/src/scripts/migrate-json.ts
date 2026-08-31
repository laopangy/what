import { existsSync, readFileSync, unlinkSync } from "fs";
import path from "path";
import { unlockVault, updateVault } from "../vault.js";
import type { JournalEntry } from "../types/journal.js";
import type { ExecutionRecord, Timer } from "../types/timer.js";

function readJson<T>(fileName: string): T[] {
  const filePath = path.resolve(import.meta.dirname, "..", "..", "data", fileName);
  if (!existsSync(filePath)) return [];
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${filePath} 必须包含 JSON 数组`);
  return parsed as T[];
}

async function migrate(): Promise<void> {
  const password = process.env.VAULT_PASSWORD;
  if (!password) throw new Error("请通过 VAULT_PASSWORD 提供数据仓库密码");
  await unlockVault(password);
  const timers = readJson<Timer>("timers.json");
  const history = readJson<ExecutionRecord>("history.json");
  const journals = readJson<JournalEntry>("journal.json");
  await updateVault((data) => {
    data.timers = timers;
    data.history = history;
    data.journals = journals;
  });
  for (const fileName of ["timers.json", "history.json", "journal.json"]) {
    const filePath = path.resolve(import.meta.dirname, "..", "..", "data", fileName);
    if (existsSync(filePath)) unlinkSync(filePath);
  }
  console.log(`迁移完成并删除旧明文文件：${timers.length} 个定时器、${history.length} 条执行记录、${journals.length} 篇日记`);
}

migrate()
  .catch((error: unknown) => {
    console.error("迁移失败：", error);
    process.exitCode = 1;
  });
