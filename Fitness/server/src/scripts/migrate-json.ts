import { existsSync, readFileSync, unlinkSync } from "fs";
import path from "path";
import { unlockVault, updateVault } from "../vault.js";
import type { FitnessState } from "../types.js";

async function migrate(): Promise<void> {
  const password = process.env.VAULT_PASSWORD;
  if (!password) throw new Error("请通过 VAULT_PASSWORD 提供数据仓库密码");
  const filePath = path.resolve(import.meta.dirname, "..", "..", "data", "fitness.json");
  if (!existsSync(filePath)) {
    console.log("没有找到 Fitness/server/data/fitness.json，无需迁移");
    return;
  }
  await unlockVault(password);
  const state = JSON.parse(readFileSync(filePath, "utf8")) as FitnessState;
  await updateVault((data) => { data.fitness = state; });
  unlinkSync(filePath);
  console.log("Fitness 数据迁移完成，旧明文文件已删除");
}

migrate()
  .catch((error: unknown) => {
    console.error("迁移失败：", error);
    process.exitCode = 1;
  });
