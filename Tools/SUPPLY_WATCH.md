# 生产补货源单生成巡检定时器

Tools 服务启动时会自动预置 3 个定时器，用来触发 OpenCLI 巡检。

完整技术文档：

```text
D:\work\Projects\OpenCLI\docs\supply-watch-source-plan.md
```

业务知识库：

```text
D:\work\Projects\OpenCLI\docs\supply-watch-knowledge.md
```

## 定时器

- `06:30-06:59`：`30-59 6 * * *`
- `07:00-07:59`：`* 7 * * *`
- `08:00-08:30`：`0-30 8 * * *`

## 执行命令

```cmd
cd /d D:\work\Projects\OpenCLI && set OPENCLI_BROWSER_COMMAND_TIMEOUT=180&& node dist\src\main.js supply-watch source-plan --once --latest 10 --dms-url https://dms.aliyun.com --pretty --format json
```

## 职责边界

Tools 负责：

- 每分钟触发巡检
- 保存执行历史
- 在页面中展示执行结果

OpenCLI 负责：

- 查询 SchedulerX 最近 10 条执行记录
- 判断是否告警
- 查询 SLS 生产日志
- 查询 DMS 源单表
- 输出中文诊断报告和精简 JSON

业务口径不要维护在本文件中。后续补充“源单是什么”“查哪张表”“查哪个 project/logstore”等内容时，统一更新 OpenCLI 的知识库文件。
