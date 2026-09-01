const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain } = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const http = require("http");
const net = require("net");
const fs = require("fs");
const os = require("os");
const zlib = require("zlib");

// ── Constants ────────────────────────────────────────────────────────────────
const MUSIC_PORT = 3001;
const MUSIC_CLIENT_PORT = 5173;
const WORKBENCH_PORT = 3000;
const WORKBENCH_CLIENT_PORT = 5174;
const SERVICE_PORTS = [3000, 3001, 3002, 3003, 3004, 5173, 5174, 5175, 5176, 5177];
const MPV_PID_FILE = path.join(os.tmpdir(), "what-music-mpv.pid");
const PROJECT_ROOT = path.resolve(__dirname, "..");
const VAULT_RELATIVE_PATH = "data/what.vault";

const isDev = !app.isPackaged;

// ── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let cleanupComplete = false;
let shutdownPromise = null;
let quitCheckPromise = null;
let ownsInstanceLock = true;

function isMainWindowEvent(event) {
  return mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;
}

ipcMain.on("window:minimize", (event) => {
  if (!isMainWindowEvent(event)) return;
  mainWindow.minimize();
});
ipcMain.on("window:toggle-maximize", (event) => {
  if (!isMainWindowEvent(event)) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("window:close", (event) => {
  if (!isMainWindowEvent(event)) return;
  void requestQuit();
});

// ── Tray Icon PNG ────────────────────────────────────────────────────────────
function createPNG(size, r, g, b) {
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2 + 0.5, dy = y - size / 2 + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < size / 2 - 1) row.push(r, g, b, 255);
      else if (dist < size / 2) { const a = Math.round((1 - (dist - (size / 2 - 1))) * 255); row.push(r, g, b, Math.max(0, a)); }
      else row.push(0, 0, 0, 0);
    }
    rawRows.push(Buffer.from(row));
  }
  const rawData = Buffer.concat(rawRows), deflated = zlib.deflateSync(rawData);
  const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; };
  const makeChunk = (type, data) => { const td = Buffer.concat([Buffer.from(type, "ascii"), data]); const l = Buffer.alloc(4); l.writeUInt32BE(data.length, 0); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td), 0); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), makeChunk("IHDR", ihdr), makeChunk("IDAT", deflated), makeChunk("IEND", Buffer.alloc(0))]);
  const iconPath = path.join(app.getPath("userData"), "tray-icon.png");
  fs.writeFileSync(iconPath, png);
  return nativeImage.createFromPath(iconPath);
}

// ── Loading HTML ─────────────────────────────────────────────────────────────
function getLoadingHTML(status) {
  return `data:text/html,${encodeURIComponent(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    height:100vh;background:#0b1120;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;gap:24px}
    .logo{font-size:48px;animation:bounce 1s ease-in-out infinite}
    @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
    .spinner{width:44px;height:44px;border:3px solid #1e293b;border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    h1{font-size:20px;font-weight:600;background:linear-gradient(135deg,#e2e8f0,#a5b4fc,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .status{font-size:13px;color:#64748b}
    .dots::after{content:"";animation:dots 1.5s steps(4) infinite}
    @keyframes dots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}
    .progress{width:200px;height:2px;background:#1e293b;border-radius:1px;overflow:hidden;margin-top:8px}
    .progress-bar{height:100%;background:linear-gradient(90deg,#6366f1,#818cf8);border-radius:1px;width:${Math.min(status || 10, 95)}% ;transition:width 0.5s ease}
    </style></head><body>
    <div class="logo">⚡</div>
    <h1>阿潘阿潘潘的工具栈</h1>
    <div class="spinner"></div>
    <p class="status">${status < 80 ? "正在启动服务" : "即将完成"}<span class="dots"></span></p>
    <div class="progress"><div class="progress-bar"></div></div>
    </body></html>`
  )}`;
}

// ── HTTP helpers for music API ───────────────────────────────────────────────
function musicGet(endpoint) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: "127.0.0.1", port: MUSIC_PORT, path: `/api${endpoint}`, method: "GET" }, (res) => {
      let body = ""; res.on("data", (c) => (body += c)); res.on("end", () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null)); req.setTimeout(3000, () => { req.destroy(); resolve(null); }); req.end();
  });
}
function musicPost(endpoint, body) {
  const data = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = http.request({ hostname: "127.0.0.1", port: MUSIC_PORT, path: `/api${endpoint}`, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } }, (res) => {
      let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null)); req.setTimeout(3000, () => { req.destroy(); resolve(null); }); req.write(data); req.end();
  });
}

function stopMpvViaPipe() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const client = net.createConnection("\\\\.\\pipe\\mpv-socket", () => {
      client.write(`${JSON.stringify({ command: ["quit"] })}\n`);
    });
    client.on("error", finish);
    client.on("close", finish);
    setTimeout(() => { client.destroy(); finish(); }, 900);
  });
}

function execFileSafe(file, args, timeout = 4000) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout, encoding: "utf8" }, (error, stdout) => {
      resolve({ error, stdout: stdout || "" });
    });
  });
}

async function getVaultGitState() {
  if (!isDev) return null;
  const status = await execFileSafe("git", ["-C", PROJECT_ROOT, "status", "--porcelain", "--", VAULT_RELATIVE_PATH]);
  if (status.error) return null;

  const counts = await execFileSafe("git", ["-C", PROJECT_ROOT, "rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
  const [ahead = 0, behind = 0] = counts.error
    ? [0, 0]
    : counts.stdout.trim().split(/\s+/).map(Number);

  return {
    dirty: Boolean(status.stdout.trim()),
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
  };
}

async function showVaultStartupReminder() {
  const state = await getVaultGitState();
  if (!state || (!state.dirty && state.ahead === 0 && state.behind === 0)) return;

  const messages = [];
  if (state.dirty) messages.push("加密数据有尚未提交的更新");
  if (state.behind > 0) messages.push(`远端有 ${state.behind} 个未拉取提交`);
  if (state.ahead > 0) messages.push(`本地有 ${state.ahead} 个未推送提交`);
  await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "数据同步提醒",
    message: messages.join("；"),
    detail: "继续使用前请确认当前电脑已执行 git pull。换到另一台电脑前，请提交 data/what.vault 并执行 git push。",
    buttons: ["知道了"],
  });
}

async function stopProjectServices() {
  if (process.platform !== "win32") return;
  const { stdout } = await execFileSafe("netstat.exe", ["-ano", "-p", "tcp"]);
  const targetPorts = new Set(SERVICE_PORTS.map(String));
  const pids = new Set();

  for (const line of stdout.split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    const localAddress = parts[1] || "";
    const pid = parts.at(-1) || "";
    const port = localAddress.match(/:(\d+)$/)?.[1];
    if (port && targetPorts.has(port) && /^\d+$/.test(pid) && Number(pid) !== process.pid) pids.add(pid);
  }

  await Promise.all([...pids].map((pid) => execFileSafe("taskkill.exe", ["/PID", pid, "/T", "/F"], 5000)));
}

async function stopOwnedMpvProcess() {
  let record;
  try {
    record = JSON.parse(fs.readFileSync(MPV_PID_FILE, "utf8"));
  } catch {
    return;
  }

  const pid = Number(record?.pid);
  const startedAt = Number(record?.startedAt);
  const isRecentRecord = Number.isFinite(startedAt) && Date.now() - startedAt < 7 * 24 * 60 * 60 * 1000;
  if (process.platform === "win32" && Number.isInteger(pid) && pid > 0 && isRecentRecord) {
    await execFileSafe("taskkill.exe", ["/PID", String(pid), "/T", "/F"], 5000);
  }

  try { fs.unlinkSync(MPV_PID_FILE); } catch { /* already removed by Music server */ }
}

async function shutdownRelatedProcesses() {
  await musicPost("/playback/shutdown", {});
  await stopMpvViaPipe();
  await stopOwnedMpvProcess();
  await stopProjectServices();
}

function requestQuit() {
  if (shutdownPromise || quitCheckPromise) return;
  quitCheckPromise = (async () => {
    const state = await getVaultGitState();
    if (state?.dirty && mainWindow && !mainWindow.isDestroyed()) {
      const result = await dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: "加密数据尚未同步",
        message: "本次使用产生的数据还没有提交到项目仓库。",
        detail: "如果准备换到另一台电脑，请退出后提交 data/what.vault 并执行 git push；另一台电脑打开前先执行 git pull。",
        buttons: ["仍然退出", "返回应用"],
        defaultId: 1,
        cancelId: 1,
      });
      if (result.response === 1) {
        quitCheckPromise = null;
        mainWindow.show();
        mainWindow.focus();
        return;
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
    shutdownPromise = shutdownRelatedProcesses()
      .catch(() => {})
      .finally(() => {
        cleanupComplete = true;
        app.quit();
      });
  })();
}

// ── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const icon = createPNG(16, 99, 102, 241);
  tray = new Tray(icon);
  tray.setToolTip("阿潘阿潘潘的工具栈");

  const buildTrayMenu = () => Menu.buildFromTemplate([
    { label: "🏠 显示主窗口", click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: "separator" },
    { label: "▶ 播放 / 暂停", click: async () => { const s = await musicGet("/playback/state"); musicPost("/playback/" + (s?.data?.playing ? "pause" : "resume"), {}); } },
    { label: "⏭ 下一首", click: () => musicPost("/playback/next", {}) },
    { label: "⏮ 上一首", click: () => musicPost("/playback/prev", {}) },
    { type: "separator" },
    { label: "🔊 音量 +10", click: async () => { const s = await musicGet("/playback/state"); musicPost("/playback/volume", { level: Math.min(100, (s?.data?.volume || 70) + 10) }); } },
    { label: "🔉 音量 -10", click: async () => { const s = await musicGet("/playback/state"); musicPost("/playback/volume", { level: Math.max(0, (s?.data?.volume || 70) - 10) }); } },
    { type: "separator" },
    { label: "👤 网易云登录状态", click: () => checkLoginStatus() },
    { label: "退出", click: requestQuit },
  ]);

  tray.setContextMenu(buildTrayMenu());
  setInterval(() => { if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu()); }, 30000);
  tray.on("double-click", () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
}

// ── Login/Logout ─────────────────────────────────────────────────────────────
async function checkLoginStatus() {
  try {
    const info = await musicGet("/user/login-status");
    if (info?.data?.loggedIn) {
      const { response } = await dialog.showMessageBox(mainWindow || undefined, {
        type: "info", title: "网易云登录状态",
        message: `已登录: ${info.data.nickname || "未知用户"}`,
        buttons: ["确定", "退出登录"],
      });
      if (response === 1) {
        await musicPost("/user/logout", {});
        dialog.showMessageBox(mainWindow || undefined, { type: "info", message: "已退出登录", buttons: ["确定"] });
      }
    } else {
      const { response } = await dialog.showMessageBox(mainWindow || undefined, {
        type: "warning", title: "未登录网易云",
        message: "未登录网易云音乐账号",
        detail: "请在终端运行: ncm-cli login\n然后扫码登录",
        buttons: ["确定", "打开终端"],
      });
      if (response === 1) {
        // Open terminal at project root
        require("child_process").exec("start cmd /k cd /d " + path.resolve(__dirname, ".."));
      }
    }
  } catch {
    dialog.showErrorBox("错误", "无法连接 Music 服务");
  }
}

// ── Window Management ────────────────────────────────────────────────────────
async function createMainWindow() {
  const icon = createPNG(16, 99, 102, 241);

  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: "阿潘阿潘潘的工具栈", icon,
    backgroundColor: "#0b0b08",
    frame: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, webviewTag: true },
    show: false,
  });

  // Show window when ready (prevents white flash)
  mainWindow.once("ready-to-show", () => mainWindow.show());

  if (isDev) {
    // Show loading page with progressive status
    for (let pct = 0; pct <= 90; pct += 15) {
      mainWindow.loadURL(getLoadingHTML(pct));
      await sleep(400);
    }

    // Try to connect
    const ok = await retryLoad(mainWindow, `http://localhost:${WORKBENCH_CLIENT_PORT}`, 20, 1500);
    if (!ok) {
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(
        "<!DOCTYPE html><html><head><meta charset=utf-8><style>body{display:flex;align-items:center;justify-content:center;height:100vh;background:#0b1120;color:#ef4444;font-family:sans-serif;flex-direction:column;gap:16px}</style></head><body><h2>⚠ 无法连接到开发服务器</h2><p>请先运行 <code style=background:#1e293b;padding:2px 8px;border-radius:4px;color:#a5b4fc>npm run dev</code> 然后重新打开</p></body></html>"
      )}`);
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "workbench", "client", "dist", "index.html"));
  }

  mainWindow.on("close", (event) => {
    if (!cleanupComplete) {
      event.preventDefault();
      requestQuit();
    }
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require("electron").shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function retryLoad(win, url, maxRetries, delayMs) {
  for (let i = 0; i < maxRetries; i++) {
    try { await win.loadURL(url); return true; }
    catch { if (i < maxRetries - 1) await sleep(delayMs); }
  }
  return false;
}

// ── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Hide default menu bar (File, Edit, View, etc.)
  Menu.setApplicationMenu(null);

  createTray();
  await createMainWindow();
  await showVaultStartupReminder();
});

app.on("before-quit", (event) => {
  if (!ownsInstanceLock || cleanupComplete) return;
  event.preventDefault();
  requestQuit();
});
app.on("activate", () => { if (mainWindow) mainWindow.show(); else createMainWindow(); });

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { ownsInstanceLock = false; app.quit(); }
else app.on("second-instance", () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
