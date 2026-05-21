# Mercury Vibecoding 第一周汇报 PPT 文案

## 第 1 页：标题页

**Mercury Vibecoding 项目第一周汇报**

复刻开源项目 `neolee/mercury`

本地优先、跨平台、支持 AI 能力的 RSS 阅读器

汇报内容：

- 项目目标
- 技术选型
- 团队分工
- 初步计划
- 风险控制

---

## 第 2 页：项目背景

**我们要做什么**

本项目目标是复刻开源项目 Mercury 的核心功能，完成一个本地优先的 RSS 阅读器。

核心方向：

- 用户可以订阅 RSS / Atom Feed
- 应用可以同步和展示文章内容
- 系统可以清洗文章正文，提供更好的阅读体验
- 支持 AI 摘要和 AI 翻译
- 所有数据优先保存在用户本地

---

## 第 3 页：作业核心要求

**我们优先完成 PDF 中要求的核心功能**

MVP 必做功能：

- Feed / OPML 解析
- Feed 同步
- 文章内容展示
- Cleaned HTML / Cleaned Markdown
- Summary Agent
- Translation Agent
- LLM Providers

技术约束：

- 本地优先
- 无需注册登录
- 不主动采集用户数据
- 支持 Windows / macOS / Linux
- 支持标准 API 的大语言模型服务

---

## 第 4 页：项目定位

**一个本地优先、跨平台、带 AI 能力的 RSS 阅读器**

我们的版本重点放在：

- 本地运行，不做云端 Web 部署
- 数据存在用户电脑上
- 支持跨平台桌面端
- 支持多种 LLM Provider
- 先完成核心验收功能，再做加分功能

一句话总结：

> 先把 Mercury 的 Feed 阅读、内容清洗、摘要和翻译四个核心能力跑通。

---

## 第 5 页：技术选型

**分层技术方案**

- 桌面端：Electron
- 前端：Vue 3 + TypeScript
- 后端逻辑：Electron Main Process 中的 Node.js + TypeScript
- 数据存储：SQLite
- 打包：electron-builder

分层说明：

- Electron：跨平台桌面壳
- Vue 3：界面
- TypeScript：前后端统一语言和类型
- Node.js：本地后端逻辑
- SQLite：本地数据库

---

## 第 6 页：整体架构

**应用结构**

```text
Mercury 桌面应用
├── Renderer 前端：Vue 3 + TypeScript + Vite
├── IPC 安全桥接：contextBridge
├── Main Process 后端：Node.js + TypeScript
├── 本地数据层：SQLite + electron-store
└── 打包发布：electron-builder
```

主要数据流：

用户操作界面  
-> Renderer 调用 IPC  
-> Main Process 执行业务逻辑  
-> 写入或读取 SQLite  
-> 返回结果并更新界面

---

## 第 7 页：核心模块拆分

**按功能边界拆成 4 个模块**

| 模块 | 核心功能 |
|---|---|
| Feed & 同步 | RSS / Atom 解析、OPML、Feed 同步、文章列表 |
| 内容清洗 & 阅读 | 正文提取、HTML 清洗、Markdown 转换、Reader |
| AI Agent | Provider、Summary、Translation、Prompt、用量记录 |
| 基础设施 & 集成 | 脚手架、IPC、数据库、打包、文档 |

这样拆分的好处：

- 每组有清晰交付物
- 模块之间通过 IPC 和数据库集成
- 方便并行开发

---

## 第 8 页：团队分工

**11 人分为 4 组**

| Team | 人数 | 成员 | 负责内容 |
|---|---:|---|---|
| Team A | 3 | 徐佳睿、刘烨铭、曲馥诺 | Feed & 同步 |
| Team B | 3 | 周孙睿、朱宇瑄、章可仲 | 内容清洗 & 阅读 |
| Team C | 4 | 郑一钒、陈岩松、张笑铖、李欣昊 | AI Agent |
| Team D | 1 | 黄博 | 基础设施 & 集成 |

分工原则：

- D 组搭底座
- A/B/C 组实现核心业务
- 加分功能视进度协作完成

---

## 第 9 页：Team A 任务

**Feed & 同步组**

负责 Mercury 的订阅基础能力。

主要任务：

- 添加、删除、更新 Feed
- RSS / Atom 解析
- OPML 导入导出
- 手动同步和定时同步
- 文章列表查询
- 订阅源侧边栏和文章列表界面

交付标准：

> 输入一个 RSS URL，可以在应用里看到文章列表，并能同步更新。

---

## 第 10 页：Team B 任务

**内容清洗 & 阅读组**

负责把文章变成适合阅读的内容。

主要任务：

- 抓取文章原文 HTML
- 使用 Readability 提取正文
- 使用 DOMPurify 清洗 HTML
- 使用 Turndown 转换 Markdown
- 使用 marked 渲染阅读内容
- 支持主题、字号、行距、暗色模式

交付标准：

> 点击文章后，可以看到清洗后的正文，并具有基本阅读体验。

---

## 第 11 页：Team C 任务

**AI Agent 组**

负责摘要、翻译和模型 Provider。

主要任务：

- LLM Provider 配置
- Provider 连通性测试
- Summary Agent
- Translation Agent
- Prompt 模板
- LLM 调用错误处理
- LLM 用量记录

交付标准：

> 用户配置模型后，可以对文章生成摘要和分段翻译。

---

## 第 12 页：Team D 任务

**基础设施 & 集成组**

负责项目底座和最终集成。

主要任务：

- Electron + Vue + Vite 脚手架
- Main / Renderer / Preload 结构
- IPC 安全边界
- SQLite schema 和 migration
- 全局 Layout 和路由结构
- electron-builder 打包配置
- README 和汇报材料维护

说明：

> D 组只有 1 人，因此只负责底座和集成，不默认承担所有加分功能。

---

## 第 13 页：第一阶段计划

**Week 1：项目骨架 + 最小闭环**

目标：

> 跑通 Electron 应用，并能添加 Feed 看到文章标题。

主要任务：

- 搭建 Electron + Vue 3 + Vite + TypeScript
- 建立 Main / Renderer / Preload 结构
- 建立 SQLite `feeds`、`entries` 表
- 封装 addFeed、listEntries IPC
- 使用 `rss-parser` 解析真实 RSS 源
- 实现侧边栏和文章列表页面

里程碑：

> 输入 RSS URL -> 保存订阅源 -> 显示文章标题列表

---

## 第 14 页：后续开发计划

**Week 2-6 初步安排**

| 时间 | 目标 |
|---|---|
| Week 2 | 完成 Feed 同步、OPML、内容清洗、Reader 阅读器 |
| Week 3 | 完成 LLM Provider、Summary Agent、Translation Agent |
| Week 4 | 做加分功能和体验优化 |
| Week 5 | 测试、打包、准备演示 |
| Week 6 | 缓冲，只修 Bug，不加新功能 |

计划原则：

- Week 1 先跑通最小闭环
- Week 2-3 完成核心验收功能
- Week 4 以后再考虑加分功能

---

## 第 15 页：MVP 验收标准

**核心功能完成标准**

到 MVP 阶段，我们希望至少可以演示：

- 添加 RSS 订阅源
- 同步文章列表
- 查看文章正文
- 展示清洗后的 Markdown 内容
- 配置 LLM Provider
- 生成文章摘要
- 生成文章翻译
- 数据保存在本地 SQLite 中
- 应用可以作为桌面端运行

---

## 第 16 页：风险与应对

**主要风险**

| 风险 | 应对 |
|---|---|
| Electron 初期不熟悉 | Week 1 只做最小闭环 |
| RSS 源格式不统一 | 优先兼容常见 RSS / Atom，异常源记录错误 |
| 正文提取不稳定 | Readability 失败时保留原始 HTML 兜底 |
| LLM Provider 兼容性不同 | 先支持 OpenAI-compatible API，再扩展 Adapter |
| D 组只有 1 人 | D 组只做底座，业务功能由 A/B/C 承担 |
| 时间不够 | 死保 Feature ①②③④，加分功能后置 |

---

## 第 17 页：范围控制

**先完成核心，再做加分**

必须完成：

- Feed / OPML
- Feed 同步
- 内容清洗
- 文章阅读
- Summary Agent
- Translation Agent
- LLM Providers

视进度完成：

- 笔记
- 标签
- 导出
- 多语言
- 用量统计
- 日志和调试工具

---

## 第 18 页：当前进展

**第一周准备情况**

已完成：

- 明确项目目标和作业核心要求
- 确定技术选型
- 完成团队分工
- 制定 Week 1-6 初步计划
- 更新 README 和汇报文档

下一步：

- 搭建 Electron + Vue 项目骨架
- 跑通第一个 RSS 源解析
- 建立基础数据库表
- 实现最小文章列表展示

---

## 第 19 页：汇报总结

**我们的项目方案**

我们将使用 Electron 做跨平台桌面端，Vue 3 + TypeScript 做前端界面，Node.js + TypeScript 做本地后端逻辑，SQLite 做本地数据库。

团队按 Feed、阅读、AI、基础设施四个方向并行开发。

第一阶段目标是先跑通最小闭环，后续逐步完成内容清洗、AI 摘要和翻译。

---

## 第 20 页：一句话总结

> 我们的目标是复刻一个本地优先、跨平台、支持 AI 摘要和翻译的 Mercury RSS 阅读器。

核心策略：

> 先死保 Feed 同步、内容清洗、摘要和翻译四个核心功能，再根据进度补充笔记、标签、导出和用量统计等加分项。
