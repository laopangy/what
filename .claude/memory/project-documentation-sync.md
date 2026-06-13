---
name: project-documentation-sync
description: 项目功能文档 PROJECT.md 需要与逻辑变更同步更新
metadata:
  type: project
---

项目在根目录有 `PROJECT.md` 文件，详细记录了所有模块（Music、Workbench、门户页面、Cycling/Fitness/Travel 占位模块）的功能、架构、数据流、API 端点、组件树和配置项。

**Why:** 用户要求"后续的逻辑变更需要同步该文档"，确保文档始终反映最新实现。

**How to apply:** 每次修改代码逻辑（新增功能、修改 API、调整数据流、变更配置、添加新模块等）后，必须在 `PROJECT.md` 中更新对应章节，并在文末「变更记录」表中追加一条记录（格式：日期 | 变更人 | 变更模块 | 变更摘要 | 涉及文件）。

文档结构：
- 第 1-3 章：项目概览、系统架构、门户页面
- 第 4 章：Music 模块（前端架构、后端架构、数据流、API、主题系统）
- 第 5 章：Workbench 模块（前端架构、后端架构、数据流、工具插件系统）
- 第 6-10 章：待开发模块、端口配置、配置项参考、技术栈、变更记录
