# AGENTS.md — Claude Code 代理配置

> 项目完整文档请先阅读 [`CLAUDE.md`](./CLAUDE.md)。本文档仅包含代理层面的补充信息。

## 与 CLAUDE.md 的关系

- `CLAUDE.md` 是项目的**权威文档**：技术栈、环境配置、架构说明、API 端点等。
- `AGENTS.md` 记录**代理行为**相关的内容：已安装的 agent skills、代码审查/风格偏好等。

## 已安装的 Agent Skills

Music 客户端目录（`Music/client/`）安装了以下 agent skills（来源：`Leonxlnx/taste-skill`）：

| Skill | 用途 |
|-------|------|
| `brandkit` | 品牌风格套件生成 |
| `design-taste-frontend` | 设计品味前端 |
| `design-taste-frontend-v1` | 设计品味前端 v1 |
| `full-output-enforcement` | 完整输出强制 |
| `gpt-taste` | GPT 设计品味 |
| `high-end-visual-design` | 高端视觉设计 |
| `image-to-code` | 图片转代码 |
| `imagegen-frontend-mobile` | 移动端图片生成前端 |
| `imagegen-frontend-web` | Web 图片生成前端 |
| `industrial-brutalist-ui` | 工业粗野主义 UI |
| `minimalist-ui` | 极简 UI |
| `redesign-existing-projects` | 重新设计已有项目 |
| `stitch-design-taste` | 设计品味整合 |

Skill 锁定文件：`Music/client/skills-lock.json`

## 代码风格偏好

### 通用
- TypeScript strict 模式，避免 `any`（非必要不逃逸）
- 组件命名用 PascalCase，文件名与组件名一致
- React 组件使用 `export default function`
- Hook 命名以 `use` 开头

### 前端（React）
- 使用 Tailwind CSS 4 class，尽量不用内联 style
- 组件状态：简单状态用 `useState`，跨组件状态用 Zustand store
- 路由通过 React Router 7，参数用 URL params 或 location state

### 后端（Express）
- 路由文件放在 `src/routes/`，一个模块一个文件
- 输入校验用 Zod
- 普通错误用 `{ success: false, error: "message" }` 格式返回

## 文档维护

每次功能或逻辑变更后，更新：
1. `PROJECT.md` — 在对应章节更新 + 在"变更记录"追加条目
2. `CLAUDE.md` — 如有配置/启动流程变化则同步更新
3. 本文档 — 如有 agent 相关变更则更新
