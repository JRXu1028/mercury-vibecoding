# Vibe Reader · Mercury Vibecoding Project

> 本地优先、跨平台、支持 AI 摘要 / 翻译 / 标签的 RSS 阅读器

[![Release](https://img.shields.io/badge/release-v0.2.7-blue)](https://github.com/JRXu1028/mercury-vibecoding/releases/latest)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](https://github.com/JRXu1028/mercury-vibecoding/releases/latest)
[![License](https://img.shields.io/badge/license-course%20project-orange)]()
[![Tests](https://img.shields.io/badge/tests-54%2F54-brightgreen)]()

## 项目简介

本项目为课程小组作业，目标是在 GitHub 开源项目 Mercury 的基础上，通过 Vibecoding 的方式复刻其核心功能。

参考项目：https://github.com/neolee/mercury

> 应用名 **Vibe Reader**（v0.2.0 起重命名，原 Mercury Vibecoding；当前最新 **v0.2.7**）。仓库保留原项目代号 `mercury-vibecoding`。

## 核心特性

- 📡 **订阅管理**：RSS / Atom 解析、OPML 导入导出、手动 + 定时自动同步
- 📖 **沉浸阅读**：Readability 正文提取、HTML 清洗、Markdown 渲染、Light / Sepia / Dark 三主题、字号行距可调
- 🤖 **AI 增强**：流式摘要（SSE 推送，不阻塞 UI）、分段翻译、结果持久化、四种 LLM Provider（Mock / DeepSeek / OpenAI-Compatible / ECNU）
- 🏷️ **知识管理**：文章标签、阅读笔记、按标签筛选
- 🔒 **本地优先**：数据存于本地 SQLite，零配置零注册，不主动采集用户数据
- 🖥️ **跨平台**：macOS（arm64）、Windows（x64）、Linux（AppImage / deb）三平台 CI 自动构建

## 下载安装

👉 [GitHub Release 页面](https://github.com/JRXu1028/mercury-vibecoding/releases/latest)

详细的安装步骤、使用指南和常见问题请参阅 **[INSTALL_GUIDE.md](INSTALL_GUIDE.md)**。

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
| 本地数据库 | SQLite (node:sqlite) | 保存订阅源、文章、笔记、标签、LLM 用量 |
| 本地配置 | SQLite llm_providers 表 | 保存 Provider 配置信息 |
| Feed 解析 | rss-parser | 解析 RSS / Atom |
| OPML | fast-xml-parser | 导入导出订阅源 |
| 正文提取 | @mozilla/readability + jsdom | 从网页 HTML 提取正文 |
| 内容清洗 | DOMPurify + turndown | 清洗 HTML 并转换为 Markdown |
| Markdown 渲染 | marked + highlight.js | 在阅读器中渲染 Markdown 为富文本 |
| LLM 调用 | 原生 fetch (OpenAI-compatible) | 调用 OpenAI-compatible API |
| 打包 | electron-builder | 生成 Windows / macOS / Linux 安装包 |

---

## 架构分层

```text
Vibe Reader 桌面应用
├── Renderer 前端：Vue 3 + TypeScript + Vite
├── IPC 安全桥接：contextBridge
├── Main Process 后端：Node.js + TypeScript
├── 本地数据层：SQLite mercury-vibecoding.db
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
| Team A：Feed & 同步组 | 李欣昊、周孙睿、朱宇瑄 | Feed 添加/删除、RSS / Atom 解析、OPML 导入导出、Feed 同步、文章列表 | 输入 RSS URL 后可以显示文章列表，并能同步更新 |
| Team B：内容清洗 & 阅读组 | 刘烨铭、郑一钒、章可仲 | 正文提取、HTML 清洗、Markdown 转换、Reader 阅读视图、主题和阅读样式 | 点击文章后可以看到清洗后的正文，并具有基本阅读体验 |
| Team C：AI Agent 组 | 徐佳睿、曲馥诺、黄博、张笑铖 | LLM Provider 配置、连通性测试、Summary Agent、Translation Agent、Prompt 模板、LLM 用量记录 | 配置模型后可以生成文章摘要和分段翻译 |
| Team D：基础设施 & 集成组 | 陈岩松 | 项目脚手架、IPC 规范、数据库 schema、全局布局、打包配置、文档 | 应用能稳定启动，各组模块能接入，最终可以打包演示 |


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

## 当前启动方式（桌面应用）

### 环境准备

要求 Node.js 22+（项目使用 `node:sqlite` 实验性内置模块）。

在项目根目录执行：

```bash
npm install
npm --prefix frontend install
```

### 开发模式启动

该模式会同时启动：
- Electron 主进程
- Vite 前端开发服务器

```bash
npm run dev:desktop
```

### 构建并启动桌面应用

```bash
npm run build:desktop
npm run start:desktop
```

### 各组已接入功能

- **Team A**：Feed 添加 / 删除、RSS / Atom 解析、Feed 手动同步与定时自动同步、OPML 导入导出
- **Team B**：正文抓取与 Readability 提取、HTML 清洗、Markdown 转换与缓存、Reader 阅读视图（Markdown 渲染、多套阅读样式模板、链接应用内/浏览器打开）
- **Team C**：Summary Agent、Translation Agent、Mock / DeepSeek / OpenAI-Compatible / ECNU 四种 Provider、API Key 加密存储与连通性测试、Provider 管理面板、流式摘要与实时翻译推送、LLM 用量统计、AI 结果持久化、侧栏折叠
- **Team D**：项目脚手架与 Electron 桌面化、SQLite 数据库 schema（10 张表 + 增量迁移）、35 个 IPC 通道（31 R→M + 4 M→R）、日志系统、Notes/Tags 后端服务 + 前端 UI、Usage 后端服务、跨平台 CI 打包（macOS / Windows / Linux）

---

## 开发记录

| 日期 | 成员 | 内容 |
|---|---|---|
| 2026-05-16 | 全体成员 | 创建 GitHub 仓库，确定项目方向 |
| 2026-05-21 | 全体成员 | 明确项目 MVP 范围：Feed / OPML、Feed 同步、内容清洗、文章展示、Summary Agent、Translation Agent、LLM Providers |
| 2026-05-21 | 全体成员 | 确定技术选型：Electron、Vue 3、TypeScript、Node.js、SQLite |
| 2026-05-21 | 全体成员 | 完成团队分工调整：Team A 3 人、Team B 3 人、Team C 4 人、Team D 1 人 |
| 2026-05-21 | 全体成员 | 更新第一周汇报材料和 README 项目计划 |
| 2026-05-26 | Team A | 完成 Team A 当前阶段开发：落地 `feeds` / `entries` SQLite 数据表与 FeedService（添加、删除、列表、去重入库）、完成 RSS/Atom 解析与 OPML 导入导出并补充测试、实现三栏前端与 Feed 搜索/同步/OPML 交互、完成 Electron 桌面化改造（main + preload + IPC）。 |
| 2026-05-28 | Team B | 完成了文章正文抓取、Readability 提取、HTML 清洗、Markdown 转换与缓存，并接入右侧 Reader 阅读视图，支持主题、字号、行距和 Markdown 查看。|
| 2026-06-01 | Team C | 完成 Summary Agent、Translation Agent、Mock / DeepSeek / OpenAI-Compatible 三种 LLM Provider 接入。 |
| 2026-06-04 | Team D | 完成项目脚手架与 Electron 桌面化改造、SQLite 数据库 schema（6 张表 + 迁移）、25 个 IPC 通道与 contextBridge 桥接、日志系统、Notes/Tags/Usage 后端服务、跨平台 CI 自动构建与打包（macOS dmg + Windows exe）、安装指南文档。 |
| 2026-06-05 | Team C | 完成 API Key 加密存储（Electron safeStorage）、Provider 连通性测试、Provider 管理面板 UI（ProviderPanel）。新增 3 个 IPC 通道（ai:listProviders、ai:testConnection、ai:saveProviderApiKey）、llm_providers 表新增 api_key_encrypted 列。 |
| 2026-06-08 | Team D | 完成 Notes/Tags 前端 UI（EntryTags 组件、EntryNotes 组件），集成到 EntryDetailPane。演示测试数据文档（TEST_DATA.md）。 |
| 2026-06-09 | Team C | 完成第三阶段：侧栏折叠、实时翻译推送（ai:translationSegment M→R 事件）、LLM 用量统计（ai:getUsageStats）、ECNU 大模型接入、翻译/摘要视图。 |
| 2026-06-09 | Team B | 修正了 Reader 改为从 Markdown 渲染展示，新增并区分多套阅读样式模板，优化链接的应用内/浏览器打开方式。 |
| 2026-06-16 | Team B | 完成 Reader 体验修复：应用内链接打开的浏览窗口添加了前进后退刷新功能、应用重命名为Vibe Reader，优化了可缩放内嵌浏览窗口，处理了部分条目403 fallback。|
| 2026-06-13 | Team C | 完成流式摘要生成（SSE 推送）与 AI 结果持久化展示；LLM Provider 流式输出适配。 |
| 2026-06-16 | Team D | 拉取最新 main（8 commit），44/44 测试通过，打包 macOS arm64 dmg/zip，发布 v0.2.0 Release。 |
| 2026-06-16 | Team D | 配置自定义应用图标（`build/icon.png`），版本升至 v0.2.1，重新打包发布。 |
| 2026-06-17 | Team D | 完成 CI/CD 跨平台工作流：GitHub Actions 三平台并行构建（macOS / Windows / Linux），打 tag 触发自动发 release；配置 `publish: null` 禁用 electron-builder 自动发布；新增 `dist:linux` 脚本与 `author/description` 字段。 |
| 2026-06-24 | Team A | 完成 v0.2.5：侧栏折叠面板的文本/图标自适应（折叠态不溢出）；删除冗余 Header 栏回收垂直空间。 |
| 2026-06-24 | Team C | 完成 v0.2.5：流式摘要（SSE 推送，`openAIStream.ts` + `ai:summaryChunk` IPC），不阻塞其他操作；AI 结果持久化（`aiResultService.ts` + `ai:getLatestResults` IPC），切文章/重启不丢失。 |
| 2026-06-24 | Team B | 完成 v0.2.5：内嵌浏览器支持前进/后退/刷新（webContents 导航栈），不再弹外部应用。 |
| 2026-06-24 | Team D | 合并上述改动，bump 至 v0.2.5，CI 自动三平台构建 + 发布 Release。 |
| 2026-06-26 | Team B | 修复了应用内嵌浏览器链接弹新窗口、网页清洗后 Markdown 图片与块级链接渲染异常、以及 entry 卡片格式问题。 |
| 2026-06-26 | Team D | 文档版本号对齐至 v0.2.6（README / INSTALL_GUIDE / DEMO_GUIDE / TEAM_D），author 元数据对齐 Vibe Reader 品牌。 |
| 2026-06-29 | Team B | 重构 Reader 阅读视图界面（`dadf780`）、新增阅读视图工具栏图标（`dd493e4`）、扩充 `contentService.ts` 清洗逻辑与 `readerMarkdown.ts` 渲染管线，新增 10 个测试用例（总计 54/54 通过）。 |
| 2026-06-29 | Team A | 更新整体的 UI 界面、补充 Team A 工作日志（`TEAM_A_WORKLOG.md`）。 |
