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
| Fitness | 🚧 占位 | 仅 `package.json` |
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
├── start.bat                  # 一键启动脚本（检查 .env + 安装依赖）
└── start.vbs                  # 静默启动（隐藏命令行窗口）
```

---

## 3. 门户页面

**文件**：`index.html`

**功能**：
- 纯静态 HTML 页面，无构建依赖
- 展示 4 张导航卡片 + 1 个主推卡片
- 主推卡片（Workbench）带有视觉强调样式，链接到 `http://localhost:5174`
- Music 卡片链接到 `Music/client/dist/index.html`（构建产物）
- Cycling / Fitness / Travel 卡片为禁用状态，显示"敬请期待"
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
| `/` | `MusicHome` | 智能首页：播放中 → NowPlaying，空闲 → HomePage |
| `/now-playing` | `NowPlaying` | 正在播放（封面 + 歌词） |
| `/search` | `SearchPage` | 搜索歌曲/歌单/专辑 |
| `/playlists` | `PlaylistBrowser` | 我的歌单（创建/收藏） |
| `/playlist/:id` | `PlaylistDetail` | 歌单详情 + 歌曲列表 |
| `/daily` | `DailyRecommend` | 每日推荐 |
| `/liked` | `LikedSongs` | 我喜欢的音乐 |
| `/queue` | `QueueView` | 播放队列 |

> **注意**：路由 `/` 移除了 `Navigate` 重定向，改为 `MusicHome` 智能组件。点击 Header 中的"首页"按钮通过 `forceHome` state 强制显示 HomePage。

#### 组件树

```
App
└── AppLayout（检查登录状态 → 未登录显示 LoginPrompt）
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
| `/api/playback/shuffle` | POST | 🆕 随机播放 |
| `/api/playback/loop` | POST | 🆕 循环模式（body: `{ mode }`） |
| `/api/playback/queue` | GET | 播放队列（mpv playlist） |
| `/api/playback/queue/add` | POST | 添加到队列 |
| `/api/playback/queue/remove` | POST | 🆕 移除队列项 |
| `/api/playback/queue/clear` | POST | 清空队列 |
| `/api/search/songs` | GET | 搜索歌曲（`?q=&limit=`） |
| `/api/search/playlists` | GET | 搜索歌单 |
| `/api/search/albums` | GET | 搜索专辑 |
| `/api/search/all` | GET | 综合搜索 |
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
| `/api/user/liked` | GET | 喜欢的歌曲 |
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
    │   └── MusicEmbed（Electron webview）
    └── MiniPlayer（浮动迷你播放器，可拖拽）
```

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
├── start.bat             # 🆕 一键启动（检查 .env + 安装依赖 + npm run dev）
├── start.vbs             # 🆕 静默启动（隐藏命令行窗口）
├── scripts/
│   └── clean-ports.js    # 🆕 启动前清理端口占用 + mpv 进程
├── Music/                # 不变
├── Workbench/            # 不变
└── ...
```

### 6.3 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 一键启动：①清理端口 → ② Music + Workbench 并发启动 → ③ Electron |
| `npm run dev:electron` | 仅启动 Electron（需服务已运行） |
| `npm run dev:web` | 仅启动 Music + Workbench（无 Electron） |
| `npm run login` | 🆕 执行扫码登录脚本，自动保存 Cookie 到 .env |
| `npm run build:music` | Vite 构建 Music client |
| `npm run build:workbench` | Vite 构建 Workbench client |
| `npm run build` | 构建前端 + 打包 exe |
| `npm run postinstall` | 安装根依赖后自动安装 Music + Workbench 依赖 |

### 6.4 主进程功能

**窗口管理**：
- 主窗口（1280×800）：加载 Workbench（`localhost:5174` 开发 / `dist/index.html` 生产）
- 开发模式显示加载动画（带进度条和状态文字），自动重试连接（20次，每次1.5s）
- 关闭主窗口 → 最小化到托盘（不退出）
- 关闭窗口 → 隐藏（不销毁）

**系统托盘**：
- 程序化生成 16×16 PNG 图标（紫色 #6366f1）
- 右键菜单：🏠 显示主窗口 | ▶ 播放/暂停 | ⏭ 下一首 | ⏮ 上一首 | 🔊 音量 +10 | 🔉 音量 -10 | 👤 网易云登录状态 | 退出
- 🆕 "网易云登录状态"菜单项：显示对话框 → 可退出登录；未登录时提示运行 `ncm-cli login`
- 托盘菜单每 30s 刷新
- 双击托盘图标 → 显示主窗口

**后端进程管理（仅生产模式）**：
- `app.isPackaged === false` → 开发模式，不启动后端（手动通过 `npm run dev` 启动）
- `app.isPackaged === true` → 生产模式，自动 spawn 两个 Node.js 子进程：
  - Music server：`node src/index.js`（cwd = `resources/music-server/`）
  - Workbench server：`node src/index.js`（cwd = `resources/workbench-server/`）
- `app.on("before-quit")` → `cleanupServers()` 杀掉所有子进程

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

### 6.6 前提依赖（用户仍需预装）

| 依赖 | 说明 |
|------|------|
| Node.js ≥ 22 | Electron 运行时 |
| mpv 播放器 | Music 模块的音频播放后端 |
| ncm-cli | 网易云音乐 CLI（需先 `ncm-cli login`） |

---

## 7. 待开发模块

| 模块 | 目录 | 状态 | 说明 |
|------|------|------|------|
| Cycling | `Cycling/` | 占位 | `package.json` 仅含基本信息 |
| Fitness | `Fitness/` | 占位 | `package.json` 仅含基本信息 |
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
| `NCM_CLI_PATH` | `C:\Users\mmhm\AppData\Roaming\npm\ncm-cli.cmd` | ncm-cli 路径 |
| `THEME_IMAGES_DIR` | `../client/public/images` | 主题图片目录 |
| `ANTHROPIC_BASE_URL` | `https://api.deepseek.com/anthropic` | LLM API 地址 |
| `ANTHROPIC_AUTH_TOKEN` | (空) | API Key |
| `ANTHROPIC_MODEL` | `deepseek-v4-pro` | 模型名称 |
| `CORS_ORIGIN` | `http://localhost:5173` | 跨域来源 |
| `NETEASE_COOKIE` | (空) | 🆕 网易云 Cookie（`MUSIC_U=xxx`，支持 VIP 歌曲） |

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

---

> **文档维护者**：潘高远  
> **最后更新**：2025-06-09
