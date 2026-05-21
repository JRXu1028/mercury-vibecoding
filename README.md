# Mercury Vibecoding Project

## 项目简介

本项目为课程小组作业，目标是在 GitHub 开源项目 Mercury 的基础上，通过 Vibecoding 的方式复刻其核心功能。

参考项目：https://github.com/neolee/mercury

项目定位：一个本地优先、跨平台、支持 AI 摘要 / 翻译 / 标签功能的 RSS 阅读器。

---

## 技术选型

桌面端使用 **Electron**，前端使用 **Vue 3 + TypeScript**，后端逻辑运行在 **Electron Main Process** 中，使用 **Node.js + TypeScript** 实现，数据存储使用 **SQLite**。

分层说明：

- **Electron**：跨平台桌面壳
- **Vue 3**：界面
- **TypeScript**：前后端统一语言和类型
- **Node.js**：主进程里的本地后端逻辑
- **SQLite**：本地数据库

| 层次 | 技术 | 用途 |
|---|---|---|
| 桌面壳 | Electron | 跨平台桌面应用运行时 |
| 前端 | Vue 3 + TypeScript + Vite | 页面、组件、状态和类型约束 |
| UI | Element Plus | 桌面端界面组件 |
| 状态管理 | Pinia | 管理 Feed、文章、设置和 Agent 状态 |
| 路由 | vue-router | 页面路由 |
| 本地数据库 | SQLite + better-sqlite3 | 保存订阅源、文章、笔记、标签、LLM 用量 |
| 本地配置 | electron-store | 保存主题、Provider 配置、API Key 等 |
| Feed 解析 | rss-parser | 解析 RSS / Atom |
| OPML | fast-xml-parser 或 xml2js | 导入导出订阅源 |
| 正文提取 | @mozilla/readability + jsdom | 从网页 HTML 提取正文 |
| 内容清洗 | DOMPurify + turndown | 清洗 HTML 并转换为 Markdown |
| Markdown 渲染 | marked | 在阅读器中展示文章内容 |
| LLM 调用 | openai SDK | 调用 OpenAI-compatible API |
| 打包 | electron-builder | 生成 Windows / macOS / Linux 安装包 |

---

## 架构分层

```text
Mercury 桌面应用
├── Renderer 前端：Vue 3 + TypeScript + Vite
├── IPC 安全桥接：contextBridge
├── Main Process 后端：Node.js + TypeScript
├── 本地数据层：SQLite mercury.db + electron-store
└── 打包发布：electron-builder
```

---

## 小组成员

| 姓名 | GitHub 账号 |
|---|---|
| 徐佳睿 |  [@JRXu1028](https://github.com/JRXu1028)  | 
| 刘烨铭 |  [@leafriel](https://github.com/leafriel)  | 
| 曲馥诺 |  [@MagicNuo6](https://github.com/MagicNuo6)  | 
| 周孙睿 |  [@destroy-zhou](https://github.com/destroy-zhou)  | 
| 朱宇瑄 |  [@amourlion](https://github.com/amourlion)  | 
| 章可仲 |  [@7A6B7A](https://github.com/7A6B7A)  | 
| 郑一钒 |  [@yifanzheng](https://github.com/KuriUni?tab=repositories)  | 
| 陈岩松 |  [@LingXi-fur](https://github.com/LingXi-fur)  | 
| 张笑铖 |  [@zxc1844](https://github.com/zxc1844)  | 
| 黄博 | [@datieBB](https://github.com/datieBB) |
| 李欣昊 | [@Se9mentree](https://github.com/Se9mentree) |
---

## 团队分工

| 小组 | 成员 | 负责内容 | 交付标准 |
|---|---|---|---|
| Team A：Feed & 同步组 | 徐佳睿、刘烨铭、曲馥诺 | Feed 添加/删除、RSS / Atom 解析、OPML 导入导出、Feed 同步、文章列表 | 输入 RSS URL 后可以显示文章列表，并能同步更新 |
| Team B：内容清洗 & 阅读组 | 周孙睿、朱宇瑄、章可仲 | 正文提取、HTML 清洗、Markdown 转换、Reader 阅读视图、主题和阅读样式 | 点击文章后可以看到清洗后的正文，并具有基本阅读体验 |
| Team C：AI Agent 组 | 郑一钒、陈岩松、张笑铖、李欣昊 | LLM Provider 配置、连通性测试、Summary Agent、Translation Agent、Prompt 模板、LLM 用量记录 | 配置模型后可以生成文章摘要和分段翻译 |
| Team D：基础设施 & 集成组 | 黄博 | 项目脚手架、IPC 规范、数据库 schema、全局布局、打包配置、文档 | 应用能稳定启动，各组模块能接入，最终可以打包演示 |


---

## 作业要求功能

### MVP 必做

- Feed / OPML 解析
- Feed 同步
- 文章内容展示
- 内容清洗：Cleaned HTML / Cleaned Markdown
- Summary Agent
- Translation Agent
- LLM Providers

### 加分功能

- 多语言支持
- 日志上报和调试工具
- 大语言模型用量统计
- 笔记和文摘导出
- 标签系统：文章标签、按标签筛选、Tag Agent、标签管理

---

## 技术约束

- 本地优先
- 无需注册登录或订阅
- 不主动采集用户数据
- 支持 Windows / Linux / macOS
- 支持标准 API 的大语言模型服务，包括本地模型

---

## 项目计划

### Week 1：项目骨架 + 最小闭环

- 搭建 Electron + Vue 3 + Vite + TypeScript
- 建立 Main / Renderer / Preload 结构
- 建立 SQLite `feeds`、`entries` 表
- 封装 addFeed、listEntries IPC
- 使用 `rss-parser` 解析一个真实 RSS 源
- 实现侧边栏和文章列表页面
- 里程碑：输入 RSS URL -> 保存订阅源 -> 显示文章标题列表

### Week 2：Feed 同步 + 阅读器

- Feed 手动同步和定时同步
- OPML 导入导出
- 已读/未读/收藏状态
- 正文提取与 HTML 清洗
- HTML 转 Markdown 并缓存
- Reader 阅读视图
- 主题、字号、行距、暗色模式
- 里程碑：完整跑通“订阅 -> 同步 -> 清洗 -> 阅读”

### Week 3：AI 摘要和翻译

- LLM Provider CRUD
- Provider 连通性测试
- Summary Agent
- Translation Agent
- 通过 IPC event 推送流式输出进度
- 摘要和翻译面板 UI
- LLM 调用错误处理
- 里程碑：配置模型 -> 对文章生成摘要 -> 对文章分段翻译

### Week 4：加分功能和体验完善

- 笔记 CRUD（视进度，由 A/B/D 协作）
- 单篇/多篇 Markdown 导出（视进度，由 A/B/D 协作）
- 标签 CRUD 和文章关联（视进度，由 A/B/D 协作）
- LLM 用量记录
- 日志和错误提示（Team D）
- UI 细节优化

### Week 5：测试、打包、汇报

- Windows 本机测试
- Linux / macOS 环境打包验证
- 准备 5-10 个测试 RSS 源
- 准备 2-3 个 LLM Provider 测试配置
- 修复关键 Bug
- README 和演示脚本
- 汇报 PPT 和分工说明

### Week 6：缓冲

- 只修 Bug，不增加新功能
- 确保最终演示稳定

---

## 开发记录

| 日期 | 成员 | 内容 |
|---|---|---|
| 2026-05-16 | 全体成员 | 创建 GitHub 仓库，确定项目方向 |
| 2026-05-21 | 全体成员 | 明确项目 MVP 范围：Feed / OPML、Feed 同步、内容清洗、文章展示、Summary Agent、Translation Agent、LLM Providers |
| 2026-05-21 | 全体成员 | 确定技术选型：Electron、Vue 3、TypeScript、Node.js、SQLite |
| 2026-05-21 | 全体成员 | 完成团队分工调整：Team A 3 人、Team B 3 人、Team C 4 人、Team D 1 人 |
| 2026-05-21 | 全体成员 | 更新第一周汇报材料和 README 项目计划 |
