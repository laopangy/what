const { existsSync, readFileSync, readdirSync, statSync } = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const violations = [];
const allowedRootDataFile = (name) => name.endsWith(".vault") || name.endsWith(".lock") || /^.+\.vault\.\d+\.tmp$/.test(name);

function inspectRootData() {
  const dataDirectory = path.join(projectRoot, "data");
  if (!existsSync(dataDirectory)) return;
  for (const entry of readdirSync(dataDirectory, { withFileTypes: true })) {
    if (entry.isFile() && !allowedRootDataFile(entry.name)) violations.push(path.join(dataDirectory, entry.name));
    if (!entry.isFile()) violations.push(path.join(dataDirectory, entry.name));
  }

  const vaultPath = path.join(dataDirectory, "what.vault");
  if (!existsSync(vaultPath) || statSync(vaultPath).size === 0) return;
  try {
    const envelope = JSON.parse(readFileSync(vaultPath, "utf8"));
    const keys = Object.keys(envelope).sort().join(",");
    if (keys !== "ciphertext,iv,salt,tag,version" || envelope.version !== 1) violations.push(`${vaultPath}（不是受支持的加密信封）`);
  } catch {
    violations.push(`${vaultPath}（无法解析加密信封）`);
  }
}

function inspectLegacyDataDirectories() {
  for (const moduleName of readdirSync(projectRoot)) {
    const dataDirectory = path.join(projectRoot, moduleName, "server", "data");
    if (!existsSync(dataDirectory)) continue;
    for (const entry of readdirSync(dataDirectory, { withFileTypes: true })) {
      if (entry.name !== ".gitkeep") violations.push(path.join(dataDirectory, entry.name));
    }
  }
}

inspectRootData();
inspectLegacyDataDirectories();

if (violations.length > 0) {
  console.error("检测到禁止存在的明文或旧版业务数据文件：");
  for (const filePath of violations) console.error(`- ${path.relative(projectRoot, filePath)}`);
  console.error("用户业务数据必须通过 data/what.vault 加密存储。请先迁移并删除明文源文件。");
  process.exit(1);
}

console.log("数据安全检查通过：未发现旧版明文业务数据文件。");
