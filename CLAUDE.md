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
│   └── 子工具: 定时器、拼豆规格图、桌面灵宠
├── Fitness/                # 💪 肌肉大（训练、饮食与身体数据管理，已上线）
│   ├── client/             # React 19 + Vite 6 + Tailwind 4 + TypeScript
│   ├── server/             # Express 5 + TypeScript + Zod
│   └── server/             # 健身状态写入同一个加密仓库
└── Outdoor/                # ⛰️ 户外模块（骑行、旅行与完整行程规划）
    ├── client/             # React 19 + Vite 6 + Tailwind 4 + TypeScript
    └── server/             # Express 5 + Zod + 加密行程存储
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
| Outdoor | 5177 | 3004 |

所有后端只监听 `127.0.0.1`，不对局域网开放。Tools、Fitness、Music 只接受本机 5173–5177 前端（`localhost` 或 `127.0.0.1`）和打包版 Electron（`file://`，其 WebSocket 握手带这个来源）的跨域请求，其他来源（包括 `null`）返回 403，Music 的 WebSocket 握手同样校验来源；不带 Origin 的请求（服务间调用、Electron 主进程、打包版页面的 fetch）不受影响。浏览器跨站发起的简单 GET（图片、脚本标签等）同样不带 Origin，所以 GET 接口必须保持只读。白名单写在各服务 `config.ts` 的 `allowedOrigins` 中，不读取环境变量。

### Vite 代理配置
- Music client 的 `/api` → `http://localhost:3001`，`/ws` → `ws://localhost:3001`
- Workbench client 的 `/api` → `http://127.0.0.1:3000`
- Tools client 的 `/api` 与 `/pet-assets` → `http://localhost:3002`
- Fitness client 的 `/api` → `http://localhost:3003`
- Outdoor client 的 `/api` → `http://localhost:3004`

后端只监听 IPv4，代理目标写 `localhost` 时依赖 Node 在 `::1` 连接失败后回退到 `127.0.0.1`；新增代理或服务地址直接写 `127.0.0.1`。

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

安装器只创建可启动的环境配置；账号和服务密钥在应用内统一管理：

- 在 DeepSeek 平台创建 API Key 后，进入“账号与服务设置”的 AI 服务区保存
- 同一个 Key 会写入 `Music/server/.env` 和 `workbench/server/.env` 的 `ANTHROPIC_AUTH_TOKEN`；Tools 复用 workbench 配置
- 在 Music 客户端右上角进入“账号与服务设置”，可分别扫描网易云和 QQ 音乐二维码登录；Cookie 自动保存到本机 `.env`
- 也可运行 `npm run login`，在终端扫描二维码登录网易云
- QQ 音乐公开搜索、歌词和榜单无需登录；扫码登录后主页通过独立的创建歌单/收藏接口读取个人歌单，并加载“猜你喜欢”个性化歌曲，会员/版权受限歌曲也会使用该登录态
- QQ 首页的“我喜欢”、创建歌单和收藏歌单均可进入独立详情页，支持单曲与整单播放；非首页页面可使用顶栏返回按钮回到上一步
- AI 风格分析支持切换网易云与 QQ 音乐；QQ 模式可选择创建或收藏歌单生成品味画像，再从账号实时“猜你喜欢”候选池中精选可直接播放的推荐歌曲
- 整个 Electron 工作台采用 QQ 音乐桌面端风格：全局使用窄图标侧栏、透明顶栏、灰蓝玻璃表面与 QQ 绿强调色；Workbench、Music、Tools、Fitness 共享同一视觉令牌，Music 嵌入时复用工作台顶栏而不重复显示内部导航
- 网易云与 QQ 音乐共用同一个 QQ 音乐风格的沉浸式“正在播放”页面：封面以“全屏模糊底图 + 灰蓝雾幕 + 左侧高亮清晰图 + 多方向羽化遮罩”合成；清晰层按原比例装入最大 420px 的正方形区域，不裁切、不额外放大，并在雾幕上方轻微增强亮度、对比度和饱和度，中心清晰而四周渐隐融入背景；歌词固定在右半区居中，当前歌词及关键控制使用 QQ 绿
- 播放页为底部进度与控制栏预留独立空间；歌词可视区限制为 46vh/最大 400px，取消整体向下偏移，首尾定位留白按歌词容器自身高度计算，不会压到进度条
- 网易云与 QQ 的歌单、收藏、每日推荐、搜索结果和榜单点歌时会保留所选歌曲之后的列表上下文，当前歌曲结束后自动续播下一首
- Electron 无边框窗口始终显示自绘的最小化、最大化和关闭按钮；所有嵌入 webview 从顶栏下方开始布局，避免其覆盖 56px 窗口控制点击区。关闭按钮、Alt+F4 和托盘“退出”会真正退出应用：依次通过 Music API、专用 named pipe 和临时 PID 记录关闭本应用创建的 mpv，再清理 Tools、Fitness、Music、Workbench 的前后端监听进程；PID 兜底只结束关联播放器及其子进程，不按进程名误杀其他 mpv；最小化按钮仍只最小化，不停止音乐
- “账号与服务”作为统一应用设置页，展示应用名称、版本和模块信息，集中管理音乐账号、AI 与高德地图服务。高德配置复用 Outdoor 加密仓库，保存后刷新户外页面生效；肌肉大与户外不提供密钥录入表单。
- DeepSeek API Key 统一在“账号与服务设置”中配置，密钥只写入本机且不会回显
- `.env` 格式可参考 `Music/server/.env.example` 和 `workbench/server/.env.example`
- 首次进入工作台需输入数据密码。密码只用于运行时验证和密钥派生，不写入仓库文件或项目文档
- 解锁页采用与工作台一致的灰蓝玻璃与 QQ 绿设计：双栏说明数据保护方式，提供连接中、解锁中和内联错误状态；Electron 锁屏时仍显示最小化、最大化和关闭按钮。进入工作台后会定期检查 Tools 与 Fitness 的解锁状态，任一服务重启并重新上锁时自动返回密码页
- 进入随手记需再次输入工作台数据密码；离开随手记、刷新页面或闲置 5 分钟后自动锁定，也可手动锁定。解锁令牌只保存在 Tools 服务与页面内存中，Tools 服务重启后需重新解锁
- 定时器、执行历史、日记、Fitness 数据和户外行程统一保存在根目录 `data/what.vault`。文件使用随机盐、PBKDF2-SHA256 和 AES-256-GCM 加密，并作为二进制文件随 Git 项目在 A/B 电脑间同步；运行期锁和临时文件仍由 Git 忽略
- 启动前会运行 `npm run check:data-sync`，检查加密数据是否未提交、未推送或落后于本地记录的远端分支；Electron 启动及退出时也会显示同步提醒。密文无法安全合并，换电脑前必须在当前电脑提交并推送，另一台电脑先拉取再打开
- 所有用户生成的业务数据必须进入加密仓库，禁止在模块 `server/data/` 中保留明文 JSON；开发和构建前会运行 `npm run check:data-security` 检查旧明文文件及加密信封结构，迁移脚本写入成功后会立即删除明文源文件

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

# 根目录执行一次即可；postinstall 会安装全部子模块
npm install
```

### 获取 DeepSeek API Key

1. 访问 https://platform.deepseek.com
2. 注册/登录
3. 进入 API Keys 页面创建 Key
4. 充值或确认有可用额度
5. 在应用“账号与服务设置”的 AI 服务区保存 Key

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
- 工具模块：http://localhost:5175（定时器、拼豆规格图、桌面灵宠）
- 户外模块：http://localhost:5177（完整行程规划、骑行、自驾与高铁方案）

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
| 11 | DeepSeek API Key 已配置 | 账号与服务设置显示“已配置”；有效性需启动 workbench 后发送消息测试 |
| 12 | Music server 启动 | `curl http://localhost:3001/api/playback/state` |
| 13 | Workbench server 启动 | `curl http://127.0.0.1:3000/api/health` |
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
  workbench/server ──HTTP（AI 模块插件）──► Tools/server :3002、Fitness/server :3003、Outdoor/server :3004
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
| `/api/qq/recommend/songs` | QQ 音乐登录账号的“猜你喜欢”歌曲 |
| `/api/qq/playlist/:id` | QQ 音乐歌单详情与完整歌曲列表 |
| `/api/analyze/style` | 分析网易云或 QQ 歌单（body: `{ playlistIds, provider }`）并返回品味画像与推荐歌曲 |
| `/api/theme/cover-image` | 受限代理 QQ/网易云专辑封面，供本地播放器提取动态主题色 |

## Tools 服务器 API 端点（定时器、随手记与桌面灵宠）

| 路由 | 用途 |
|------|------|
| `/api/journal-lock/unlock` (POST) | 用工作台数据密码换取随手记访问令牌（12 小时有效，仅存内存）；连续 5 次错误冷却 30 秒并返回 429 与 `Retry-After`，数据仓库未解锁时返回 423 |
| `/api/journal-lock/lock` (POST) | 吊销请求头 `X-Journal-Token` 中的随手记令牌 |
| `/api/journal/*` | 随手记日记接口，必须携带有效的 `X-Journal-Token`，否则返回 401 `JOURNAL_LOCKED` |
| `/api/timer` | 获取所有定时器 |
| `/api/timer` (POST) | 创建定时器 |
| `/api/timer/:id` | 获取单个定时器 |
| `/api/timer/:id` (PUT) | 更新定时器 |
| `/api/timer/:id` (DELETE) | 删除定时器 |
| `/api/timer/:id/toggle` | 启用/禁用 |
| `/api/timer/:id/trigger` | 手动触发执行 |
| `/api/timer/:id/history` | 执行历史 |
| `/api/timer/history/all` | 全部执行历史 |
| `/api/pets` | 获取六只可用内置灵宠、自定义灵宠摘要、当前设置、养成状态和真实能力开关 |
| `/api/pets/events` | SSE 推送灵宠状态，以及定时任务开始、成功、失败等白名单工作台事件 |
| `/api/pets/settings` (PUT) | 保存启用状态、角色、名称、尺寸、透明度、自主行为、活跃程度、气泡和工作台联动开关 |
| `/api/pets/position` (PUT) | 保存 0-1 归一化拖拽位置 |
| `/api/pets/interactions` (POST) | 记录点击、双击、抚摸、喂食、玩耍、睡眠或唤醒；亲密度奖励冷却 30 秒 |
| `/api/pets/custom` (POST) | 创建自定义灵宠；校验格式、文件签名、尺寸、动画布局与 8 MB 资源总量后加密保存 |
| `/api/pets/custom/:id` (PUT/DELETE) | 编辑或删除自定义灵宠；删除当前角色时自动切回雾团 |
| `/api/pets/custom/:id/asset` | 按需读取自定义完整图片资源；目录与 SSE 不携带 Base64 |
| `/api/pets/ai/status` | 返回 DeepSeek 文本对话和图像生成的真实配置状态 |
| `/api/pets/dialogue` (POST) | 使用后端 DeepSeek 配置生成最多 60 字的角色化回复，最多携带最近 8 条对话 |
| `/pet-assets/*` | 只读提供六只内置灵宠的动作清单和透明 Sprite 图集 |
| `/api/health` | 健康检查 |

## Fitness 服务器 API 端点（肌肉大）

| 路由 | 用途 |
|------|------|
| `/api/fitness/state` | 获取个人资料、训练计划、训练/饮食/体重记录 |
| `/api/fitness/foods/calculate` (POST) | 所有食物和整餐描述必须调用 DeepSeek 拆分并估算热量与三大营养素；Anthropic 请求显式设置 `thinking.type=disabled` 关闭默认深度推理，主请求提供 3000 输出 token，正文缺失或 JSON 不完整时以 5000 token 自动修复重试一次，单次请求最多等待 60 秒；仍失败时直接报错，不产生本地替代结果 |
| `/api/fitness/routine` (PUT) | 保存全局固定起床和睡觉时间 |
| `/api/fitness/sessions` (POST) | 新增每日计划；单个计划可包含多条活动和可动态配置的训练动作，四餐文本自动估算并保存热量与三大营养素 |
| `/api/fitness/sessions/:id` (PUT) | 编辑已有每日计划、嵌套活动、训练动作及四餐营养估算 |
| `/api/fitness/sessions/:id` (DELETE) | 删除每日计划（包括内置计划，历史运动记录保留） |
| `/api/fitness/profile` (PUT) | 保存资料及可选减脂目标体重/完成日期，并重新计算周期、目标速度、基础代谢、维持热量、目标缺口或盈余、四餐预算、建议摄入及三大营养素目标；未设期限时减脂默认缺口为 350 kcal，设置期限后按目标进度估算并叠加体重趋势修正 |
| `/api/fitness/meals` (POST) | 添加饮食记录 |
| `/api/fitness/meals/from-text` (POST) | AI 识别餐次并记录饮食，支持可选 `date`（真实日历日期且不晚于今天）；所选日期优先，省略时默认今天 |
| `/api/fitness/meals/:id` (DELETE) | 删除饮食记录 |
| `/api/fitness/workouts` (POST) | 保存逐组训练记录，支持重量＋次数、仅次数及按秒计时动作 |
| `/api/fitness/weights` (POST) | 新增或覆盖当天身体数据 |
| `/api/health` | 健康检查 |

## Outdoor 服务器 API 端点（户外）

| 路由 | 用途 |
|------|------|
| `/api/outdoor/generate` (POST) | 旧模板生成停用，返回 410 |
| `/api/outdoor/map/status` (GET) | 高德配置状态（不返回密钥） |
| `/api/outdoor/map/config` (PUT) | 加密保存 Web 端 Key、安全密钥和 Web 服务 Key |
| `/api/outdoor/map/sdk` (GET) | 本地 JS API 配置，不含 Web 服务 Key |
| `/api/outdoor/places`、`/api/outdoor/recommend` (POST) | 高德地点搜索、基于真实往返路线的候选筛选 |
| `/api/outdoor/journeys/generate` (POST) | 五步条件生成 1～7 天路线及时间安排，超限拒绝 |
| `/api/outdoor/journeys` (GET/POST) | 获取/校验后加密保存新行程 |
| `/api/outdoor/journeys/:id` (DELETE) | 删除新行程 |
| `/api/outdoor/settings` (GET/PUT) | 获取或保存加密的家庭地址；描述未指定出发地时作为默认起终点 |
| `/api/outdoor/plans` | 获取旧版估算记录；POST 写入返回 410 |
| `/api/outdoor/plans/:id` (PUT) | 旧记录写入停用，返回 410 |
| `/api/outdoor/plans/:id` (DELETE) | 删除已有行程计划 |
| `/api/health` | Outdoor 健康检查及加密仓库解锁状态 |

当前户外使用五步流程：时间/范围、交通/活动、目的地、住宿、完整行程。地图和 POI/道路路线来自高德，时间编排为本地规则。没有 Key、无路线或不满足限制时不再生成固定模板；铁路换乘不等于已核实高铁车次，酒店 POI 不提供实时房价/房态，登山安全性与海拔未验证。支持系统语音输入地点，应用不保存录音；识别后需确认具体 POI。旧版估算记录保留为文字查看。

出行表单的交通上限、每天活动预算使用小时＋分钟填写；交通时长可不填，但时长和距离至少一项必填。数值框可清空且不残留前导零。同行人员初始为空，使用“添加人员类别”按需添加或移除分组并手动填写人数；至少填写 1 人后才能继续。人员按成年人（不含老人）、老人、儿童合计，不再填写或展示女性人数。当前交通选择显示自驾/骑行，保留旧公共交通记录兼容。

推荐按真实去程路线距离分档，例如单程 50km 分为五个不重叠的 10km 区间。候选为有限检索，不保证每档有结果。自驾突出目的地；公路车模式改为骑行过程，支持往返及当天途经点环线，单独设置总里程上限（环线必填），每日预算约束实际骑行移动时间，不再附加景点游览预算。终点优先搜索路口/骑行驿站，剔除导航明确提示台阶、非铺装或禁骑及缺少道路几何的路线；路面、车流、爬升和通行安全依然待核实。不会凭高德普通骑行结果承诺适合公路车。

高德错误 10021 表示账号某接口 QPS 超限，而非必然为 Key 错误。后端统一控制请求起始间隔至少 1.1 秒，合并进行中的相同查询，限流后按 2 秒、4 秒退避最多重试两次；日额度/权限/白名单问题不按 QPS 重试。若仍失败，应在高德控制台检查接口配额和同账号其他应用调用，不自动购买配额或更换密钥。

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

### 桌面灵宠数据模型

灵宠配置位于 `data/what.vault` 的 `desktopPets` 字段，包含 `schemaVersion`、`settings`、归一化 `position`、按角色保存的 `care`、`customPets` 和 `updatedAt`。自定义灵宠完整图片 Base64 只存在密文内，公共 API 与 SSE 返回不含图片正文的摘要，资源通过 `/api/pets/custom/:id/asset` 按需读取。设置、位置、亲密度、心情与互动次数落盘；当前动作、方向、气泡、聊天历史和逐帧位置只保存在 Workbench 内存。内置动作资源位于 `Tools/server/assets/pets/`，不属于用户业务数据。

Canvas 2D 播放六套独立 6 × 4 Sprite 图集。自定义资源支持静态图片、GIF/WebP 原动画和 Sprite Sheet/PNG 序列；服务端拒绝 SVG、伪造文件签名、缺少布局的 Sprite 与超限资源。DeepSeek 文本配置用于真实对话，未配置时返回 503；图像生成仍未接通，不得显示模拟结果。音乐、定时任务和 AI 请求联动只发送白名单状态与短标签，不携带命令、输出或工作台敏感内容。

## Tools 服务器配置项

配置通过 `Tools/server/src/config.ts` 从环境变量读取：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3002` | 服务器端口 |
| `vaultFile` | `data/what.vault` | 根目录加密数据仓库；由代码固定定位，无需环境变量 |

## Fitness 服务器配置项

Fitness 与 Tools 共用根目录的加密数据仓库，服务重启后需再次输入密码解锁。饮食记录和计划餐饮的营养估算仅使用 DeepSeek，并复用 `workbench/server/.env` 中的配置；也允许在 `Fitness/server/.env` 中使用同名变量单独覆盖。项目不再包含本地食物库或降级估算，AI 未成功返回时不会生成或保存营养结果。

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3003` | 服务器端口 |
| `vaultFile` | `data/what.vault` | 与 Tools 共用的 AES-256-GCM 加密文件 |

## Outdoor 服务器配置项

Outdoor 与 Tools、Fitness 共用根目录加密仓库，工作台统一密码页会同时解锁三个数据服务。

首次使用需在工作台「账号与服务」设置的「高德地图服务」填写高德开放平台申请的三项内容：

1. 平台类型为 **Web 端（JS API）** 的 Key。
2. 该 Key 对应的 **安全密钥 securityJsCode**。
3. 另一个平台类型为 **Web 服务** 的 Key。

配置在本机表单填写，不要发到聊天或写入源码；加密进入 `data/what.vault` 并随仓库同步。按高德控制台要求配置开发域名/服务白名单（本机使用 localhost/127.0.0.1），开通地点搜索及路线规划权限并确认配额。JS Key 和安全密钥在本地浏览器运行时可见；Web 服务 Key 仅供后端访问。公开部署前应改用高德推荐的服务端安全代理，不能直接将本机服务暴露到公网。更换已加载的 JS Key 后刷新户外页面。

Outdoor 后端只监听 127.0.0.1，并限制请求来源为本机 5173/5174/5177。未配置时显示提示，不会加载假地图；填入真实 Key 后仍需在本机验证权限、网络、底图、地点查询和至少一条真实路线。

测试：在 Outdoor 执行 `npm run test -w server`；构建后根目录执行 `node Outdoor/tests/api-smoke.mjs`。浏览器测试 `node Outdoor/tests/browser-smoke.mjs` 需要本机 Playwright（可用 `PLAYWRIGHT_MODULE_PATH` 指定安装路径、`PLAYWRIGHT_CHANNEL=msedge` 使用本机 Edge）；`OUTDOOR_SCREENSHOTS` 可指定截图目录。测试仅使用隔离临时加密文件或模拟 API，不解锁、不修改用户数据。

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3004` | 服务器端口 |
| `VAULT_FILE` | `data/what.vault` | 与其他业务模块共用的 AES-256-GCM 加密文件 |


### iCloud 日历连接与行程同步

- 在“账号与服务”→“iCloud 日历”输入 Apple 账号和 App 专用密码（不是账户登录密码）。账户需启用双重认证及 iCloud 日历；在 https://account.apple.com/ 的“登录和安全”→“App 专用密码”生成密码。
- 连接成功后选择自己的可编辑目标日历，设置提醒时间（默认提前 15 分钟，也可关闭），点击“保存日历设置”。建议在 iPhone 日历中单独创建“工具栈行程”。
- 在户外“我的行程”或已保存行程详情点击“同步到苹果日历”。每段活动成为一个日程，包含北京时间对应的起止时刻、地点、私人地址与备注、人数和提醒；iPhone 显示取决于系统时区与 iCloud 刷新，并需勾选目标日历。
- 同步为手动、单向写入；同一行程重复同步更新原日程（会覆盖其在手机端的编辑），重新计算保留行程 ID，减少的活动在下次同步时清理。改选日历会在新日历创建一份，旧日历保留；断开连接或删除本地行程不会删除云端已有日程。
- 凭据、日历选择和同步记录全部保存在根目录 data/what.vault 的 outdoor.icloudCalendar 中。凭据及同步记录随加密仓库在 A/B 电脑间共享；不生成明文 ICS、账号文件或请求日志。服务发现与凭据发送仅允许 HTTPS 的 caldav.icloud.com 和 p数字-caldav.icloud.com。
- 使用 tsdav 2.2.2 完成 CalDAV 发现；对象通过固定 UID、条件写入和 ETag 更新。同步前记录计划资源，中断后重试不会重复创建；其他来源的同名日程不覆盖，失败显示已完成项数。真实 iCloud 联调需用户在本机填写账号授权。
- 安装新增依赖：在 Outdoor 执行 npm install，重启 Outdoor 服务和刷新设置页。测试使用隔离加密仓库及模拟 CalDAV，不向真实账号写入。

| API | 用途 |
|------|------|
| GET /api/outdoor/calendar/status | 返回连接状态、账号、日历列表和提醒，不返回密码或日历 URL |
| POST /api/outdoor/calendar/connect | 验证 App 专用密码并加密保存连接 |
| POST /api/outdoor/calendar/refresh | 刷新账号的日历列表 |
| PUT /api/outdoor/calendar/selection | 保存目标日历和提醒 |
| DELETE /api/outdoor/calendar/connection | 清除连接凭据，保留云端日程及加密同步记录 |
| POST /api/outdoor/journeys/:id/calendar | 将已保存行程同步到选定的 iCloud 日历 |

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
| `NETEASE_COOKIE` | (空) | 网易云登录 Cookie |
| `QQ_MUSIC_COOKIE` | (空) | QQ 音乐 Cookie；会员/版权受限歌曲播放时需要 |

## Workbench 服务器配置项

Workbench AI 对话是覆盖整个工作台的私人助手：普通问答、写作和闲聊直接回答；用户明确提出某个模块的需求时，服务端按意图（或由模型调用 `load_module_tools`）只加载该模块的工具，普通问答不携带模块上下文，也不会追加模块引导。各模块在对话中的能力：

| 模块 | 对话中可以 | 只能到页面手动操作 |
|------|-----------|-------------------|
| 肌肉大 | 查看今日概况、近期记录和训练计划，估算热量，记录饮食、体重和训练，删除饮食记录（需确认） | 修改训练计划、个人资料和目标 |
| 定时任务 | 查看任务和执行历史，启用/停用、立即执行（需确认） | 新建、修改、删除任务 |
| 户外 | 查看已保存行程，同步到苹果日历（需确认） | 生成行程、搜索地点 |
| 音乐 | 搜索、播放、播放控制和队列管理 | — |
| 随手记 | 查看、新建或追加（需在对话中解锁） | 删除、覆盖已有内容 |
| 拼豆、云效、桌面灵宠 | 打开页面 | 全部操作 |

- 标注“需确认”的操作只生成确认卡片，用户点击“确认”后才由服务端执行；待确认操作只在服务端内存保存 10 分钟，服务重启后失效。
- 随手记密码只在对话里的解锁卡片中输入，由服务端转发给 Tools 换取令牌，不进入对话历史，也不发给 AI；令牌只保存在 Tools 服务与页面内存中，闲置 5 分钟、离开 AI 对话页、刷新页面或手动锁定后吊销，相关消息随即隐藏。
- 工具结果精简后才发给 DeepSeek（不含定时任务的请求/命令配置、户外出发地址等）；回复为纯文本。
- 服务只监听 `127.0.0.1`。修改对话或插件逻辑后运行 `cd workbench/server && npm test`（模拟模型与模块服务，不访问 DeepSeek，也不读写数据仓库）。

配置通过 `workbench/server/src/config.ts` 从环境变量读取：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3000` | 服务器端口 |
| `ANTHROPIC_BASE_URL` | `https://api.deepseek.com/anthropic` | LLM API 地址 |
| `ANTHROPIC_AUTH_TOKEN` | (空) | DeepSeek API Key |
| `ANTHROPIC_MODEL` | `deepseek-v4-pro` | 模型名称 |
| `CORS_ORIGIN` | `http://localhost:5174` | 允许的跨域来源 |
| `MUSIC_API_URL` | `http://127.0.0.1:3001` | Music 服务器地址 |
| `TOOLS_API_URL` | `http://127.0.0.1:3002` | Tools 服务器地址（定时任务、随手记） |
| `FITNESS_API_URL` | `http://127.0.0.1:3003` | Fitness 服务器地址 |
| `OUTDOOR_API_URL` | `http://127.0.0.1:3004` | Outdoor 服务器地址 |

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
