# 阿潘阿潘潘的工具栈 (what)

个人工具栈项目，集成音乐播放、AI 助手、定时器、骑行、健身、旅游等模块。

## 项目结构

```
what/
├── index.html              # 门户页面（导航卡片）
├── Music/                  # 🎵 网易云 + QQ 音乐播放器（已上线）
│   ├── package.json        # npm workspaces: ["client", "server"]
│   ├── client/             # React 19 + Vite 6 + Tailwind 4 + TypeScript
│   ├── server/             # Express 5 + TypeScript（调用 ncm-cli）
│   └── .env                # 【需创建】环境变量
├── workbench/              # 🧠 AI 工作台（已上线）
│   ├── package.json        # npm workspaces: ["client", "server"]
│   ├── client/             # React 19 + Vite 6 + Tailwind 4 + TypeScript
│   ├── server/             # Express 5 + TypeScript（调用 DeepSeek API）
│   └── server/.env         # 【需创建】DeepSeek API Key
├── Tools/                  # 🔧 工具模块（已上线）
│   ├── package.json        # npm workspaces: ["client", "server"]
│   ├── client/             # React 19 + Vite 6 + Tailwind 4 + TypeScript
│   ├── server/             # Express 5 + TypeScript（node-cron 调度等）
│   └── server/             # 定时器、执行历史和日记写入根目录加密仓库
│   └── 子工具: 定时器 ⏰
├── Cycling/                # 🚴 骑行模块（开发中，仅占位 package.json）
├── Fitness/                # 💪 肌肉大（训练、饮食与身体数据管理，已上线）
│   ├── client/             # React 19 + Vite 6 + Tailwind 4 + TypeScript
│   ├── server/             # Express 5 + TypeScript + Zod
│   └── server/             # 健身状态写入同一个加密仓库
└── Travel/                 # ✈️ 旅游模块（开发中，仅占位 package.json）
```

## 技术栈

### 前端（Music/client & workbench/client）
- React 19 + React Router 7
- Vite 6（开发服务器 + 打包）
- Tailwind CSS 4（通过 @tailwindcss/vite 插件）
- TypeScript 5.7（strict 模式）
- Zustand 5（状态管理）
- lucide-react（图标库）

### 后端（各模块 server）
- Express 5 + TypeScript 5.7
- tsx（开发热重载）
- ws（WebSocket）
- Zod（请求验证）
- cors + uuid
- AES-256-GCM 加密数据仓库（Tools 与 Fitness 共用）

### 运行端口
| 模块 | 前端端口 | 后端端口 |
|------|---------|---------|
| Music | 5173 | 3001 |
| Workbench | 5174 | 3000 |
| Tools | 5175 | 3002 |
| Fitness | 5176 | 3003 |

### Vite 代理配置
- Music client 的 `/api` → `http://localhost:3001`，`/ws` → `ws://localhost:3001`
- Workbench client 的 `/api` → `http://localhost:3000`
- Fitness client 的 `/api` → `http://localhost:3003`

## 新电脑完整配置流程

### 推荐：使用图形化安装器

新电脑拉取代码后，直接双击根目录的 `start.vbs` 或 `start.bat`。二者都会打开 `setup.ps1` 图形化安装器。
`start.vbs` 必须保持纯 ASCII、无 BOM；Windows Script Host 无法稳定解析 UTF-8 BOM 的 VBScript 文件。

安装器提供以下能力：

- 自动检测 Node.js 22、Git for Windows、mpv、ncm-cli、项目 npm 依赖和 `.env`；依赖检查会比较锁文件更新时间并验证各工作区直接依赖，代码更新后新增依赖不会被旧 `node_modules` 标记误判为已安装
- 双击后先显示安装器和“正在检测”状态，再执行首次扫描；启动失败会弹窗并写入临时错误日志
- 必需环境全部完成后显示“以后直接启动”；只有用户主动启用后才跳过安装器，任何必需项缺失都会强制恢复显示（可选 Git 不阻塞）
- “启动后自动关闭”默认开启；项目进程拉起后约 0.8 秒关闭安装器，可取消勾选以保留窗口，选择会记入本机偏好
- 已安装项自动跳过，显示检测到的版本
- 支持单选、多选、“仅安装选择项”和“一键安装全部并启动”
- 自动按 Node → Git → mpv → ncm-cli → 项目依赖 → 环境配置的顺序处理；Git 是默认不勾选的可选项
- 显示总体进度、当前项目、持续更新的已用时间和详细安装日志；失败项可单独重试
- 首次检测和“重新检测”会立即禁用重复操作、显示滚动进度条与“检测中”状态，检测完成后显示 100% 和缺失项数量
- Worker 强制使用 UTF-8/代码页 65001 采集 WinGet 与 npm 输出；npm warning 会记录但不再误判为安装失败
- npm 安装使用明确的网络超时与自动重试；优先使用 npmmirror 国内镜像，失败后自动切换官方源，设置会传递给各子项目安装
- 后台安装进程意外退出时立即恢复可操作状态并弹窗提示，不会一直停留在“执行中”
- 安装期间可点击“取消安装”；关闭窗口也会先终止本次 Worker 及其 npm 子进程，避免残留安装相互占用目录
- 自动创建 `Music/server/.env`、`workbench/server/.env`，并写入本机 ncm-cli 路径
- 提供隐藏输入框保存 DeepSeek API Key，并同时写入两份 `.env`；密钥不会显示或进入安装日志
- 提供“申请密钥”入口；未配置时启动前会明确提醒 AI 功能不可用
- 已有 `.env` 内容会保留，不覆盖 API Key、端口等用户配置

也可直接运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File .\setup.ps1

# 仅输出 JSON 检测结果，不打开窗口、不安装
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -CheckOnly

# 即使启用了“以后直接启动”，仍强制打开安装器
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File .\setup.ps1 -ForceShow
```

> mpv 通过 WinGet 包 `shinchiro.mpv` 安装。如果系统缺少 WinGet，需要先从 Microsoft Store 安装或修复“应用安装程序”。Node.js 在 WinGet 不可用时会从 Node.js 官方 `latest-v22.x` 下载，并校验官方 SHA-256。

### 首次安装后的用户配置

安装器可以创建可启动的 `.env`，并提供安全输入框保存用户自己的密钥：

- 点击“申请密钥”打开 DeepSeek API Keys 页面，创建后粘贴到安装器并点击“保存密钥”
- 同一个 Key 会写入 `Music/server/.env` 和 `workbench/server/.env` 的 `ANTHROPIC_AUTH_TOKEN`；Tools 复用 workbench 配置
- 在 Music 客户端右上角进入“账号与服务设置”，可分别扫描网易云和 QQ 音乐二维码登录；Cookie 自动保存到本机 `.env`
- 也可运行 `npm run login`，在终端扫描二维码登录网易云
- QQ 音乐公开搜索、歌词和榜单无需登录；扫码登录后主页会读取“我喜欢”、创建歌单和收藏歌单，会员/版权受限歌曲也会使用该登录态
- QQ 首页的“我喜欢”、创建歌单和收藏歌单均可进入独立详情页，支持单曲与整单播放；非首页页面可使用顶栏返回按钮回到上一步
- 整个 Electron 工作台采用 QQ 音乐桌面端风格：全局使用窄图标侧栏、透明顶栏、灰蓝玻璃表面与 QQ 绿强调色；Workbench、Music、Tools、Fitness 共享同一视觉令牌，Music 嵌入时复用工作台顶栏而不重复显示内部导航
- 网易云与 QQ 音乐共用同一个 QQ 音乐风格的沉浸式“正在播放”页面：封面以“全屏模糊底图 + 灰蓝雾幕 + 左侧高亮清晰图 + 多方向羽化遮罩”合成；清晰层按原比例装入最大 420px 的正方形区域，不裁切、不额外放大，并在雾幕上方轻微增强亮度、对比度和饱和度，中心清晰而四周渐隐融入背景；歌词固定在右半区居中，当前歌词及关键控制使用 QQ 绿
- 播放页为底部进度与控制栏预留独立空间；歌词可视区限制为 46vh/最大 400px，取消整体向下偏移，首尾定位留白按歌词容器自身高度计算，不会压到进度条
- 网易云与 QQ 的歌单、收藏、每日推荐、搜索结果和榜单点歌时会保留所选歌曲之后的列表上下文，当前歌曲结束后自动续播下一首
- Electron 无边框窗口始终显示自绘的最小化、最大化和关闭按钮；所有嵌入 webview 从顶栏下方开始布局，避免其覆盖 56px 窗口控制点击区。关闭按钮、Alt+F4 和托盘“退出”会真正退出应用：依次通过 Music API、专用 named pipe 和临时 PID 记录关闭本应用创建的 mpv，再清理 Tools、Fitness、Music、Workbench 的前后端监听进程；PID 兜底只结束关联播放器及其子进程，不按进程名误杀其他 mpv；最小化按钮仍只最小化，不停止音乐
- DeepSeek API Key 可在安装器或 Music“账号与服务设置”中配置，密钥只写入本机且不会回显
- `.env` 格式可参考 `Music/server/.env.example` 和 `workbench/server/.env.example`
- 首次进入工作台需输入数据密码。密码只用于运行时验证和密钥派生，不写入仓库文件或项目文档
- 解锁页采用与工作台一致的灰蓝玻璃与 QQ 绿设计：双栏说明数据保护方式，提供连接中、解锁中和内联错误状态；Electron 锁屏时仍显示最小化、最大化和关闭按钮。进入工作台后会定期检查 Tools 与 Fitness 的解锁状态，任一服务重启并重新上锁时自动返回密码页
- 定时器、执行历史、日记和 Fitness 数据统一保存在根目录 `data/what.vault`。文件使用随机盐、PBKDF2-SHA256 和 AES-256-GCM 加密，Git 会忽略该文件

### 手动安装备用流程

```powershell
# Node.js 22 LTS
winget install --id OpenJS.NodeJS.LTS -e

# Git for Windows（可选，用于提交并上传 GitHub）
winget install --id Git.Git -e

# Music 播放器
winget install --id shinchiro.mpv -e

# 网易云 CLI
npm install -g @music163/ncm-cli

# 根目录执行一次即可；postinstall 会安装三个子模块
npm install
```

### 获取 DeepSeek API Key

1. 访问 https://platform.deepseek.com
2. 注册/登录
3. 进入 API Keys 页面创建 Key
4. 充值或确认有可用额度
5. 将 Key 填入两个 .env 文件

### 启动项目

```powershell
# 图形化检测后启动（推荐）
.\start.bat

# 已安装完成时直接启动完整 Electron 版本
npm run dev

# 只启动 Web 服务
npm run dev:web
```

### 访问

- 门户页面：用浏览器打开 `what/index.html`
- AI 工作台：http://localhost:5174
- 音乐播放器：http://localhost:5173
- 定时器：http://localhost:5175（工具模块首页）

## 启动验证清单

| # | 检查项 | 验证命令 / 方法 |
|---|--------|----------------|
| 1 | Node.js ≥ 22 | `node -v` |
| 2 | npm | `npm -v` |
| 3 | mpv 播放器 | `mpv --version` |
| 4 | ncm-cli 已安装 | `ncm-cli --version` |
| 5 | ncm-cli 已登录 | `ncm-cli state`（显示播放状态即成功） |
| 6 | git clone 完成 | `git log -1` |
| 7 | Music 依赖已安装 | `ls Music/node_modules/.package-lock.json` 存在 |
| 8 | Workbench 依赖已安装 | `ls workbench/node_modules/.package-lock.json` 存在 |
| 9 | Tools 依赖已安装 | `ls Tools/node_modules/.package-lock.json` 存在 |
| 10 | `.env` 文件已创建 | `cat Music/server/.env workbench/server/.env` |
| 11 | DeepSeek API Key 已配置 | 安装器显示“已配置”；有效性需启动 workbench 后发送消息测试 |
| 12 | Music server 启动 | `curl http://localhost:3001/api/playback/state` |
| 13 | Workbench server 启动 | `curl http://localhost:3000/api/chat` |
| 14 | Tools server 启动 | `curl http://localhost:3002/api/health` |

## 依赖关系图

```
workbench/server ──HTTP──► Music/server ──CLI──► ncm-cli ──► mpv
       │                                                    │
       │ HTTP (DeepSeek API)                                │ WebSocket
       ▼                                                    ▼
  api.deepseek.com                              Music/client ←── ws://localhost:3001
                                                            │
workbench/client ──WebSocket────────────────────────────────┘
       │
       │ HTTP /api
       ▼
  workbench/server
```

## Music 服务器 API 端点

| 路由 | 用途 |
|------|------|
| `/api/playback/state` | 播放状态 |
| `/api/playback/play-song` | 播放歌曲 |
| `/api/playback/play-playlist` | 播放歌单 |
| `/api/playback/pause` | 暂停 |
| `/api/playback/resume` | 恢复 |
| `/api/playback/stop` | 停止 |
| `/api/playback/next` | 下一首 |
| `/api/playback/prev` | 上一首 |
| `/api/playback/seek` | 跳转 |
| `/api/playback/volume` | 音量 |
| `/api/playback/queue` | 队列 |
| `/api/search/songs` | 搜索歌曲；`provider=netease|qq` 选择音源 |
| `/api/search/playlists` | 搜索歌单 |
| `/api/search/albums` | 搜索专辑 |
| `/api/recommend/daily` | 每日推荐 |
| `/api/user/liked` | 喜欢的歌曲 |
| `/api/song/:id/lyric` | 歌词 |
| `/api/playlist/created` | 创建的歌单 |
| `/api/playlist/collected` | 收藏的歌单 |
| `/api/settings/status` | 音乐账号与 AI 配置状态（不返回密钥/Cookie） |
| `/api/settings/ai` | 保存 DeepSeek API Key、地址和模型 |
| `/api/settings/qq/login-qr` | 获取 QQ 登录二维码 |
| `/api/settings/qq/login-check` | 检查 QQ 扫码状态并保存 Cookie |
| `/api/settings/qq/logout` | 退出 QQ 音乐登录 |
| `/api/qq/home` | QQ 音乐账号歌单信息，以及热歌、流行指数、新歌榜的原始榜单内容 |
| `/api/qq/playlist/:id` | QQ 音乐歌单详情与完整歌曲列表 |
| `/api/theme/cover-image` | 受限代理 QQ/网易云专辑封面，供本地播放器提取动态主题色 |

## Tools 服务器 API 端点（定时器）

| 路由 | 用途 |
|------|------|
| `/api/timer` | 获取所有定时器 |
| `/api/timer` (POST) | 创建定时器 |
| `/api/timer/:id` | 获取单个定时器 |
| `/api/timer/:id` (PUT) | 更新定时器 |
| `/api/timer/:id` (DELETE) | 删除定时器 |
| `/api/timer/:id/toggle` | 启用/禁用 |
| `/api/timer/:id/trigger` | 手动触发执行 |
| `/api/timer/:id/history` | 执行历史 |
| `/api/timer/history/all` | 全部执行历史 |
| `/api/health` | 健康检查 |

## Fitness 服务器 API 端点（肌肉大）

| 路由 | 用途 |
|------|------|
| `/api/fitness/state` | 获取个人资料、训练计划、训练/饮食/体重记录 |
| `/api/fitness/foods` | 获取内置常见食物名称 |
| `/api/fitness/foods/calculate` (POST) | 解析食物分量、`/` 分隔整餐和中文数量词；也支持每100克/每百毫升的 kJ/kcal 营养标签与实际摄入量换算 |
| `/api/fitness/routine` (PUT) | 保存全局固定起床和睡觉时间 |
| `/api/fitness/sessions` (POST) | 新增每日计划；单个计划可包含多条活动和可动态配置的训练动作，四餐文本自动估算并保存热量与三大营养素 |
| `/api/fitness/sessions/:id` (PUT) | 编辑已有每日计划、嵌套活动、训练动作及四餐营养估算 |
| `/api/fitness/sessions/:id` (DELETE) | 删除每日计划（包括内置计划，历史运动记录保留） |
| `/api/fitness/profile` (PUT) | 保存资料并重新计算热量和营养目标 |
| `/api/fitness/meals` (POST) | 添加饮食记录 |
| `/api/fitness/meals/:id` (DELETE) | 删除饮食记录 |
| `/api/fitness/workouts` (POST) | 保存逐组训练记录，支持重量＋次数、仅次数及按秒计时动作 |
| `/api/fitness/weights` (POST) | 新增或覆盖当天身体数据 |
| `/api/health` | 健康检查 |

### 定时器数据模型

```json
{
  "id": "uuid",
  "name": "定时器名称",
  "description": "描述",
  "cronExpression": "*/5 * * * *",
  "taskType": "http-request | shell-command",
  "taskConfig": {
    "url": "https://...",
    "method": "GET|POST",
    "body": "...",
    "command": "echo hello"
  },
  "enabled": true,
  "lastRunAt": "ISO timestamp",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

## Tools 服务器配置项

配置通过 `Tools/server/src/config.ts` 从环境变量读取：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3002` | 服务器端口 |
| `CORS_ORIGIN` | `http://localhost:5175` | 允许的跨域来源 |
| `vaultFile` | `data/what.vault` | 根目录加密数据仓库；由代码固定定位，无需环境变量 |

## Fitness 服务器配置项

Fitness 与 Tools 共用根目录的加密数据仓库，服务重启后需再次输入密码解锁。

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3003` | 服务器端口 |
| `vaultFile` | `data/what.vault` | 与 Tools 共用的 AES-256-GCM 加密文件 |

## Music 服务器配置项

配置通过 `Music/server/src/config.ts` 从环境变量读取：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3001` | 服务器端口 |
| `NCM_CLI_PATH` | `%APPDATA%\npm\ncm-cli.cmd` | ncm-cli 可执行文件路径；安装器会写入检测到的绝对路径 |
| `THEME_IMAGES_DIR` | `../client/public/images` | 主题背景图目录 |
| `ANTHROPIC_BASE_URL` | `https://api.deepseek.com/anthropic` | LLM API 地址 |
| `ANTHROPIC_AUTH_TOKEN` | (空) | DeepSeek API Key |
| `ANTHROPIC_MODEL` | `deepseek-v4-pro` | 模型名称 |
| `CORS_ORIGIN` | `http://localhost:5173` | 允许的跨域来源 |
| `NETEASE_COOKIE` | (空) | 网易云登录 Cookie |
| `QQ_MUSIC_COOKIE` | (空) | QQ 音乐 Cookie；会员/版权受限歌曲播放时需要 |

## Workbench 服务器配置项

配置通过 `workbench/server/src/config.ts` 从环境变量读取：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3000` | 服务器端口 |
| `ANTHROPIC_BASE_URL` | `https://api.deepseek.com/anthropic` | LLM API 地址 |
| `ANTHROPIC_AUTH_TOKEN` | (空) | DeepSeek API Key |
| `ANTHROPIC_MODEL` | `deepseek-v4-pro` | 模型名称 |
| `CORS_ORIGIN` | `http://localhost:5174` | 允许的跨域来源 |
| `MUSIC_API_URL` | `http://localhost:3001` | Music 服务器地址 |

## 常见问题

### SSL/SChannel 连接错误
```bash
# Git fetch/push 报 schannel 错误时，检查 SSL 后端
git config --global http.sslBackend
# 应返回 schannel（Windows 原生）。如果被改成 openssl 反而会连不上
git config --global http.sslBackend schannel
```

### Git 用户配置
```bash
git config --global user.email "laopangy438711@163.com"
git config --global user.name "潘高远"
```

### npm install 报错
```bash
# 清除缓存后重试
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 端口被占用
```bash
# 查看占用端口的进程
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :5173
netstat -ano | findstr :5174
```
