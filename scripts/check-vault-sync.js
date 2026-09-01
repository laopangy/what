const { spawnSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const vaultPath = "data/what.vault";

function git(args) {
  return spawnSync("git", ["-C", projectRoot, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
}

function warn(message) {
  console.warn(`[数据同步] ${message}`);
}

const tracked = git(["ls-files", "--error-unmatch", vaultPath]);
if (tracked.error) {
  warn("未检测到 Git，A/B 电脑之间无法通过项目仓库同步加密数据。");
  process.exit(0);
}
if (tracked.status !== 0) {
  warn(`${vaultPath} 尚未纳入版本控制；本机数据不会同步到另一台电脑。`);
  process.exit(0);
}

const changes = git(["status", "--porcelain", "--", vaultPath]);
if (changes.stdout.trim()) {
  warn("加密数据有未提交更新。使用结束后请提交并推送，再到另一台电脑拉取。 ");
}

const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
if (upstream.status !== 0) {
  warn("当前分支没有上游分支，只能在本机保存数据。");
  process.exit(0);
}

const counts = git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
if (counts.status === 0) {
  const [ahead = 0, behind = 0] = counts.stdout.trim().split(/\s+/).map(Number);
  if (ahead > 0 && behind > 0) warn(`本地与远端已分叉（本地 ${ahead}、远端 ${behind} 个提交），请先处理冲突。`);
  else if (behind > 0) warn(`远端有 ${behind} 个未拉取提交，打开数据前请先执行 git pull。`);
  else if (ahead > 0) warn(`本地有 ${ahead} 个未推送提交，换电脑前请执行 git push。`);
}

if (!changes.stdout.trim() && counts.status === 0 && counts.stdout.trim() === "0\t0") {
  console.log("[数据同步] 加密数据与当前本地远端记录一致；换电脑前仍建议先执行 git pull。");
}
