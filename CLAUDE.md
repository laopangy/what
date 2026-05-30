# 阿潘阿潘潘的工具栈 (what)

个人工具栈项目，集成音乐播放、AI 助手、骑行、健身、旅游等模块。

## 项目结构

```
what/
├── index.html              # 门户页面（导航卡片）
├── Music/                  # 🎵 网易云音乐播放器（已上线）
│   ├── package.json        # npm workspaces: ["client", "server"]
│   ├── client/             # React 19 + Vite 6 + Tailwind 4 + TypeScript
│   ├── server/             # Express 5 + TypeScript（调用 ncm-cli）
│   └── .env                # 【需创建】环境变量
├── workbench/              # 🧠 AI 工作台（已上线）
│   ├── package.json        # npm workspaces: ["client", "server"]
│   ├── client/             # React 19 + Vite 6 + Tailwind 4 + TypeScript
│   ├── server/             # Express 5 + TypeScript（调用 DeepSeek API）
│   └── server/.env         # 【需创建】DeepSeek API Key
├── Cycling/                # 🚴 骑行模块（开发中，仅占位 package.json）
├── Fitness/                # 💪 健身模块（开发中，仅占位 package.json）
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

### 后端（Music/server & workbench/server）
- Express 5 + TypeScript 5.7
- tsx（开发热重载）
- ws（WebSocket）
- Zod（请求验证）
- cors + uuid

### 运行端口
| 模块 | 前端端口 | 后端端口 |
|------|---------|---------|
| Music | 5173 | 3001 |
| Workbench | 5174 | 3000 |

### Vite 代理配置
- Music client 的 `/api` → `http://localhost:3001`，`/ws` → `ws://localhost:3001`
- Workbench client 的 `/api` → `http://localhost:3000`

## 新电脑完整配置流程

### 1. 基础环境安装

```bash
# Node.js 22.x LTS（必需）
winget install OpenJS.NodeJS.LTS
# 或从 https://nodejs.org 下载安装

# 验证
node -v   # 应显示 v22.x
npm -v    # 应显示 10.x+
```

### 2. mpv 播放器 + ncm-cli（Music 模块必需）

```bash
# 安装 mpv 播放器
winget install mpv

# 验证 mpv
mpv --version

# 全局安装 ncm-cli
npm install -g @music163/ncm-cli

# 登录网易云音乐（生成认证信息）
ncm-cli login

# 记录 ncm-cli 路径（后面配置 .env 要用）
where ncm-cli
# 典型输出：C:\Users\<用户名>\AppData\Roaming\npm\ncm-cli.cmd
```

### 3. 克隆项目并安装依赖

```bash
git clone https://github.com/laopangy/what.git
cd what

# 安装 Music 依赖
cd Music && npm install

# 安装 Workbench 依赖
cd ../workbench && npm install
```

### 4. 创建 .env 文件（⚠️ 关键步骤）

文件被 .gitignore 排除，需手动创建。

#### Music/server/.env

```env
PORT=3001
# 用上面 where ncm-cli 查到的实际路径替换
NCM_CLI_PATH=C:\Users\<你的用户名>\AppData\Roaming\npm\ncm-cli.cmd
THEME_IMAGES_DIR=../client/public/images
CORS_ORIGIN=http://localhost:5173

# 以下为 AI 选歌功能（可选，不填则 AI 选歌不可用）
ANTHROPIC_AUTH_TOKEN=你的DeepSeek_API_Key
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_MODEL=deepseek-v4-pro
```

#### workbench/server/.env

```env
PORT=3000
CORS_ORIGIN=http://localhost:5174
MUSIC_API_URL=http://localhost:3001

# AI 对话功能（必需！没有 Key 工作台无法使用）
ANTHROPIC_AUTH_TOKEN=你的DeepSeek_API_Key
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_MODEL=deepseek-v4-pro
```

### 5. 获取 DeepSeek API Key

1. 访问 https://platform.deepseek.com
2. 注册/登录
3. 进入 API Keys 页面创建 Key
4. 充值或确认有可用额度
5. 将 Key 填入两个 .env 文件

### 6. 启动项目

```bash
# 终端 1：启动 Music 模块（音乐播放器）
cd what/Music
npm run dev          # 同时启动 client:5173 + server:3001

# 终端 2：启动 Workbench 模块（AI 助手）
cd what/workbench
npm run dev          # 同时启动 client:5174 + server:3000
```

### 7. 访问

- 门户页面：用浏览器打开 `what/index.html`
- AI 工作台：http://localhost:5174
- 音乐播放器：http://localhost:5173

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
| 9 | `.env` 文件已创建 | `cat Music/server/.env workbench/server/.env` |
| 10 | DeepSeek API Key 有效 | 启动 workbench 后发送消息测试 |
| 11 | Music server 启动 | `curl http://localhost:3001/api/playback/state` |
| 12 | Workbench server 启动 | `curl http://localhost:3000/api/chat` |

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
| `/api/search/songs` | 搜索歌曲 |
| `/api/search/playlists` | 搜索歌单 |
| `/api/search/albums` | 搜索专辑 |
| `/api/recommend/daily` | 每日推荐 |
| `/api/user/liked` | 喜欢的歌曲 |
| `/api/song/:id/lyric` | 歌词 |
| `/api/playlist/created` | 创建的歌单 |
| `/api/playlist/collected` | 收藏的歌单 |

## Music 服务器配置项

配置通过 `Music/server/src/config.ts` 从环境变量读取：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3001` | 服务器端口 |
| `NCM_CLI_PATH` | `C:\Users\mmhm\AppData\Roaming\npm\ncm-cli.cmd` | ncm-cli 可执行文件路径 |
| `THEME_IMAGES_DIR` | `../client/public/images` | 主题背景图目录 |
| `ANTHROPIC_BASE_URL` | `https://api.deepseek.com/anthropic` | LLM API 地址 |
| `ANTHROPIC_AUTH_TOKEN` | (空) | DeepSeek API Key |
| `ANTHROPIC_MODEL` | `deepseek-v4-pro` | 模型名称 |
| `CORS_ORIGIN` | `http://localhost:5173` | 允许的跨域来源 |

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
