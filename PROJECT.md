# 阿潘阿潘潘的工具栈 (what) — 项目功能与逻辑文档

> **维护规则**：任何功能或逻辑变更后，必须同步更新本文档中对应的章节，并在文末的「变更记录」表中追加一条记录。

---

## 目录

1. [项目概览](#1-项目概览)
2. [系统架构](#2-系统架构)
3. [门户页面](#3-门户页面)
4. [Music 模块（音乐播放器）](#4-music-模块音乐播放器)
   - 4.1 [架构概览](#41-架构概览)
   - 4.2 [前端架构](#42-前端架构)
   - 4.3 [后端架构](#43-后端架构)
   - 4.4 [核心数据流](#44-核心数据流)
   - 4.5 [API 端点](#45-api-端点)
   - 4.6 [登录认证系统](#46-登录认证系统)
   - 4.7 [主题系统](#47-主题系统)
5. [Workbench 模块（AI 工作台）](#5-workbench-模块ai-工作台)
   - 5.1 [架构概览](#51-架构概览)
   - 5.2 [前端架构](#52-前端架构)
   - 5.3 [后端架构](#53-后端架构)
   - 5.4 [核心数据流](#54-核心数据流)
   - 5.5 [工具插件系统](#55-工具插件系统)
   - 5.6 [Tools 模块](#56-tools-模块)
6. [Electron 桌面客户端](#6-electron-桌面客户端)
7. [待开发模块](#7-待开发模块)
8. [端口与代理配置](#8-端口与代理配置)
9. [配置项参考](#9-配置项参考)
10. [技术栈汇总](#10-技术栈汇总)
11. [变更记录](#11-变更记录)

---

## 1. 项目概览

**项目名称**：阿潘阿潘潘的工具栈 (what)

**定位**：个人全栈工具平台，集成音乐播放、AI 助手、骑行、健身、旅游等模块。

**当前状态**：

| 模块 | 状态 | 说明 |
|------|------|------|
| 门户页面 | ✅ 已上线 | `index.html`，模块导航入口 |
| Music | ✅ 已上线 | 网易云音乐播放器（Web 控制面板 + Electron 客户端） |
| Workbench | ✅ 已上线 | AI 对话助手（可语音/文字操控各模块） |
| Electron | ✅ 已上线 | 桌面客户端（主进程 + 托盘 + 打包） |
| Cycling | 🚧 占位 | 仅 `package.json` |
| Fitness（肌肉大） | ✅ 已上线 | 训练计划、逐组打卡、饮食记录、营养目标和身体趋势 |
| Travel | 🚧 占位 | 仅 `package.json` |

**仓库地址**：`https://github.com/laopangy/what`

---

## 2. 系统架构

### 2.1 整体依赖关系

```
┌──────────────────────────────────────────────────────────────┐
│                   Electron 桌面客户端                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  主进程 (electron/main.js)                               │  │
│  │  • 窗口管理（主窗口 Workbench）                             │  │
│  │  • 系统托盘（右键菜单控制播放 + 登录状态检查）                │  │
│  │  • 防多实例（requestSingleInstanceLock）                  │  │
│  └────────────┬──────────────────────────────────────────┘  │
│               │ 渲染进程                                      │
│               ▼                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Workbench (AI 工作台) :5174                            │    │
│  │  • MusicEmbed (webview → Music :5173)                  │    │
│  │  • /api → :3000  Workbench server                      │    │
│  │  • /api/music → :3001  Music server (proxy)            │    │
│  └────────────┬─────────────────────────────────────────┘    │
│               │ /api                                           │
│               ▼                                               │
│  ┌──────────────────────┐  ┌──────────────────────────┐      │
│  │  Workbench server    │  │   Music server            │      │
│  │  :3000               │  │   :3001                   │      │
│  │                      │  │                           │      │
│  │  chatService ────────┼──▶ DeepSeek API              │      │
│  │  musicPlugin ────────┼──▶ Music Server API          │      │
│  └──────────────────────┘  │                           │      │
│                            │  mpvController ────▶ mpv  │      │
│                            │   (JSON IPC 直连)          │      │
│                            │  authHelper ──▶ ncm-cli   │      │
│                            │  wsManager ──▶ WebSocket  │      │
│                            └──────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 关键架构变更（2025-06）

- **mpv 直连控制**：因 ncm-cli v0.1.5 `play --song --encrypted-id` 的 bug，Music server 改为通过 mpv JSON IPC named pipe 直接控制播放。`ncm-cli` 仅用于搜索、歌单、推荐等数据操作，不再用于播放控制。
- **登录认证系统**：新增网易云音乐扫码登录流程（QR code），通过 `NETEASE_COOKIE` 环境变量支持 VIP 歌曲完整播放。
- **多音源搜索与播放**：搜索页可切换网易云音乐与 QQ 音乐；QQ 音乐接入歌曲搜索、播放 URL 和歌词，复用现有 mpv 播放链路。
- **统一账号与服务设置**：Music 客户端提供网易云/QQ 双二维码登录、退出登录和 DeepSeek API Key 配置；音乐账号 Cookie 与 AI 密钥均只保存在本机且不回显。网易云未登录不再阻塞整个播放器，QQ 搜索和公开歌曲可独立使用。
- **双音源 Music 主页**：主页顶部可切换网易云与 QQ 音乐并记住选择；网易云保留每日推荐、收藏、歌单和最近播放；QQ 音乐读取扫码账号的“我喜欢”、创建歌单和收藏歌单，歌单可进入详情并播放单曲或全部歌曲；同时通过当前榜单接口分别展示热歌、流行指数和新歌榜，保留榜单原始顺序与内容。
- **应用内返回导航**：非首页页面在顶栏显示返回按钮，优先返回上一次应用内操作；直接打开深层链接且没有可返回历史时安全回到 Music 首页。
- **全局 QQ 音乐视觉系统**：Electron 工作台改为 78px 半透明图标轨道、全局透明导航/搜索栏和一体化窗口控制；Workbench、Music、Tools、Fitness 统一使用灰蓝表面、低对比白色文字和 QQ 绿强调色。Music 作为 webview 嵌入时隐藏内部重复顶栏，全局搜索可直接打开 Music 搜索结果。
- **QQ 音乐风格播放页**：“正在播放”由网易云与 QQ 音乐共用：同源封面全屏放大模糊作为环境底图，灰蓝雾幕统一不同专辑的明暗；左侧清晰图按原比例装入最大 420px 的正方形区域，不使用 `object-cover` 放大裁切，并置于雾幕上方轻微增强亮度、对比度和饱和度，右/上/下多方向遮罩让高亮主体的四周渐隐融入背景。歌词固定在右半区居中，当前歌词及关键操作使用 QQ 绿，控制栏贴合底边。直接打开页面会立即同步当前播放状态，歌词只滚动自身容器，不带动整页。
- **列表连续播放**：网易云与 QQ 的歌单、收藏、每日推荐、搜索结果和榜单点击任意歌曲时，会从所选歌曲开始将后续歌曲一并加入播放队列；当前歌曲结束后由 mpv 自动续播下一首。

### 2.3 npm Workspaces 组织

```
what/                          # 仓库根目录（Electron 入口）
├── package.json               # Electron + concurrently 启动脚本
├── electron/                  # Electron 主进程
│   ├── main.js
│   └── preload.js
├── Music/                     # npm workspace 根
│   ├── package.json           # workspaces: ["client", "server"]
│   ├── client/                # React 19 + Vite 6 前端
│   └── server/                # Express 5 后端
├── workbench/                 # npm workspace 根
│   ├── package.json           # workspaces: ["client", "server"]
│   ├── client/                # React 19 + Vite 6 前端
│   └── server/                # Express 5 后端
├── scripts/
│   └── clean-ports.js         # 启动前清理端口占用
├── setup.ps1                  # Windows 图形化环境检测、选择安装与启动
├── start.bat                  # 命令行入口：打开 setup.ps1
└── start.vbs                  # 无控制台入口：打开 setup.ps1
```

---

## 3. 门户页面

**文件**：`index.html`

**功能**：
- 纯静态 HTML 页面，无构建依赖
- 展示 4 张导航卡片 + 1 个主推卡片
- 主推卡片（Workbench）带有视觉强调样式，链接到 `http://localhost:5174`
- Music 卡片链接到 `Music/client/dist/index.html`（构建产物）
- Fitness 卡片链接到 `http://localhost:5176`；Cycling / Travel 仍为禁用状态
- 深色主题、渐变背景、hover 动效

**逻辑要点**：
- 无 JavaScript 逻辑，纯展示 + 超链接
- `.card.disabled` 禁用 hover 效果和点击
- 使用 CSS 自定义属性（`--bg`, `--surface`, `--accent` 等）统一配色

---

## 4. Music 模块（音乐播放器）

### 4.1 架构概览

```
浏览器 (localhost:5173)  /  Electron webview
    │
    ├── HTTP /api/* ──▶ Vite Proxy ──▶ Express Server (localhost:3001)
    │                                        │
    │                                        ├── mpvController (直接 JSON IPC)
    │                                        │   └── mpv 播放器
    │                                        │       (named pipe: \\.\pipe\mpv-socket)
    │                                        │
    │                                        ├── ncmExecutor (ncm-cli)
    │                                        │   └── NeteaseCloudMusic API
    │                                        │       (搜索/歌单/推荐/歌词)
    │                                        │
    │                                        └── authHelper
    │                                            ├── ncm-cli login --check
    │                                            └── NeteaseCloudMusicApi.login_status
    │
    └── WebSocket /ws ──▶ Vite Proxy ──▶ WebSocket Server (同 :3001)
                                             │
                                             └── 每 15s 轮询 mpv IPC getState()
                                                 广播给所有客户端
```

> **注意**：播放控制（play/pause/resume/stop/next/prev/seek/volume）通过 mpv IPC 直接操作，不再经过 ncm-cli。搜索、歌单、推荐、歌词等**数据操作**仍通过 ncm-cli。

### 4.2 前端架构

#### 路由表

| 路径 | 组件 | 功能 |
|------|------|------|
| `/` | `MusicHome` | 智能首页：播放中 → NowPlaying，空闲 → 网易云/QQ 双音源 HomePage |
| `/now-playing` | `NowPlaying` | 正在播放（封面 + 歌词） |
| `/search` | `SearchPage` | 网易云/QQ 音源切换；搜索歌曲，网易云另支持歌单/专辑 |
| `/playlists` | `PlaylistBrowser` | 我的歌单（创建/收藏） |
| `/playlist/:id` | `PlaylistDetail` | 歌单详情 + 歌曲列表 |
| `/daily` | `DailyRecommend` | 每日推荐 |
| `/liked` | `LikedSongs` | 我喜欢的音乐 |
| `/queue` | `QueueView` | 播放队列 |
| `/settings` | `SettingsPage` | 网易云/QQ 扫码登录、退出登录及 DeepSeek API 设置 |

> **注意**：路由 `/` 移除了 `Navigate` 重定向，改为 `MusicHome` 智能组件。点击 Header 中的"首页"按钮通过 `forceHome` state 强制显示 HomePage。

#### 组件树

```
App
└── AppLayout（登录非阻塞，账号状态集中在 SettingsPage）
    ├── Header（顶部导航栏）
    │   ├── Logo（→ 首页 forceHome）
    │   ├── 首页按钮（forceHome: Date.now()）
    │   ├── 搜索按钮（→ /search）
    │   └── 正在播放按钮（→ /now-playing）
    ├── <Routes>（主内容区）
    │   ├── MusicHome（智能路由：暂停时 HomePage / 播放时 NowPlaying）
    │   ├── HomePage（仪表盘首页）
    │   │   ├── 每日推荐 HeroCard
    │   │   ├── 我喜欢的 HeroCard
    │   │   ├── 我的歌单 PlaylistTile[]
    │   │   └── 最近播放 HistoryRow[]
    │   ├── NowPlaying
    │   │   ├── 专辑封面（可旋转）
    │   │   ├── 歌曲信息 + 收藏按钮
    │   │   ├── 进度条（可拖拽）
    │   │   ├── 播放控制（上/下/播放/暂停）
    │   │   ├── 音量滑块
    │   │   └── LyricsPanel（滚动歌词）
    │   ├── SearchPage
    │   │   ├── 搜索框 + 类型切换 Tab
    │   │   └── TrackRow[] / PlaylistCard[]
    │   ├── PlaylistBrowser
    │   │   └── PlaylistCard[]
    │   ├── PlaylistDetail
    │   │   ├── 歌单信息 + 播放全部
    │   │   └── TrackRow[]
    │   ├── DailyRecommend → TrackRow[]
    │   ├── LikedSongs → TrackRow[]
    │   └── QueueView → 队列列表
    ├── LoginPrompt（未登录时覆盖全屏）
    │   ├── 品牌标语
    │   ├── QR 二维码（qrcode.react 生成）
    │   └── 刷新/浏览器打开/状态轮询
    └── MusicBar（底部固定播放栏）
        ├── 可视化指示器
        ├── 歌曲信息
        ├── 播放控制
        ├── 进度条
        └── 音量滑块
```

#### 状态管理（Zustand）

**playbackStore**（`stores/playbackStore.ts`）：

| 字段/方法 | 类型 | 说明 |
|-----------|------|------|
| `playing` | `boolean` | 是否正在播放 |
| `song` | `{ name, artist, duration, position }?` | 当前歌曲信息 |
| `volume` | `number` | 音量 0-100 |
| `currentSongId` | `string?` | 当前歌曲加密 ID（用于歌词获取） |
| `lyrics` | `LyricLine[]` | 解析后的歌词数组 |
| `localPosition` | `number` | 客户端推算的播放位置（秒） |
| `lastUpdateTime` | `number` | 上次位置更新的时间戳 |
| `lastSeekTime` | `number` | 上次 seek 操作的时间戳 |
| `update(state)` | 方法 | 接收服务端状态，智能合并位置 |
| `tick()` | 方法 | 推算当前播放位置（`localPosition + elapsed`） |
| `togglePlay()` | 方法 | 切换播放/暂停，冻结当前位置 |
| `seekTo(seconds)` | 方法 | 跳转到指定位置 |

**themeStore**（`stores/themeStore.ts`）：

| 字段/方法 | 类型 | 说明 |
|-----------|------|------|
| `selectedImage` | `string?` | 当前选中的主题图片文件名 |
| `availableImages` | `string[]` | 可用的主题图片列表 |
| `colors` | `ThemeTokens?` | 提取的颜色 Token |
| `fetchImages()` | 方法 | 从服务端获取可用图片列表 |
| `selectImage(filename)` | 方法 | 选择图片 → 提取颜色 → 应用主题 |
| `resetToDefault()` | 方法 | 恢复默认主题 |
| `_hydrate()` | 方法 | 从 localStorage 恢复主题 |

#### 核心 Hook

**usePlaybackState**：
1. 订阅 WebSocket `playback:state` 事件
2. 收到状态后调用 `playbackStore.update()` 更新 store
3. 检测歌曲切换 → 自动调用 `playbackApi.volume()` 将当前音量同步到 mpv

**useLyrics(songId?)**：
1. 有 `songId` → 直接用 ID 获取歌词
2. 无 `songId` 但有 `song` → 先用 `searchApi.songs()` 搜索匹配歌曲获取 ID，再获取歌词
3. 解析 LRC 格式：正则匹配 `[mm:ss.xx]text` → 排序后的 `LyricLine[]`
4. 歌曲消失时清空歌词

**useTheme**：
- 组件挂载时调用 `themeStore._hydrate()` 恢复主题

#### WebSocket 客户端（`api/socket.ts`）

- 连接 `ws://localhost:5173/ws`（经 Vite 代理到 `:3001`）
- 自动重连，指数退避（1s → 2s → 4s → ... → 最大 30s）
- 连接成功后自动发送 `subscribe:playback` 订阅消息
- 基于事件名分发回调（发布-订阅模式）

### 4.3 后端架构

#### 服务启动流程

```
index.ts
  │
  ├── 1. dotenv 加载 .env（手动 + override）
  ├── 2. 加载 cors、json 中间件
  ├── 3. 挂载路由（playback, search, playlist, recommend, user, song, theme）
  ├── 4. 注册 /api/health 健康检查
  ├── 5. 注册 errorHandler
  ├── 6. createServer(app) → setupWebSocket(server)
  └── 7. server.listen(3001)
```

#### 核心服务

**mpvController**（`services/mpvController.ts`）— 🆕 **mpv 直连控制**：

- **职责**：通过 JSON IPC named pipe（`\\.\pipe\mpv-socket`）直接操控 mpv 播放器
- **原因**：ncm-cli v0.1.5 `play --song --encrypted-id` 存在 bug，无法启动播放进程
- **启动 mpv**：`spawn(mpv.com, ["--input-ipc-server=<pipe>", "--idle=yes", "--no-video", ...])`
- **进程管理**：`ensureMpv()` 确保 mpv 在运行（自动启动/重连），`stopMpv()` 发送 quit + kill
- **播放控制**（全部通过 IPC）：
  - `playUrl(url)` — 加载 URL 播放
  - `playPlaylist(tracks)` — 加载歌单播放
  - `pause()` / `resume()` / `stop()` — 播放状态切换
  - `next()` / `prev()` — 上下首
  - `seek(seconds)` / `setVolume(level)` — 进度/音量
  - `shufflePlaylist()` — 随机播放
  - `setLoop(mode)` — 循环模式（none/single/list）
- **状态查询**：
  - `getState()` — 轮询用（查询 pause + time-pos + playlist-pos）
  - `getFullState()` — 完整状态（pause + duration + time-pos + volume）
- **元数据追踪**：自维护 `currentMeta` 和 `playlistTracks` 数组（mpv 只知文件名不知歌曲名）

**ncmExecutor**（`services/ncmExecutor.ts`）：

- **职责**：封装 `ncm-cli` 命令行调用（仅用于数据操作，不用于播放控制）
- **命令构建**：`ncm-cli.cmd <command> <args...> --output json`
- **缓存策略**：

| 命令前缀 | TTL | 说明 |
|----------|-----|------|
| `state` | 5s | 播放状态 |
| `search` | 120s | 搜索结果 |
| `playlist` | 60s | 歌单数据 |
| 其他 | 30s | 默认 |

- **Mutation 检测**：`play/pause/resume/stop/next/prev/seek/volume/like/dislike` 以及带子命令的 `queue` 被视为变更操作，执行后清空所有缓存
- **超时**：30s，maxBuffer：10MB

**authHelper**（`services/authHelper.ts`）— 🆕 **登录认证辅助**：

- `isLoggedIn()` — 双重检测：① `ncm-cli login --check`（快速） → ② `NeteaseCloudMusicApi.login_status()`（cookie 兜底）
- `getLoginQr()` — 调用 `ncm-cli login --background` 获取扫码链接，已登录则返回 null

**wsManager**（`services/wsManager.ts`）：

- **职责**：WebSocket 服务器，实时推送播放状态
- **轮询机制**：
  - 第一个客户端连接时启动定时轮询（默认 15s 间隔，通过 `config.playback.pollIntervalMs` 配置）
  - 最后一个客户端断开时停止轮询
  - 每次轮询调用 `mpvController.getState()` → 与上次状态比较
  - 仅状态变化时广播
- **手动通知**：`notifyPlaybackChange()` 重置 lastState 缓存，强制下次轮询立即广播
- **连接管理**：维护 `Set<WebSocket>`，自动清理断开的连接

#### 路由实现

**playback.ts** — 播放控制（🔄 核心变更：从 ncm-cli 改为 mpvController）：

| 端点 | 方法 | 关键逻辑 |
|------|------|----------|
| `/state` | GET | `mpvController.getFullState()` → normalizeState |
| `/play-song` | POST | ① 数字ID→通过 NeteaseCloudMusicApi 获取URL → `mpvController.playUrl(url)` ② 加密ID→先获取URL → `mpvController.playUrl(url)` |
| `/play-playlist` | POST | 获取歌单所有歌曲URL → `mpvController.playPlaylist(tracks)` |
| `/play-songs` | POST | 🆕 批量播放歌曲列表 |
| `/pause` | POST | `mpvController.pause()` |
| `/resume` | POST | `mpvController.resume()` |
| `/stop` | POST | `mpvController.stop()` |
| `/next` | POST | `mpvController.next()` |
| `/prev` | POST | `mpvController.prev()` |
| `/seek` | POST | `mpvController.seek(seconds)` |
| `/volume` | POST | `mpvController.setVolume(level)` (0-100) |
| `/shuffle` | POST | 🆕 `mpvController.shufflePlaylist()` |
| `/loop` | POST | 🆕 `mpvController.setLoop(mode)` (none/single/list) |
| `/queue` | GET | `mpvController.getPlaylist()` |
| `/queue/add` | POST | 获取URL → `mpvController.appendToPlaylist(url)` |
| `/queue/remove` | POST | 🆕 `mpvController.removeFromPlaylist(index)` |
| `/queue/clear` | POST | `mpvController.stop()` + 清空 playlistTracks |

**user.ts** — 🆕 新增登录认证路由：

| 端点 | 方法 | 关键逻辑 |
|------|------|----------|
| `/login-status` | GET | 🆕 `authHelper.isLoggedIn()` → `{ loggedIn, nickname? }` |
| `/login-qr` | POST | 🆕 `authHelper.getLoginQr()` → `{ qrCodeUrl, message }` |
| `/logout` | POST | 🆕 `ncm-cli login --logout` |
| `/profile` | GET | `ncm-cli user info` |
| `/history` | GET | `ncm-cli user history --limit N` |
| `/liked` | GET | 先 `ncm-cli user favorite` 获取歌单 ID → `ncm-cli playlist tracks` 获取歌曲 |

**search.ts** — 搜索：

- 支持 `song` / `playlist` / `album` / `all` 四种类型
- 统一映射函数 `mapSong()` / `mapPlaylist()` 转换 ncm-cli 输出
- 兼容 `{ code: 200, data: { records: [...] } }` 和直接 `{ records: [...] }` 格式

**playlist.ts** — 歌单管理：

- `GET /created` — 创建的歌单
- `GET /collected` — 收藏的歌单
- `GET /:id` — 歌单详情
- `GET /:id/tracks` — 歌单歌曲列表
- `POST /create` — 创建歌单（Zod 校验 name）
- `POST /add-songs` — 添加歌曲到歌单（Zod 校验 playlistId + songIds）

**recommend.ts** — 推荐：

- `GET /daily` — `ncm-cli recommend daily`
- `GET /fm` — `ncm-cli recommend fm`

**song.ts** — 歌曲：

- `GET /:id/lyric` — `ncm-cli song lyric --songId <id>`，返回 `{ lyric, transLyric }`
- `POST /:id/like` — 收藏
- `POST /:id/dislike` — 取消收藏
- `GET /:id/album` — 专辑详情
- `GET /:id/album/tracks` — 专辑歌曲

**theme.ts** — 主题：

- `GET /images` — 读取 `THEME_IMAGES_DIR` 目录，返回图片文件名列表（过滤图片扩展名）

### 4.4 核心数据流

#### 播放状态同步流程

```
mpv 播放器 ──(IPC getState)──▶ wsManager (poll 15s)
                                      │
                        比较 lastState (JSON)
                                      │
                       ┌─ 相同 → skip
                       └─ 不同 → WebSocket broadcast
                                      │
                    ┌─────────────────┘
                    ▼
         Music client socket.ts
                    │
         onSocketEvent("playback:state")
                    │
         usePlaybackState hook
                    │
         playbackStore.update()
                    │
   ┌────────────────┼────────────────┐
   │                │                │
歌曲变化?       服务端超前?        其他情况
全量同步         追赶同步          保持推算
   │                │                │
   └────────────────┴────────────────┘
                    │
         set({ playing, song, localPosition })
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
  NowPlaying 组件        MusicBar 组件
  (requestAnimation      (requestAnimation
   Frame 驱动进度条)       Frame 驱动进度条)
```

#### 播放控制流程

```
用户点击播放按钮
    │
    ├── 1. playbackStore.togglePlay() — 立即更新 UI（乐观更新）
    │       ├── playing → !playing
    │       └── localPosition = 当前位置
    │
    └── 2. playbackApi.pause() / resume() — HTTP POST
            │
            ▼
        Music server :3001
            │
            ├── mpvController.pause() / resume()
            │       └── IPC { command: ["set_property", "pause", true/false] }
            │
            └── notifyPlaybackChange()
                    └── lastState = null → 下次轮询立即广播
```

#### 歌曲 ID 处理逻辑（play-song）

```
POST /api/playback/play-song { encryptedId, originalId, name, artist, duration }
    │
    ├── isEncryptedId(encryptedId)?（32 位 hex）
    │   ├── 否 → 数字 ID
    │   │   ├── 1) NeteaseCloudMusicApi.song_url(id) → 获取播放 URL
    │   │   ├── 2) mpvController.playUrl(url)  —— 🆕 直接 IPC 播放
    │   │   └── 3) 设置 mpvController.currentMeta
    │   │
    │   └── 是 → 加密 ID
    │       ├── 1) 尝试 NeteaseCloudMusicApi.song_url_v1() 获取 URL
    │       ├── 2) mpvController.playUrl(url)
    │       └── 3) 失败 → 返回错误
    │
    └── notifyPlaybackChange()
```

### 4.5 API 端点汇总

| 路由 | 方法 | 用途 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/playback/state` | GET | 播放状态（mpv IPC） |
| `/api/playback/play-song` | POST | 播放歌曲 |
| `/api/playback/play-playlist` | POST | 播放歌单 |
| `/api/playback/play-songs` | POST | 🆕 批量播放歌曲 |
| `/api/playback/pause` | POST | 暂停 |
| `/api/playback/resume` | POST | 恢复 |
| `/api/playback/stop` | POST | 停止 |
| `/api/playback/next` | POST | 下一首 |
| `/api/playback/prev` | POST | 上一首 |
| `/api/playback/seek` | POST | 跳转（body: `{ seconds }`） |
| `/api/playback/volume` | POST | 音量（body: `{ level }`） |
| `/api/playback/shuffle` | POST | 🆕 随机播放（同步 mpv 真实队列顺序，保证歌曲信息与歌词一致） |
| `/api/playback/loop` | POST | 🆕 循环模式（body: `{ mode }`） |
| `/api/playback/queue` | GET | 播放队列（mpv playlist） |
| `/api/playback/queue/add` | POST | 添加到队列 |
| `/api/playback/queue/remove` | POST | 🆕 移除队列项 |
| `/api/playback/queue/clear` | POST | 清空队列 |
| `/api/search/songs` | GET | 搜索歌曲（`?q=&limit=&provider=netease|qq`） |
| `/api/search/playlists` | GET | 搜索歌单 |
| `/api/search/albums` | GET | 搜索专辑 |
| `/api/search/all` | GET | 综合搜索 |
| `/api/settings/status` | GET | 获取网易云/QQ 登录状态和 AI 配置状态，不返回敏感值 |
| `/api/settings/ai` | POST | 保存 DeepSeek API Key、API 地址和模型到 Music/Workbench `.env` |
| `/api/settings/qq/login-qr` | POST | 生成 QQ 登录二维码，服务端保管临时登录签名 |
| `/api/settings/qq/login-check` | POST | 轮询 QQ 扫码状态，成功后保存 `QQ_MUSIC_COOKIE` |
| `/api/settings/qq/logout` | POST | 清除 QQ 音乐 Cookie |
| `/api/qq/home` | GET | 获取 QQ 热歌、流行指数、新歌榜及账号状态 |
| `/api/playlist/created` | GET | 创建的歌单 |
| `/api/playlist/collected` | GET | 收藏的歌单 |
| `/api/playlist/:id` | GET | 歌单详情 |
| `/api/playlist/:id/tracks` | GET | 歌单歌曲 |
| `/api/playlist/create` | POST | 创建歌单 |
| `/api/playlist/add-songs` | POST | 添加歌曲到歌单 |
| `/api/recommend/daily` | GET | 每日推荐 |
| `/api/recommend/fm` | GET | 私人 FM |
| `/api/user/login-status` | GET | 🆕 登录状态检查 |
| `/api/user/login-qr` | POST | 🆕 获取登录二维码 |
| `/api/user/logout` | POST | 🆕 退出登录 |
| `/api/user/profile` | GET | 用户信息 |
| `/api/user/history` | GET | 播放历史（`?limit=`） |
| `/api/user/liked` | GET | 喜欢的歌曲（保持网易云收藏列表顺序，最多 200 首） |
| `/api/song/:id/lyric` | GET | 歌词 |
| `/api/song/:id/like` | POST | 收藏歌曲 |
| `/api/song/:id/dislike` | POST | 取消收藏 |
| `/api/song/:id/album` | GET | 专辑详情 |
| `/api/song/:id/album/tracks` | GET | 专辑歌曲 |
| `/api/theme/images` | GET | 可用主题图片列表 |

### 4.6 登录认证系统

#### 流程

```
AppLayout mount
    │
    ├── 1. userApi.loginStatus() → 检查是否已登录
    │       │
    │       ├── loggedIn: true → 显示主界面
    │       └── loggedIn: false → 显示 LoginPrompt
    │
    └── 2. LoginPrompt（未登录时）
            │
            ├── 调用 /api/user/login-qr → 获取 QR 链接
            ├── 通过 api.qrserver.com 生成二维码图片
            ├── 每 3s 轮询 /api/user/login-status
            │
            └── 登录成功 → onLogin() → setIsLoggedIn(true)
```

#### NETESE_COOKIE（VIP 歌曲支持）

- 在 `Music/server/.env` 中配置 `NETEASE_COOKIE=MUSIC_U=xxxx...`
- 由 `npm run login`（`npx tsx server/src/scripts/login.ts`）通过扫码自动获取并写入 .env
- Cookie 传递给 `NeteaseCloudMusicApi` 用于获取高品质播放 URL（VIP 歌曲完整版）

#### 后端认证流程

```
authHelper.isLoggedIn()
    │
    ├── 1. ncm-cli login --check → 如果 success → { loggedIn: true }
    │
    └── 2. NeteaseCloudMusicApi.login_status({ cookie })
            └── code === 200 → { loggedIn: true, nickname }

authHelper.getLoginQr()
    │
    ├── isLoggedIn() → true → return null（已登录）
    └── isLoggedIn() → false → ncm-cli login --background → { qrCodeUrl, message }
```

### 4.7 主题系统

**流程**：

```
用户选择图片
    │
    ├── 1. extractColors(url, k=10)
    │       ├── 加载图片 → 缩放到 200px
    │       ├── Canvas 提取像素 → 过滤透明/极亮/极暗
    │       ├── K-Means 聚类 (k=10, 15 次迭代)
    │       │   └── 距离函数: 色相×2.0 + 饱和度×1.5 + 亮度×1.0
    │       └── 过滤 <1% 占比的簇 → 取累计 ≥80% 的簇
    │
    ├── 2. mapColorsToTokens(clusters)
    │       ├── Surface: 最高亮度 + 最低饱和度（强制 l≥0.92, s≤0.08）
    │       ├── Text: 最低亮度（限制在 0.1~0.4，与 surface 对比度 ≥0.45）
    │       ├── Accent: 最高饱和度（非 surface/非 text 的簇）
    │       ├── Purple / Pink: 次高饱和度的簇
    │       ├── Border: 中等亮度 + 低饱和度
    │       └── 固定辅助色: accentMint, accentSky, accentButter
    │
    ├── 3. applyTheme(tokens, imageUrl)
    │       ├── 设置 CSS 自定义属性（--color-accent, --color-surface, ...）
    │       ├── 设置 body 背景色和文字色
    │       ├── body::before: 背景图片（无模糊）
    │       └── body::after: 径向点阵 + 半透明渐变叠加
    │
    └── 4. 持久化到 localStorage
            ├── theme-selected-image: 文件名
            └── theme-colors: JSON 序列化的 ThemeTokens
```

**恢复流程**：
- 页面加载 → `useTheme()` → `themeStore._hydrate()`
- 从 localStorage 读取 → 重新 `applyTheme()`
- 同时 `fetchImages()` 更新可用图片列表

---

## 5. Workbench 模块（AI 工作台）

### 5.1 架构概览

```
浏览器 (localhost:5174) / Electron 主窗口
    │
    ├── HTTP /api/chat ──▶ Vite Proxy ──▶ Express Server (localhost:3000)
    │                                        │
    │                                        ├── chatService.ts
    │                                        │   └── DeepSeek API
    │                                        │       (Anthropic Messages 兼容)
    │                                        │
    │                                        ├── Tool Registry
    │                                        │   └── musicPlugin
    │                                        │       ├── HTTP ──▶ Music Server (:3001)
    │                                        │       └── 登录预检（ensureLogin）
    │                                        │
    │                                        └── /api/music/* Proxy
    │                                            └── HTTP ──▶ Music Server (:3001)
    │
    ├── MusicEmbed (Electron webview) → Music :5173
    │
    └── WebSocket ws://localhost:3001/ws ──▶ Music Server
            └── MiniPlayer 获取实时播放状态
```

### 5.2 前端架构

#### 路由表

| 路径 | 组件 | 功能 |
|------|------|------|
| `/` | `ChatPanel` | AI 对话界面 |
| `/music` | `MusicEmbed` | 🆕 嵌入 Music 应用（Electron webview） |
| `/journal` | `JournalEmbed` | 嵌入随手记 |
| `/tools` | `ToolsEmbed` | 嵌入工具模块 |
| `/cycling` | `PlaceholderPage` | 骑行模块占位页 |
| `/fitness` | `FitnessEmbed` | 嵌入肌肉大应用（Electron webview） |
| `/travel` | `PasswordGate` + `PlaceholderPage` | 密码保护的旅行模块占位页 |

#### 组件树

```
App
└── WorkbenchLayout
    ├── Sidebar
    │   ├── 模块链接（AI 对话/音乐/骑行/健身/旅游）
    │   └── 状态指示器
    ├── <Routes>
    │   ├── ChatPanel
    │   │   ├── 欢迎页（未对话时）
    │   │   │   ├── Logo + 标题
    │   │   │   └── 快捷提示按钮（4 个预设问题）
    │   │   ├── MessageBubble[]（对话列表）
    │   │   │   ├── 用户消息（右对齐，User 图标）
    │   │   │   ├── AI 消息（左对齐，Bot 图标）
    │   │   │   │   └── ToolCallCard[]（工具调用卡片）
    │   │   │   └── 🆕 LoginQRCard（登录二维码卡片，内嵌在 AI 消息中）
    │   │   ├── TypingIndicator（加载动画）
    │   │   └── ChatInput（输入框 + 发送按钮）
    │   ├── MusicEmbed（Electron webview）
    │   ├── JournalEmbed / ToolsEmbed（Electron webview）
    │   └── PlaceholderPage / PasswordGate
    └── MiniPlayer（浮动迷你播放器，可拖拽）
```

#### 视觉设计系统（2026-08）

Workbench、Music 与 Tools 使用从参考插画提炼的统一“暗室琥珀”设计语言，不直接使用参考图作为界面背景：

| 令牌类型 | 规范 |
|----------|------|
| 背景 | `#0b0b08` 近黑褐，叠加低透明琥珀径向光与轻微横向材质纹理 |
| 表面 | `#15140e` / `#211f15` 两级烟熏橄榄黑，用明度区分层级 |
| 主强调 | `#d99a16` 琥珀黄；悬停/文字强调使用 `#f0c451` |
| 辅助色 | 灰紫 `#82556e`、砖红 `#a4514d`、橄榄绿 `#7f8750`，仅用于状态和小面积提示 |
| 文字 | 主文字 `#eee6cc`，次文字 `#9c947b`，避免纯白造成刺眼对比 |
| 圆角 | 主要控制在 6–12px；弹窗和大容器不超过 16px |
| 阴影/边框 | 暖灰褐细边框，短距离黑色环境阴影；取消大面积紫色霓虹光 |
| 字号 | 正文 11–13px，页面标题 18–22px，以字重、字距和明度构建层级 |
| 交互 | 选中项使用左侧琥珀色标记；悬停轻微提亮边框/表面；按下位移 1px；键盘焦点清晰可见 |

适配规则：Workbench 侧栏宽 208px、Electron 自定义标题栏高 32px；工具统计区在窄窗口由四列降为两列，内容卡片由双列降为单列，保证 1280×800 及 900×600 仍可完整操作。

#### 状态管理

**chatStore**（`stores/chatStore.ts`）：

| 字段/方法 | 类型 | 说明 |
|-----------|------|------|
| `messages` | `ChatMessage[]` | 对话历史 |
| `isLoading` | `boolean` | 是否等待 AI 回复 |
| `addMessage(msg)` | 方法 | 添加消息（自动分配递增 ID + 时间戳） |
| `setLoading(v)` | 方法 | 设置加载状态 |
| `clear()` | 方法 | 清空对话 |

**playbackStore**（`stores/playbackStore.ts`）：

| 字段/方法 | 类型 | 说明 |
|-----------|------|------|
| `playing` | `boolean` | 是否播放中 |
| `song` | `SongInfo?` | 当前歌曲 |
| `volume` | `number` | 音量 |
| `update(playing, song, volume)` | 方法 | 更新状态 |
| `togglePlaying()` | 方法 | 切换播放状态 |

### 5.3 后端架构

#### 核心服务

**chatService**（`services/chatService.ts`）：

- **职责**：处理 AI 对话，管理 tool calling 循环
- **System Prompt 要点**：
  - 角色定位：阿潘阿潘潘工具栈的 AI 助手
  - 可用模块：音乐（网易云音乐控制）
  - 操作指引：先搜索再播放、搜索无结果时重试、多版本时让用户选择
  - 🆕 登录处理：工具返回 needLogin 时引导用户扫码登录
  - 语气要求：中文回复，友好活泼

- **Tool Calling 循环**（最多 5 轮）：

```
用户消息
    │
    ▼
┌─────────────────────────────────┐
│  callDeepSeek(messages, tools)  │
│  POST {baseUrl}/v1/messages     │
│  Headers: x-api-key,            │
│           anthropic-version     │
└──────────────┬──────────────────┘
               │
               ▼
      ┌── stop_reason? ──┐
      │                   │
  end_turn /          tool_use
  max_tokens /            │
  stop_sequence           ▼
      │           执行工具调用
      │           executeTool(name, input)
      │               │
      │               ├── 🆕 登录预检（musicPlugin.ensureLogin）
      │               │   └── 未登录 → 返回 { needLogin, qrCodeUrl }
      │               │
      │               ▼
      │           将 tool_result 追加到消息
      │           deepseekMessages.push(
      │             { role: "assistant", content: [...] },
      │             { role: "user", content: [tool_results] }
      │           )
      │               │
      │               ▼
      │           继续循环（最多 5 次）
      │
      ▼
  返回 { content, toolCalls }
```

**Workbench /api/music Proxy**（`index.ts`）🆕：

- 将 Workbench server 的 `/api/music/*` 请求代理到 Music server
- 用途：Workbench client（LoginQRCard）可直接通过 Workbench server 查询登录状态
- 示例：`GET /api/music/user/login-status` → `GET http://localhost:3001/api/user/login-status`

### 5.4 核心数据流

#### 对话流程

```
用户在 ChatInput 输入文字 → Enter
    │
    ├── 1. chatStore.addMessage({ role: "user", content })
    ├── 2. chatStore.setLoading(true)
    ├── 3. POST /api/chat { messages: [...] }
    │       │
    │       ▼
    │   chatService.handleChat(messages)
    │       │
    │       ├── 加载所有注册的 tools
    │       ├── 循环调用 DeepSeek API
    │       │   ├── AI 返回文本 → 结束
    │       │   └── AI 返回 tool_use
    │       │       ├── 🆕 ensureLogin() 预检（需要登录的工具）
    │       │       │   └── 未登录 → 返回 { needLogin, qrCodeUrl }
    │       │       ├── executeTool(name, args)
    │       │       │   └── musicPlugin 代理到 Music Server
    │       │       └── 将 tool_result 发回 AI
    │       └── 返回 { content, toolCalls }
    │
    ├── 4. chatStore.addMessage({ role: "assistant", content, toolCalls })
    └── 5. chatStore.setLoading(false)
```

#### MiniPlayer 数据流

```
Music Server (:3001) ──WebSocket──▶ musicSocket.ts
                                        │
                              onMusicEvent("playback:state")
                                        │
                              MiniPlayer 组件
                                        │
                              playbackStore.update()
                                        │
                              ┌─────────┴─────────┐
                              ▼                   ▼
                         显示歌曲信息        requestAnimationFrame
                         播放/暂停按钮       驱动进度条动画
                         可拖拽定位
```

**MiniPlayer 拖拽逻辑**：
- mousedown 在 GripVertical 手柄上 → 记录起始位置
- mousemove → 计算偏移（限制在视口内）
- mouseup → 结束拖拽
- 移动超过 3px 判定为拖拽（避免误触点击）
- 点击歌曲信息 → `window.open("http://localhost:5173/now-playing")`

### 5.5 工具插件系统

#### 架构

```
toolRegistry.ts
    │
    ├── registerPlugin(plugin) — 注册插件
    │   └── 按 tool.name 建立 tool → plugin 映射
    │
    ├── getAllTools() — 返回所有已注册工具的 DeepSeekTool 定义
    │
    └── executeTool(name, args) — 根据 tool name 找到对应 plugin 并调用其 execute()
```

#### musicPlugin（`tools/musicPlugin.ts`）

**登录预检机制** 🆕：

- `LOGIN_REQUIRED_TOOLS` 集合定义了需要登录才能使用的工具
- 执行这些工具前先调用 `ensureLogin()`：
  - 检查 `/api/user/login-status` → 已登录 → 继续执行
  - 未登录 → 调用 `/api/user/login-qr` → 返回 `{ needLogin: true, qrCodeUrl, message }`
- AI 收到 `needLogin` 响应后按 System Prompt 引导用户扫码登录

**注册的工具（18 个）**：

| 工具名 | 对应 Music API | 需登录 |
|--------|---------------|--------|
| `search_songs` | `GET /api/search/songs` | ❌ |
| `search_playlists` | `GET /api/search/playlists` | ❌ |
| `play_song` | `POST /api/playback/play-song` | ✅ |
| `play_playlist` | `POST /api/playback/play-playlist` | ✅ |
| `pause` | `POST /api/playback/pause` | ❌ |
| `resume` | `POST /api/playback/resume` | ❌ |
| `stop` | `POST /api/playback/stop` | ❌ |
| `next_track` | `POST /api/playback/next` | ❌ |
| `prev_track` | `POST /api/playback/prev` | ❌ |
| `set_volume` | `POST /api/playback/volume` | ❌ |
| `seek` | `POST /api/playback/seek` | ❌ |
| `get_playback_state` | `GET /api/playback/state` | ❌ |
| `get_queue` | `GET /api/playback/queue` | ❌ |
| `add_to_queue` | `POST /api/playback/queue/add` | ❌ |
| `clear_queue` | `POST /api/playback/queue/clear` | ❌ |
| `get_user_profile` | `GET /api/user/login-status` | ✅ 🆕 |
| `get_login_qr` | 🆕 直接调用 `ensureLogin()` | ❌ 🆕 |

**通信方式**：HTTP 代理
- `musicFetch(method, path, body?)` → `fetch("http://localhost:3001" + path)`
- 自动检查 `response.success`，失败时将 error 信息返回给 AI
- `needLogin` 穿透：Music server 返回 `needLogin` 时透传给 AI

**扩展方式**：
1. 创建新的 plugin 文件（实现 `ModuleToolPlugin` 接口）
2. 在 `index.ts` 中 `registerPlugin(newPlugin)`
3. 更新 `chatService.ts` 中的 System Prompt

### 5.6 Tools 模块

Tools 前端使用 React 19、React Router 7 与 Tailwind CSS 4，端口为 `5175`。侧栏按任务工具与图像工具分组，目前提供定时器、执行历史、日记和拼豆规格图。

#### 拼豆规格图

路由：`/beads`

- 支持拖拽或选择 PNG、JPG、WebP 图片，单文件上限 20 MB
- 图片仅在浏览器本地处理，不传到服务器
- 横向豆数可选 48、64、80、96、128、160，纵向豆数按原图比例自动计算；大于 1600px 的复杂图片默认使用 128 横豆
- 最大颜色数可在 8-48 之间调整；颜色聚类改用 CIELAB 感知色差，并提高轮廓与高饱和小面积颜色的采样权重，减少肤色、发色被大面积背景色吞并的问题
- 提供柔和、均衡、锐利三档细节处理；均衡和锐利模式在缩图后进行局部反差与饱和度增强
- 预览可在无格线的“成品效果”和带逐格数字、每 5 格坐标的“施工图纸”之间切换
- 成片预览支持独立大图弹窗，可按 `Esc`、关闭按钮或点击遮罩退出，并可单独下载无网格成片 PNG
- 规格统计包含成品尺寸、总豆数、实际用色数和颜色用量清单
- 透明像素保留为空格且不计入豆数；导出 PNG 会同时包含完整图纸和颜色图例
- 首版使用图片近似色，不绑定具体拼豆品牌色卡，后续可在现有色板数据结构上增加品牌色号映射

---

## 6. Electron 桌面客户端

### 6.1 架构

```
┌────────────────────────────────────────────────┐
│              Electron 主进程 (main.js)            │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐              │
│  │  MainWindow   │  │  SystemTray  │              │
│  │  (Workbench)  │  │  (托盘图标)   │              │
│  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                       │
│         │         ┌───────┴───────┐              │
│         │         │ 右键菜单控制    │              │
│         │         │ 播放/暂停/上下首 │              │
│         │         │ 音量/登录状态   │              │
│         │         │ 退出           │              │
│         │         └───────────────┘              │
│  ┌──────┴───────┐                                │
│  │  渲染进程      │                                │
│  │  Workbench   │                                │
│  │  :5174 (Dev) │                                │
│  │              │                                │
│  │  MusicEmbed  │                                │
│  │  (webview)   │                                │
│  └──────────────┘                                │
└────────────────────────────────────────────────┘
```

### 6.2 目录结构

```
what/
├── package.json          # 根 package.json（Electron 入口）
├── .npmrc                # Electron 国内镜像
├── .gitignore            # 忽略 dist/ out/
├── electron/             # Electron 主进程
│   ├── main.js           #  主进程：窗口、托盘、音乐 API 调用
│   └── preload.js        #  预加载：contextBridge（isElectron, platform）
├── setup.ps1             # 图形化环境检测、可选安装、进度日志与启动
├── start.bat             # 打开图形安装器（保留可见终端入口）
├── start.vbs             # 打开图形安装器（隐藏 PowerShell 控制台）
├── scripts/
│   └── clean-ports.js    # 🆕 启动前清理端口占用 + mpv 进程
├── Music/                # 不变
├── Workbench/            # 不变
└── ...
```

### 6.3 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 一键启动：①清理端口 → ② Tools + Music + Workbench 并发启动 → ③ Electron |
| `npm run dev:electron` | 仅启动 Electron（需服务已运行） |
| `npm run dev:web` | 仅启动 Tools + Music + Workbench（无 Electron） |
| `npm run login` | 🆕 执行扫码登录脚本，自动保存 Cookie 到 .env |
| `npm run build:music` | Vite 构建 Music client |
| `npm run build:workbench` | Vite 构建 Workbench client |
| `npm run build` | 构建前端 + 打包 exe |
| `npm run postinstall` | 安装根依赖后自动安装 Music + Workbench + Tools 依赖 |

**图形化安装器（`setup.ps1`）**：

- 启动时检测 Node.js 22、Git for Windows、mpv、ncm-cli、四组 npm 依赖及两个 `.env` 文件
- 采用 show-first 启动：窗口立即呈现“正在检测”，再由短延时任务执行首次扫描，避免双击后无反馈
- 首次扫描及“重新检测”采用延迟执行以先完成界面绘制：按钮显示“检测中”、进度条进入 Marquee 模式、各组件显示检测状态，完成后展示 100% 与缺失项数量
- VBS 正常显示启动进程，GUI 出现后自行隐藏控制台；VBS/PowerShell 两层均提供启动失败提示
- `start.vbs` 使用无 BOM 的纯 ASCII 源码，避免 Windows Script Host 在第 1 行第 1 个字符报 `800A0408` 编译错误
- 默认每次启动都显示安装器；全部环境与 API Key 完成后才出现“以后直接启动”按钮
- 项目依赖检查会比较各模块 `package-lock.json` 与 `node_modules/.package-lock.json` 的更新时间，并逐项验证工作区直接依赖；代码更新、新增依赖或依赖目录不完整时会自动恢复为“需要更新”，启动前也会再次拦截校验
- 跳过偏好保存在 `%LOCALAPPDATA%\WhatToolStack\setup-preferences.json`；仅在所有必需检查仍通过时生效，缺失任一必需项会强制恢复安装器，可选 Git 不阻塞
- 安装器提供“启动后自动关闭”开关并默认启用；项目进程拉起后短暂展示启动状态再自动关闭，关闭该开关可保留窗口，选择与跳过偏好保存在同一配置文件
- `setup.ps1 -ForceShow` 可忽略跳过偏好，重新打开安装器修改密钥或维护依赖
- 已安装项显示版本并禁用选择，缺失项支持单选、多选或“一键安装全部并启动”
- Git for Windows 是默认不勾选的可选项，不影响项目就绪状态或“以后直接启动”；可单独勾选，或通过“选择全部缺失项”一起安装
- Git 使用 WinGet 包 ID `Git.Git` 安装，安装后刷新 PATH 并复检版本，用于本地提交以及通过 GitHub HTTPS 凭据流程上传代码
- ncm-cli、项目依赖依赖 Node.js；漏选 Node 时会提示自动补充，并始终按正确顺序执行
- Node 优先通过 WinGet 安装；失败时从 Node.js 官方 `latest-v22.x` 下载 MSI，并按官方 `SHASUMS256.txt` 校验
- mpv 使用明确的 WinGet 包 ID `shinchiro.mpv`，避免同名包歧义
- npm 依赖通过根目录 `npm install` 安装，根 `postinstall` 继续安装 Music、Workbench、Tools workspace
- npm 下载配置有限时重试与 120 秒单次请求超时；优先使用 npmmirror，失败后自动切换官方源，且配置由根安装传递给全部 workspace
- 环境配置只补充缺失项并更新本机 ncm-cli 路径，不覆盖已有 API Key、端口等用户设置
- 密钥区域提供掩码输入、“保存密钥”和“申请密钥”；保存时同步写入 Music/workbench，且不把明文写入 UI 状态或日志
- 启动前检查密钥状态；未配置时允许继续启动基础功能，但会明确提示三个 AI 功能不可用
- Worker 子进程写入 JSONL 状态和文本日志，GUI 定时读取，展示单项状态、总进度和失败原因
- 长时间 npm 下载期间，GUI 持续展示已用时间；Worker 意外退出且未写入最终状态时，GUI 会立即结束忙碌状态并提示重新尝试
- 安装期间“仅安装选择项”按钮切换为“取消安装”；用户确认取消或关闭窗口时会终止本次 Worker 的完整进程树，避免 npm 后台残留和目录占用
- Worker 将控制台与 PowerShell 原生命令编码统一为 UTF-8/65001，避免 WinGet 中文输出被 GBK 错误解码
- npm 的 stderr warning 仅写入日志，安装成功与否以真实退出码判断，避免弃用警告中断安装链路
- 支持 `powershell -File setup.ps1 -CheckOnly` 输出 JSON 检测结果，便于诊断

### 6.4 主进程功能

**窗口管理**：
- 主窗口（1280×800）：加载 Workbench（`localhost:5174` 开发 / `dist/index.html` 生产）
- 使用无边框窗口和工作台自定义深色标题栏；支持拖动、双击最大化/还原，并提供定制的最小化、最大化和关闭按钮
- 开发模式显示加载动画（带进度条和状态文字），自动重试连接（20次，每次1.5s）
- 最小化按钮只最小化窗口，应用及音乐继续运行
- 关闭按钮、Alt+F4 和托盘“退出”均执行完整退出：先停止并关闭应用专用 mpv，再关闭所有项目服务，最后退出 Electron

**系统托盘**：
- 程序化生成 16×16 PNG 图标（紫色 #6366f1）
- 右键菜单：🏠 显示主窗口 | ▶ 播放/暂停 | ⏭ 下一首 | ⏮ 上一首 | 🔊 音量 +10 | 🔉 音量 -10 | 👤 网易云登录状态 | 退出
- 🆕 "网易云登录状态"菜单项：显示对话框 → 可退出登录；未登录时提示运行 `ncm-cli login`
- 托盘菜单每 30s 刷新
- 双击托盘图标 → 显示主窗口

**关联进程清理**：
- 退出时先调用 `/api/playback/shutdown`，Music server 通过专用 named pipe 向 mpv 发送 `quit`
- Electron 同时直接尝试该 named pipe，覆盖 Music server 已异常退出但 mpv 仍残留的情况，不按进程名误杀用户自行启动的其他播放器
- 随后只清理项目固定端口 `3000–3003`、`5173–5176` 的监听进程及其子进程，覆盖开发和生产启动方式
- Music server 收到 `SIGINT` / `SIGTERM` 时也会主动关闭 mpv 并停止 HTTP 服务
- 清理完成后才执行最终 `app.quit()`；重复退出请求复用同一清理流程

**托盘控制方式**：
- 通过 HTTP 直接调用 `127.0.0.1:3001/api/playback/*`
- 读取播放状态用 GET，控制操作用 POST

**防多实例**：
- `app.requestSingleInstanceLock()` 防止重复启动
- 第二次启动时激活已有窗口

**外部链接处理**：
- `mainWindow.webContents.setWindowOpenHandler` → 在系统浏览器打开

### 6.5 生产打包

```bash
npm run build
```

1. `build:music` — Vite 构建 Music client → `Music/client/dist/`
2. `build:workbench` — Vite 构建 Workbench client → `workbench/client/dist/`
3. `electron-builder --win` — 打包为 NSIS 安装程序 → `dist/`

**打包配置**（`package.json` 的 `build` 字段）：
- `appId`: `com.laopangy.what`
- `productName`: 阿潘阿潘潘的工具栈
- `files`: electron/**、两个 client/dist/**、两个 server/src/**、两个 server/package.json、两个 server/tsconfig.json
- `extraResources`: 将 `Music/server` 和 `workbench/server` 复制到 `resources/`
- Windows 目标：NSIS 安装程序（允许自定义安装目录）

### 6.6 本地前提依赖

| 依赖 | 说明 |
|------|------|
| Node.js ≥ 22 | Electron 运行时；可由图形安装器安装 |
| mpv 播放器 | Music 模块的音频播放后端；可由图形安装器安装 |
| ncm-cli | 网易云音乐 CLI；可由图形安装器安装，账号登录仍需用户扫码 |
| WinGet | 用于安装 mpv；缺失时需安装/修复 Windows“应用安装程序” |

---

## 7. 待开发模块

### 7.1 Fitness（肌肉大）

**目录**：`Fitness/`

**前端**：React 19 + Vite 6 + Tailwind CSS 4，端口 `5176`

**后端**：Express 5 + TypeScript + Zod，端口 `3003`

**数据存储**：与 Tools 共用根目录 `data/what.vault`。仓库通过 PBKDF2-SHA256 派生密钥并使用 AES-256-GCM 加密，启动后输入密码才能解锁；磁盘上不再保留明文 JSON。工作台会持续检查 Tools 与 Fitness 的解锁状态，开发热更新或服务重启导致任一后端重新上锁时，会自动返回统一密码页重新解锁。

核心闭环：

- 今日总览：当天热量与三大营养素、近七天训练、最近体重和今日计划；计划按当天具体日期优先、星期计划兜底自动匹配，日常计划直接展示作息、四餐和当天事项
- 每日计划：起床和睡觉时间作为全局固定作息只需设置一次，并使用整块可点击的小时/分钟分段选择器，变更后防抖自动保存并显示状态；固定作息按睡觉至次日起床自动计算预计睡眠小时和分钟。计划可选择每周重复或绑定具体年月日；每个星期只能有一份重复计划，每个具体日期也只能有一份日期计划。可以安排早餐、午餐、晚餐和加餐，四餐输入会自动防抖估算 kcal、蛋白质、碳水和脂肪并随计划持久化。每个日计划下可新增多项活动，每项分别设置开始时间、类型、名称、时长和备注，例如早上骑车、下午跑步、晚上打麻将；活动在详情中按时间排序。支持从“身体数据”读取性别、年龄、身高、体重、目标热量与蛋白质，结合训练经验、器械、伤病、大小周、正常及最晚下班、加班频率、通勤、可训练日和每日餐饮生成计划；所有自动计划均从生成当天开始，大小周模式使用任意一个已知大周周一判断轮换并生成连续 14 天，大周周六自动设为工作日。训练可选择自动避开加班、只在休息日、固定上班前或按最晚下班时间安排；旧生成条件自动迁移到避开加班模式。“很久没运动”恢复模式每天安排短时轻活动，第一周 2 次、第二周 3 次力量训练，每次最多 40 分钟且每动作最多 2 组；饮食先强调规律、蛋白质、蔬菜和七八分饱，不要求立即称重控卡。生成时保留手动指定日期计划，替换重复计划及上次自动生成的日期计划。计划导航使用顶部紧凑选择器，不再占用左侧栏；批量选择模式支持勾选、全选及一键删除，既有运动记录不受影响
- 力量训练：内置训练模板仅作为生成时的初始内容；训练详情中的每个动作都提供“编辑”入口，可直接跳转到对应编辑卡片。动作不受预设库限制，名称、部位、组数、目标、休息时间及重量＋次数、仅次数、按时长三种记录方式均由用户自由填写，也可删除任意生成动作或添加完全空白的新动作；完成一组后自动启动休息倒计时
- 运动历史：统一保存运动日期、类型、时长、距离、爬升、感受和力量训练完成组；下次力量训练自动带出上次重量与次数
- 饮食记录：输入“鸡胸肉 200克”“米饭 1碗”等简单分量时优先从本地食物库快速换算；输入“沙县鸡腿饭 + 一个鸭腿，鸡腿鸭腿都去皮”等套餐、额外加菜、去皮、少饭或少油描述时，由 AI 理解跨食物修饰、按中国常见成品份量拆分食物，并估算热量、蛋白质、碳水和脂肪。可以直接说“我今天中午吃了……”，系统会识别餐次并将结果直接记录到今天的午餐；早餐、晚餐和加餐同样支持，不写餐次时根据当前时间归类。界面逐项展示营养数据、份量假设和 AI/本地来源，也保留只计算不记录及手动调整流程。AI Key 会拒绝中文占位内容并给出明确配置提示，AI 不可用时尽量回退本地食物库。也支持营养标签输入，自动完成 kJ → kcal 和实际分量换算
- 身体数据：基础资料与目标修改后防抖自动保存并实时重算营养目标；“日常活动量”不可手动选择，系统根据每周计划中的力量/有氧训练日和有时长的恢复活动自动分析，计划增删改或重新生成后同步更新热量目标。今日体重和可选体脂同样自动写入，并以最新晨重同步当前体重。每天称重后立即评估，但至少积累连续 7 天才根据近期均重趋势以每次 100 kcal、最高 ±400 kcal 的幅度调整饮食目标，调整后冷却 7 天，避免单日水分变化造成频繁改计划；评估结果同步展示在身体页和自动生成计划中。展示最近八次体重趋势，并支持直接修改历史记录的日期、体重与体脂或确认后删除
- 目标计算：根据性别、年龄、身高、体重、活动量和增肌/减脂/保持目标，使用 Mifflin-St Jeor 公式估算每日热量，并计算蛋白质、碳水、脂肪和饮水目标
- Workbench 集成：`/fitness` 通过 `FitnessEmbed` webview 加载 `http://localhost:5176`

Fitness API：

| 方法 | 路由 | 用途 |
|------|------|------|
| GET | `/api/fitness/state` | 获取个人资料、训练计划及全部记录 |
| GET | `/api/fitness/foods` | 获取内置常见食物名称 |
| POST | `/api/fitness/foods/calculate` | 解析食物和分量并估算营养数据 |
| PUT | `/api/fitness/routine` | 保存全局固定起床和睡觉时间 |
| POST | `/api/fitness/sessions` | 新增包含饮食、事项及可选运动目标的每日计划 |
| PUT | `/api/fitness/sessions/:id` | 编辑已有每日计划 |
| DELETE | `/api/fitness/sessions/:id` | 删除每日计划（包括内置计划，历史运动记录保留） |
| POST | `/api/fitness/sessions/bulk-delete` | 一次删除多条每日计划（历史运动记录保留） |
| PUT | `/api/fitness/profile` | 保存身体资料并重新计算营养目标 |
| POST | `/api/fitness/meals` | 添加饮食记录 |
| DELETE | `/api/fitness/meals/:id` | 删除饮食记录 |
| POST | `/api/fitness/workouts` | 保存一次逐组训练记录 |
| POST | `/api/fitness/weights` | 新增或覆盖当天身体数据 |
| PUT | `/api/fitness/weights/:id` | 编辑已有体重/体脂记录 |
| DELETE | `/api/fitness/weights/:id` | 删除体重/体脂记录 |
| GET | `/api/health` | Fitness 健康检查 |

| 模块 | 目录 | 状态 | 说明 |
|------|------|------|------|
| Cycling | `Cycling/` | 占位 | `package.json` 仅含基本信息 |
| Fitness | `Fitness/` | 已上线 | 训练、饮食与身体数据一体化管理 |
| Travel | `Travel/` | 占位 | `package.json` 仅含基本信息 |

---

## 8. 端口与代理配置

| 模块 | 前端端口 | 后端端口 | Vite 代理 |
|------|---------|---------|-----------|
| Music | 5173 | 3001 | `/api` → `http://localhost:3001`<br>`/ws` → `ws://localhost:3001` |
| Workbench | 5174 | 3000 | `/api` → `http://localhost:3000`<br>`/api/music` → `http://localhost:3001` 🆕 |

**WebSocket 连接**：
- Music client → `ws://localhost:5173/ws`（经 Vite 代理到 `:3001`）
- Workbench MiniPlayer → 直连 `ws://localhost:3001/ws`

**启动时端口清理**：
- `scripts/clean-ports.js` 在 `npm run dev` 前执行
- 清理端口 3000, 3001, 5173, 5174 上的 LISTENING 进程
- 同时清理残留的 mpv.com / mpv.exe 进程

---

## 9. 配置项参考

### Music Server（`Music/server/src/config.ts`）

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3001` | 服务端口 |
| `NCM_CLI_PATH` | `%APPDATA%\npm\ncm-cli.cmd` | ncm-cli 路径；图形安装器会写入检测到的绝对路径 |
| `THEME_IMAGES_DIR` | `../client/public/images` | 主题图片目录 |
| `ANTHROPIC_BASE_URL` | `https://api.deepseek.com/anthropic` | LLM API 地址 |
| `ANTHROPIC_AUTH_TOKEN` | (空) | API Key |
| `ANTHROPIC_MODEL` | `deepseek-v4-pro` | 模型名称 |
| `CORS_ORIGIN` | `http://localhost:5173` | 跨域来源 |
| `NETEASE_COOKIE` | (空) | 🆕 网易云 Cookie（`MUSIC_U=xxx`，支持 VIP 歌曲） |
| `QQ_MUSIC_COOKIE` | (空) | QQ 音乐 Cookie（公开搜索/歌词无需配置，会员或版权受限歌曲播放需要） |

内部常量：
- `playback.pollIntervalMs`: `15000`（🔄 从 5000 改为 15000，降低 mpv IPC 轮询频率）

### Workbench Server（`workbench/server/src/config.ts`）

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `ANTHROPIC_BASE_URL` | `https://api.deepseek.com/anthropic` | LLM API 地址 |
| `ANTHROPIC_AUTH_TOKEN` | (空) | API Key |
| `ANTHROPIC_MODEL` | `deepseek-v4-pro` | 模型名称 |
| `CORS_ORIGIN` | `http://localhost:5174` | 跨域来源 |
| `MUSIC_API_URL` | `http://localhost:3001` | Music 服务地址 |

---

## 10. 技术栈汇总

### 前端（共享）
- **框架**：React 19 + React Router 7
- **构建**：Vite 6
- **样式**：Tailwind CSS 4（`@tailwindcss/vite` 插件）
- **语言**：TypeScript 5.7（strict 模式）
- **状态管理**：Zustand 5
- **图标**：lucide-react
- 🆕 **二维码**：qrcode.react（Workbench client）

### 后端（共享）
- **框架**：Express 5
- **语言**：TypeScript 5.7
- **运行时**：tsx（开发热重载）
- **验证**：Zod
- **跨域**：cors
- **WebSocket**：ws

### 桌面客户端
- **框架**：Electron 33
- **打包**：electron-builder 25
- **并发启动**：concurrently + wait-on

### 外部依赖
- **ncm-cli**：网易云音乐命令行工具（`@music163/ncm-cli`）— 仅用于数据操作
- **NeteaseCloudMusicApi**：网易云音乐 Node.js API（获取播放 URL + 登录状态）
- **@sansenjian/qq-music-api**：QQ 音乐 SDK（歌曲搜索、播放 URL、歌词）
- **mpv**：跨平台媒体播放器（🎯 通过 JSON IPC 直连控制）
- **DeepSeek API**：LLM 服务（Anthropic Messages 兼容接口）

---

## 11. 变更记录

> **规则**：每次功能或逻辑变更后，必须在此追加一条记录。记录格式：`日期 | 变更人 | 变更模块 | 变更摘要 | 涉及文件`。

| 日期 | 变更人 | 变更模块 | 变更摘要 | 涉及文件 |
|------|--------|----------|----------|----------|
| 2025-06-05 | 潘高远 | 全部 | 初始创建项目功能与逻辑文档 | — |
| 2025-06-05 | 潘高远 | Electron | Web → Electron 桌面客户端改造：新增 Electron 主进程、系统托盘、托盘菜单控制、生产打包 | `package.json`, `electron/main.js`, `electron/preload.js`, `.gitignore`, `.npmrc`, `Music/client/vite.config.ts`, `workbench/client/vite.config.ts` |
| 2025-06-09 | 潘高远 | Music/后端 | 🔴 **mpv 直连控制**：新增 mpvController，绕过 ncm-cli 播放 bug，通过 JSON IPC named pipe 直接操控 mpv 播放器（播放/暂停/上下首/进度/音量/队列/循环/随机） | `Music/server/src/services/mpvController.ts`, `Music/server/src/routes/playback.ts` |
| 2025-06-09 | 潘高远 | Music/后端 | 🆕 **登录认证系统**：新增 authHelper（双重检测 ncm-cli + API）、扫码登录 QR 生成、NETEASE_COOKIE 支持、login/logout/login-qr 路由 | `Music/server/src/services/authHelper.ts`, `Music/server/src/routes/user.ts`, `Music/server/src/scripts/login.ts`, `Music/server/src/config.ts` |
| 2025-06-09 | 潘高远 | Music/前端 | 🆕 **首页/登录**：MusicHome 智能首页（播放时 NowPlaying / 空闲时 HomePage）、HomePage 仪表盘（每日推荐/我喜欢/歌单/最近播放）、LoginPrompt 扫码登录组件；AppLayout 改为顶部 Header 导航（替代原 Sidebar） | `Music/client/src/components/dashboard/HomePage.tsx`, `MusicHome.tsx`, `LoginPrompt.tsx`, `Music/client/src/components/layout/AppLayout.tsx` |
| 2025-06-09 | 潘高远 | Workbench | 🆕 **登录集成**：musicPlugin 新增 get_user_profile/get_login_qr 工具、登录预检（ensureLogin）机制、LOGIN_REQUIRED_TOOLS 集合；Workbench server 新增 `/api/music/*` 代理；LoginQRCard 组件；MusicEmbed webview 组件 | `workbench/server/src/tools/musicPlugin.ts`, `workbench/server/src/index.ts`, `workbench/client/src/components/chat/LoginQRCard.tsx`, `MusicEmbed.tsx` |
| 2025-06-09 | 潘高远 | 根目录 | 🆕 **启动脚本**：start.bat（一键启动 + .env 检查 + Cookie 提示）、start.vbs（静默启动）、scripts/clean-ports.js（端口清理 + mpv 进程清理）、npm run login 脚本 | `start.bat`, `start.vbs`, `scripts/clean-ports.js`, `package.json` |
| 2025-06-09 | 潘高远 | Music/后端 | 🔄 **轮询间隔调整**：wsManager 默认轮询从 5s 改为 15s（mpv IPC 轮询更轻量，降低系统开销） | `Music/server/src/config.ts`, `Music/server/src/services/wsManager.ts` |
| 2026-08-07 | Codex | Music/后端 | 修复“我喜欢的音乐”顺序错乱：歌曲详情返回后按 `likelist` 的 ID 顺序重排，确保展示顺序与网易云一致 | `Music/server/src/routes/user.ts`, `PROJECT.md` |
| 2026-08-07 | Codex | Electron/Workbench | 移除工作台原生白色标题栏，改为无边框窗口与自定义深色标题栏；定制最小化、最大化、关闭按钮及悬停效果，保留拖动和双击最大化操作 | `electron/main.js`, `electron/preload.js`, `workbench/client/src/components/layout/WindowTitleBar.tsx`, `WorkbenchLayout.tsx`, `PROJECT.md` |
| 2026-08-07 | Codex | Music | 修复乱序播放后歌曲信息、时长、封面/收藏状态和歌词错位：按 mpv 稳定队列项 ID 同步真实队列，播放状态携带歌曲 ID，前端信息随切歌更新并防止旧歌词请求覆盖 | `Music/server/src/services/mpvController.ts`, `routes/playback.ts`, `services/wsManager.ts`, `Music/client/src/stores/playbackStore.ts`, `hooks/useLyrics.ts`, `types/ncm.ts`, `components/dashboard/NowPlaying.tsx`, `components/shared/TrackRow.tsx`, `PROJECT.md` |
| 2026-08-07 | Codex | Workbench/Music/Tools | 基于参考插画重构全局视觉基调：建立暗黑褐、琥珀黄、灰橄榄与少量灰紫的跨模块设计令牌；统一标题栏、侧栏、对话、卡片、按钮、输入框、嵌入页及窄窗口响应式布局 | `workbench/client/src/index.css`, `components/**`, `Music/client/src/index.css`, `components/layout/AppLayout.tsx`, `Tools/client/src/index.css`, `components/**`, `electron/main.js`, `PROJECT.md` |
| 2026-08-22 | Codex | 根目录/安装流程 | 新增 Windows 图形化本地环境安装器：自动检测与跳过已安装项，支持单选、多选、一键全部安装并启动，提供安装顺序、进度、日志、失败重试、安全的 `.env` 初始化及 DeepSeek Key 掩码录入；同步补齐 dotenv 直接依赖、动态 ncm-cli 默认路径及锁文件包名 | `setup.ps1`, `start.bat`, `start.vbs`, `Music/server/.env.example`, `workbench/server/.env.example`, `Music/server/src/config.ts`, `Music/server/package.json`, `Music/package-lock.json`, `Tools/package-lock.json`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-22 | Codex | 根目录/启动体验 | 安装器默认每次显示；环境全部完成后提供“以后直接启动”，偏好仅在所有检查通过时生效，缺失任一项会自动恢复安装器，并支持 `-ForceShow` 强制打开 | `setup.ps1`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-22 | Codex | 根目录/npm 安装 | 修复 npm 安装中断后界面仍显示执行中的问题；增加下载耗时提示、请求超时与重试，并在官方源失败时自动切换 npmmirror 国内镜像 | `setup.ps1`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-22 | Codex | 根目录/npm 安装 | 根据实际安装日志将 npmmirror 调整为 npm 首选源、官方源作为兜底；增加取消安装与关闭窗口时终止完整进程树，避免残留 npm 并发占用全局安装目录 | `setup.ps1`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-22 | Codex | 根目录/启动入口 | 修复 `start.vbs` 被 UTF-8 BOM 编码后 Windows Script Host 在第 1 行报 `800A0408` 无效字符的问题，启动脚本改为无 BOM 的纯 ASCII | `start.vbs`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-22 | Codex | 根目录/启动体验 | 新增“启动后自动关闭”开关并默认启用；项目进程启动后自动关闭安装器，也可取消勾选保留窗口，选择写入本机安装器偏好 | `setup.ps1`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-22 | Codex | 根目录/检测体验 | 修复点击“重新检测”无即时反馈的问题：检测前先刷新 UI，展示滚动进度、逐项检测状态并禁用重复操作，完成后显示 100% 和缺失项数量 | `setup.ps1`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-22 | Codex | Music/多音源 | 保留网易云功能并接入 QQ 音乐歌曲搜索、播放和歌词；搜索页新增音源切换，播放请求携带 provider/MID，安装器随项目依赖自动安装 SDK 并生成可选 Cookie 配置 | `Music/server/src/services/qqMusic.ts`, `routes/search.ts`, `routes/playback.ts`, `routes/song.ts`, `config.ts`, `Music/client/src/components/dashboard/SearchPage.tsx`, `components/dashboard/NowPlaying.tsx`, `components/shared/TrackRow.tsx`, `types/ncm.ts`, `api/client.ts`, `Music/server/package.json`, `Music/package-lock.json`, `setup.ps1`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-23 | Codex | Music/账号设置 | 新增统一“账号与服务设置”页面：网易云与 QQ 音乐双二维码登录/退出、DeepSeek API Key/地址/模型配置；服务端保存 Cookie/密钥且不向前端回显，网易云未登录不再阻塞 QQ 搜索与公开播放 | `Music/server/src/services/qqMusic.ts`, `services/envFile.ts`, `routes/settings.ts`, `index.ts`, `Music/client/src/components/dashboard/SettingsPage.tsx`, `components/layout/AppLayout.tsx`, `App.tsx`, `api/client.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-23 | Codex | Music/双音源主页 | Music 主页新增网易云/QQ 音源切换并记忆选择；QQ 首页接入热歌、流行指数和新歌榜，每榜 12 首，支持单曲及整榜播放，网易云原有首页功能保持不变 | `Music/server/src/services/qqMusic.ts`, `routes/qq.ts`, `routes/playback.ts`, `index.ts`, `Music/client/src/components/dashboard/HomePage.tsx`, `api/client.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-23 | Codex | Music/QQ 个人主页与榜单 | QQ 首页接入扫码账号的“我喜欢”、创建歌单和收藏歌单信息；榜单从失效的旧接口迁移到 `ToplistInfoServer/GetDetail`，按 QQ 原始内容分别展示热歌、流行指数和新歌榜，不进行人为去重 | `Music/server/src/services/qqMusic.ts`, `routes/qq.ts`, `Music/client/src/components/dashboard/HomePage.tsx`, `api/client.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-23 | Codex | Music/正在播放 | 参考 QQ 音乐重构沉浸式播放页：大幅专辑封面、环境模糊背景、居中歌词与通栏控制；安全代理 QQ/网易云封面并提取代表色，动态同步整页强调色；修复刷新页面不立即同步歌曲及歌词初次定位到可视区外的问题 | `Music/server/src/routes/theme.ts`, `Music/client/src/components/dashboard/NowPlaying.tsx`, `LyricsPanel.tsx`, `components/layout/AppLayout.tsx`, `hooks/usePlaybackState.ts`, `index.css`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-23 | Codex | Music/QQ 歌单与导航 | QQ 的“我喜欢”、创建歌单、收藏歌单卡片接入独立详情页，支持歌曲列表、单曲播放和播放全部；顶栏新增基于应用历史的返回按钮，无历史时回到首页 | `Music/server/src/services/qqMusic.ts`, `routes/qq.ts`, `Music/client/src/components/dashboard/QQPlaylistDetail.tsx`, `HomePage.tsx`, `components/layout/AppLayout.tsx`, `api/client.ts`, `App.tsx`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-23 | Codex | Music/双音源播放样式 | 修复网易云搜索返回新版 `al/ar/dt` 字段且搜索结果缺少封面 URL 的兼容问题；批量补充歌曲详情并统一为播放器所需的专辑、歌手、时长结构，使动态专辑色播放页同时适用于网易云与 QQ 音乐 | `Music/server/src/routes/search.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-23 | Codex | Music/连续播放 | 修复从歌曲列表点歌时队列退化为单曲、播放结束后无法续播的问题；网易云与 QQ 的歌单、收藏、每日推荐、搜索结果及榜单现在会保留所选歌曲之后的列表上下文并自动切换下一首 | `Music/client/src/components/shared/TrackRow.tsx`, `components/dashboard/DailyRecommend.tsx`, `LikedSongs.tsx`, `PlaylistDetail.tsx`, `QQPlaylistDetail.tsx`, `SearchPage.tsx`, `HomePage.tsx`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-23 | Codex | Music/歌词 | 修复 React 严格模式重复执行副作用时，首次歌词请求被清理、第二次请求又被防重复标记拦截，导致网易云与 QQ 播放页统一显示“暂无歌词”的问题；改为按歌曲身份安全重载并防止旧请求覆盖新歌曲 | `Music/client/src/hooks/useLyrics.ts`, `PROJECT.md` |
| 2026-08-23 | Codex | Music/播放队列 | 修复独立播放队列页面仍按旧版 `label` 字符串解析新版歌曲对象，导致歌名显示为 `[object Object]` 的问题；兼容新旧队列结构并统一显示歌名、歌手、当前播放状态及从 1 开始的序号 | `Music/client/src/components/dashboard/QueueView.tsx`, `PROJECT.md` |
| 2026-08-24 | Codex | 根目录/安装流程 | 增加 Git for Windows 可选安装项：自动检测版本、已安装跳过、支持单独或批量选择，通过 WinGet `Git.Git` 安装；Git 缺失不阻塞项目启动与跳过安装器 | `setup.ps1`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-24 | Codex | Fitness/Workbench | 上线“肌肉大”第一版：新增独立 React/Express 模块，支持营养目标计算、推拉腿训练计划、逐组打卡与休息计时、饮食记录、体重趋势和本地 JSON 持久化；接入 Workbench、门户、根启动/构建及安装器依赖检测 | `Fitness/**`, `workbench/client/src/App.tsx`, `FitnessEmbed.tsx`, `index.html`, `package.json`, `scripts/clean-ports.js`, `setup.ps1`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-24 | Codex | Fitness | 扩展为综合运动与饮食管理：新增常见食物分量解析和热量/三大营养素自动估算；运动计划支持力量、骑行、跑步、爬山及自定义活动，可设置星期、时长、距离和爬升并统一记录 | `Fitness/server/src/foodCalculator.ts`, `routes.ts`, `storage.ts`, `types.ts`, `Fitness/client/src/App.tsx`, `api.ts`, `types.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-24 | Codex | Fitness/饮食 | 修复整餐输入被单一食物和错误数量覆盖的问题：按 `/` 拆分多项食物、优先匹配更具体名称、支持中文数量词，补充粥/灌汤包/肠粉等外卖食物，并在前端展示逐项估算与合计 | `Fitness/server/src/foodCalculator.ts`, `Fitness/client/src/App.tsx`, `types.ts`, `PROJECT.md` |
| 2026-08-24 | Codex | Fitness/饮食 | 支持直接解析包装营养标签：识别每100克/每百毫升的 kJ 或 kcal 能量与实际食用量，自动按比例换算 kcal；缺少三大营养素时保留未知并显示提示 | `Fitness/server/src/foodCalculator.ts`, `Fitness/client/src/App.tsx`, `types.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-24 | Codex | 根目录/Music | 修复安装器仅凭旧 `.package-lock.json` 存在就误判依赖完整的问题：新增锁文件新旧与工作区直接依赖双重校验、启动前复检；Music API 增加 15 秒超时并确保首页异常时退出加载状态，避免后端缺包时持续转圈 | `setup.ps1`, `Music/client/src/api/client.ts`, `Music/client/src/components/dashboard/HomePage.tsx`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-24 | Codex | Music/正在播放 | 按 QQ 音乐桌面端重设计播放页：使用封面环境色沉浸背景、左封面右歌词布局、QQ 绿当前歌词、轻量贴底进度与控制栏，并让智能首页播放态共享播放页导航且不再重复显示底部迷你播放器；歌词改为只滚动自身容器，避免当前行定位带动整页上移 | `Music/client/src/components/dashboard/NowPlaying.tsx`, `LyricsPanel.tsx`, `components/layout/AppLayout.tsx`, `index.css`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-25 | Codex | 全局视觉/Music | 将 QQ 音乐桌面端设计语言应用到整个 Electron 工作台：宽文字侧栏改为 78px 半透明图标轨道，窗口标题与返回/前进/刷新/搜索合并为全局透明顶栏，Workbench、Music、Tools、Fitness 统一为灰蓝玻璃与 QQ 绿；Music 嵌入态复用全局导航和搜索。播放页撤掉独立方形封面，改用同源模糊底图、清晰前景、多方向 CSS mask 羽化和统一灰蓝雾幕合成 | `workbench/client/src/components/layout/WorkbenchLayout.tsx`, `WindowTitleBar.tsx`, `components/chat/MusicEmbed.tsx`, `index.css`, `Music/client/src/components/dashboard/NowPlaying.tsx`, `SearchPage.tsx`, `components/layout/AppLayout.tsx`, `index.css`, `Tools/client/src/index.css`, `Fitness/client/src/index.css`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-25 | Codex | Electron/Music | 将关闭窗口从“隐藏到托盘”改为完整退出：关闭按钮、Alt+F4 和托盘退出统一先通过 HTTP 与专用 named pipe 关闭 mpv，再终止项目 3000–3003、5173–5176 端口上的服务进程，最后退出 Electron；Music server 在 shutdown API 及系统终止信号下也会主动回收 mpv | `electron/main.js`, `workbench/client/src/components/layout/WindowTitleBar.tsx`, `Music/server/src/services/mpvController.ts`, `routes/playback.ts`, `index.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-25 | Codex | Music/Electron 窗口 | 播放页清晰封面改为最大 420px 的原比例显示，取消 `object-cover` 放大裁切，并移到灰蓝雾幕上方增强亮度、对比度和饱和度，中心高亮、边缘多向渐隐融入背景；歌词固定到右半区居中。无边框窗口恢复始终可见的自绘最小化、最大化和关闭按钮，并让全部嵌入 webview 从 56px 顶栏下方开始，消除 webview 覆盖窗口按钮点击区的问题 | `Music/client/src/components/dashboard/NowPlaying.tsx`, `index.css`, `workbench/client/src/components/layout/WorkbenchLayout.tsx`, `WindowTitleBar.tsx`, `electron/preload.js`, `main.js`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-25 | Codex | Music/歌词布局 | 适配全局 56px 顶栏后的播放页可用高度：取消歌词区域整体向下偏移，将歌词视口限制为 46vh/最大 400px，并为底部进度和控制栏预留 80px；首尾滚动留白改按歌词容器自身高度计算，避免歌词压到歌曲进度条 | `Music/client/src/components/dashboard/NowPlaying.tsx`, `LyricsPanel.tsx`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-25 | Codex | Electron/Music 退出 | 修复应用退出后歌曲仍继续播放：Music 启动 mpv 时在系统临时目录记录专属 PID并在正常退出时清除；Electron 关闭时依次调用 shutdown API、专用 named pipe，并以该 PID 强制结束本应用播放器进程树，覆盖服务或管道提前失效的情况且不按进程名误杀用户自行启动的 mpv | `Music/server/src/services/mpvController.ts`, `electron/main.js`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/运动计划 | 为全部运动计划补充可见的删除操作，取消内置计划不可删除限制，加入二次确认、删除中状态、自动选择下一计划及空计划引导；删除计划时保留既有运动记录 | `Fitness/client/src/App.tsx`, `Fitness/server/src/routes.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/每日计划 | 将“运动计划”扩展为通用每日计划：按星期记录起床、睡觉、早餐、午餐、晚餐、加餐和当天事项；增加日常安排类型，运动类型仅按需填写时长、距离和爬升，并在总览及详情中展示完整生活日程 | `Fitness/client/src/App.tsx`, `api.ts`, `types.ts`, `Fitness/server/src/routes.ts`, `storage.ts`, `types.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/计划结构 | 将起床和睡觉时间从单条计划迁移为全局固定作息；明确支持同一天多条计划，新增计划编辑入口与 `PUT` 更新接口，并兼容迁移旧计划里的作息时间 | `Fitness/client/src/App.tsx`, `api.ts`, `types.ts`, `Fitness/server/src/routes.ts`, `storage.ts`, `types.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/时间选择 | 替换 Chromium 原生时间输入框，改为整块可点击的小时/分钟分段选择器，统一固定作息卡片的灰蓝与绿色视觉，并通过浏览器实测选择交互 | `Fitness/client/src/App.tsx`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/作息保存 | 移除固定作息的手动保存按钮，小时或分钟变更后自动防抖保存，并展示“保存中/已自动保存”状态；浏览器验证刷新后数据保持且恢复测试值 | `Fitness/client/src/App.tsx`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/计划饮食 | 将现有食物分量解析接入每日计划四餐：输入后自动防抖显示热量、蛋白质、碳水和脂肪估算；新增或编辑计划时由后端重新计算并持久化，旧计划读取时兼容补算 | `Fitness/client/src/App.tsx`, `types.ts`, `Fitness/server/src/routes.ts`, `storage.ts`, `types.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/计划活动 | 为每日计划增加嵌套活动列表：可添加、编辑、删除多项活动，并分别设置开始时间、类型、名称、时长和备注；计划详情按时间排序展示，旧运动计划自动迁移为一条兼容活动 | `Fitness/client/src/App.tsx`, `api.ts`, `types.ts`, `Fitness/server/src/routes.ts`, `storage.ts`, `types.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/睡眠时长 | 固定作息根据睡觉时间到次日起床时间实时计算预计睡眠小时与分钟，并统一使用小时/分钟展示；覆盖跨午夜时间计算 | `Fitness/client/src/App.tsx`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/计划日期 | 每日计划支持“每周重复”和“指定日期”两种时间绑定；今日总览优先匹配当天日期计划并回退到对应星期计划，服务端约束每个星期及每个日期只能创建一份计划 | `Fitness/client/src/App.tsx`, `api.ts`, `types.ts`, `Fitness/server/src/routes.ts`, `storage.ts`, `types.ts`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/一周计划生成 | 新增个性化一周计划生成器：自动读取已保存身体资料，收集训练经验、器械、伤病、上下班与通勤、可训练日及每日饮食，按目标生成 7 天训练/恢复、餐饮和生活安排；生成条件持久化，具体日期计划不被覆盖 | `Fitness/client/src/App.tsx`, `api.ts`, `types.ts`, `Fitness/server/src/planGenerator.ts`, `routes.ts`, `storage.ts`, `types.ts`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/身体数据 | 移除基础资料及今日测量的手动保存按钮，改为防抖自动保存与状态提示；体重趋势增加历史记录编辑、日期唯一校验和确认删除功能 | `Fitness/client/src/App.tsx`, `api.ts`, `Fitness/server/src/routes.ts`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/活动量分析 | 将日常活动量改为不可手动选择的计划分析结果；根据每周力量、有氧和主动恢复安排自动判定久坐/轻量/中等/高活动，并在计划增删改及重新生成后同步重算热量与营养目标 | `Fitness/client/src/App.tsx`, `api.ts`, `Fitness/server/src/profileCalculator.ts`, `routes.ts`, `storage.ts`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/大小周与加班 | 一周计划生成器新增大小周、已知大周周一、正常/最晚下班、加班频率和训练时段策略；大小周按具体日期生成连续14天，大周周六纳入工作日，并提供自动避开加班模式将不确定加班日的训练前移至上班前 | `Fitness/client/src/App.tsx`, `types.ts`, `Fitness/server/src/planGenerator.ts`, `profileCalculator.ts`, `routes.ts`, `storage.ts`, `types.ts`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/计划管理与恢复 | 将占宽的左侧计划栏改为顶部紧凑选择器，新增批量勾选、全选及一键删除；生成器增加久未运动恢复模式，按每天轻活动、首周2练、次周3练、单次最多40分钟与每动作最多2组递进，饮食先建立规律而非严格控卡 | `Fitness/client/src/App.tsx`, `api.ts`, `types.ts`, `Fitness/server/src/planGenerator.ts`, `routes.ts`, `types.ts`, `PROJECT.md` |
| 2026-08-29 | Codex | Fitness/体重自适应 | 每次晨重保存后自动评估最近一周均重趋势；不足7天只收集基线，达到门槛后按目标温和调整每日热量，每次100 kcal、累计最多±400 kcal，并设置7天冷却避免重复调整；最新体重同步基础资料，评估结果写入自动生成计划 | `Fitness/client/src/App.tsx`, `types.ts`, `Fitness/server/src/weightAdapter.ts`, `profileCalculator.ts`, `routes.ts`, `storage.ts`, `types.ts`, `PROJECT.md` |
| 2026-08-29 | Codex | 全局数据存储 | 将定时器、执行历史、日记和健身状态迁入单一 `data/what.vault`；使用随机盐、PBKDF2-SHA256 与 AES-256-GCM 加密，工作台启动后统一密码解锁，并移除旧明文 JSON | `Tools/server/src/vault.ts`, `Fitness/server/src/vault.ts`, `workbench/client/src/components/chat/PasswordGate.tsx`, `data/what.vault`, `.gitignore`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-29 | Codex | Tools/启动配置 | 修复 Tools 读取 Workbench `.env` 时错误继承 `PORT=3000`，导致 3002 未监听、加密仓库解锁页显示 `Failed to fetch`；共享配置现仅加载 AI 相关变量 | `Tools/server/src/config.ts`, `PROJECT.md` |
| 2026-08-29 | Codex | Workbench/解锁页 | 将居中小卡片重构为非对称双栏加密仓库入口，统一灰蓝玻璃与 QQ 绿视觉，补充数据保护说明、连接/解锁状态、内联错误、键盘焦点和锁屏窗口控制，并通过本地浏览器完成视觉验证 | `workbench/client/src/components/chat/PasswordGate.tsx`, `workbench/client/src/index.css`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-30 | Codex | Fitness/计划生成与动作 | 修复自动计划从已知大周周一而非当天开始的问题，大小周参考日期仅用于判断轮换；计划动作支持新增、编辑、删除及重量次数、仅次数、按时长三种记录方式，可直接添加跳绳等自定义动作 | `Fitness/client/src/App.tsx`, `api.ts`, `types.ts`, `Fitness/server/src/planGenerator.ts`, `routes.ts`, `storage.ts`, `types.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-30 | Codex | Workbench/加密解锁 | 修复 Fitness 后端热更新重启后仓库重新上锁、工作台仍停留在模块内导致“重新连接”无反应的问题；工作台进入后定期并在窗口聚焦时检查两项数据服务，确认重新上锁后自动返回密码页 | `workbench/client/src/components/chat/PasswordGate.tsx`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-30 | Codex | Fitness/动作编辑 | 为训练详情的每个动作增加可见的“编辑”入口并自动定位到对应编辑卡片；移除固定动作库和默认新增内容，动作名称、部位、记录方式、组数、目标及休息时间均由用户自由填写，新动作从空白项开始 | `Fitness/client/src/App.tsx`, `PROJECT.md` |
| 2026-08-31 | Codex | Fitness/睡眠展示 | 将固定作息详情中的睡眠总分钟数改为小时与分钟，例如 450 分钟显示为 7 小时 30 分钟 | `Fitness/client/src/App.tsx`, `PROJECT.md` |
| 2026-08-31 | Codex | Fitness/AI 饮食估算 | 饮食记录采用本地食物库与 AI 混合估算：复杂整餐可识别套餐、额外食物及去皮/少油等跨项修饰，按常见份量拆分并返回热量、蛋白质、碳水、脂肪和估算依据；复用工作台 DeepSeek/OpenAI 配置，AI 失败时尽量回退本地计算 | `Fitness/server/src/aiConfig.ts`, `aiNutrition.ts`, `foodCalculator.ts`, `routes.ts`, `Fitness/client/src/App.tsx`, `types.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-31 | Codex | Fitness/自然语言饮食入账 | 修复中文占位 API Key 进入请求头引发 ByteString 异常：服务端及安装器提前校验并显示明确提示；新增“识别并自动记录”，可从“我今天中午吃了……”识别餐次、估算整餐营养并直接写入今天对应餐次，同时保留只计算不记录 | `setup.ps1`, `Fitness/server/src/aiNutrition.ts`, `routes.ts`, `Fitness/client/src/App.tsx`, `api.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-31 | Codex | 全局数据安全 | 清理迁移后残留的 Fitness 明文数据；规定所有用户业务数据必须写入 `data/what.vault`，迁移成功后立即删除明文源，并在开发及构建前自动检查旧数据目录和加密信封结构 | `scripts/check-encrypted-data.js`, `package.json`, `Fitness/server/src/scripts/migrate-json.ts`, `Tools/server/src/scripts/migrate-json.ts`, `AGENTS.md`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-31 | Codex | Fitness/饮食估算超时 | 将复杂餐食 AI 等待时间从 20 秒提升到 60 秒；AI 超时时对常见鸡腿饭、额外鸡腿、去皮修饰和定量橙汁进行本地分项降级估算，并明确未实际食用的歧义食物不计入 | `Fitness/server/src/aiNutrition.ts`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-31 | Codex | Tools/拼豆 | 新增拼豆规格图工具：本地图片上传、豆数与颜色数量调节、颜色聚类、带坐标的逐格预览、色号用量统计及完整 PNG 图纸导出 | `Tools/client/src/components/beads/BeadPatternMaker.tsx`, `Tools/client/src/utils/beadPattern.ts`, `Tools/client/src/App.tsx`, `Tools/client/src/components/layout/*`, `CLAUDE.md`, `PROJECT.md` |
| 2026-08-31 | Codex | Tools/拼豆精细化 | 将复杂图片默认精度提升至 128 横豆并开放 160 横豆与 48 色；采用 CIELAB 感知色差、边缘和高饱和颜色加权、三档细节增强，新增成品效果与施工图纸双视图 | `Tools/client/src/components/beads/BeadPatternMaker.tsx`, `Tools/client/src/utils/beadPattern.ts`, `PROJECT.md` |
| 2026-08-31 | Codex | Tools/拼豆成片预览 | 新增独立成片大图弹窗与无网格 PNG 下载，支持遮罩、关闭按钮和 Esc 退出，施工规格图继续单独导出 | `Tools/client/src/components/beads/BeadPatternMaker.tsx`, `PROJECT.md` |

---

> **文档维护者**：潘高远  
> **最后更新**：2026-08-31
