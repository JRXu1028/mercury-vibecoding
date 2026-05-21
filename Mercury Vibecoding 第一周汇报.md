# Mercury Vibecoding 周五汇报计划

> 汇报重点：团队分工、初步计划、重点技术选型  
> 项目目标：复刻 `neolee/mercury`，优先完成 PDF p.40 Features 前四点和 p.41 Technical Constraints 前四点。

---

## 一、结论：这个计划可行

桌面端使用 **Electron**，前端使用 **Vue 3 + TypeScript**，后端逻辑运行在 **Electron Main Process** 中，使用 **Node.js + TypeScript** 实现，数据存储使用 **SQLite**。

这版分层表述更清楚：

- **Electron**：跨平台桌面壳
- **Vue 3**：界面
- **TypeScript**：前后端统一语言和类型
- **Node.js**：主进程里的本地后端逻辑
- **SQLite**：本地数据库

这套方案的核心优点是：

- **符合本地优先要求**：无需注册登录，数据存储在用户本地 SQLite 数据库中。
- **符合跨平台要求**：一份代码可以打包 Windows / macOS / Linux 桌面应用。
- **避开 macOS native 限制**：不使用 Swift / AppKit / SwiftUI 等 macOS 原生方案。
- **不依赖云端部署**：应用本体在本地运行，只在用户主动配置 LLM Provider 后调用模型 API。
- **技术成熟且流行**：Electron、Vue 3、TypeScript、SQLite 都是成熟稳定、资料丰富、AI 辅助开发友好的技术。

### MVP 必保范围

| 作业要求 | 我们的实现 |
|---|---|
| ① Feed / OPML 解析 + Sync + 内容呈现 | RSS/Atom 订阅、OPML 导入导出、定时/手动同步、文章列表与阅读 |
| ② 内容清洗 | 正文提取、HTML 清洗、Markdown 转换、阅读样式定制 |
| ③ Summary Agent + LLM Providers | 可配置 OpenAI-compatible Provider，生成文章摘要 |
| ④ Translation Agent | 分段翻译、双语对照、失败重试 |
| 产品体验 | Vue 3 + Element Plus + 统一布局与主题 |
| 本地优先 | SQLite + electron-store，本地保存数据和配置 |
| 平台中立 | Electron 打包 Windows / macOS / Linux |
| 大模型中立 | Provider 抽象，优先支持 OpenAI-compatible API，预留 Adapter |

---

## 二、重点技术选型

### 2.1 总体架构

```text
┌────────────────────────────────────────────────────┐
│                Mercury 桌面应用                    │
│                  Electron                          │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ Renderer 前端                                │  │
│  │ Vue 3 + TypeScript + Vite                    │  │
│  │ Element Plus / Pinia / vue-router / marked   │  │
│  └──────────────────────┬───────────────────────┘  │
│                         │ IPC + contextBridge       │
│  ┌──────────────────────▼───────────────────────┐  │
│  │ Main Process 后端                            │  │
│  │ Node.js + TypeScript                         │  │
│  │ Feed / Sync / Content Cleaner / LLM Agents   │  │
│  └──────────────────────┬───────────────────────┘  │
│                         │                           │
│  ┌──────────────────────▼───────────────────────┐  │
│  │ 本地数据层                                   │  │
│  │ SQLite mercury.db + electron-store           │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  打包：electron-builder                            │
│  输出：Windows .exe / macOS .dmg / Linux AppImage   │
└────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层次 | 技术 | 用途 |
|---|---|---|
| 桌面壳 | Electron | 跨平台桌面应用运行时 |
| 前端 | Vue 3 + TypeScript + Vite | 页面、组件、状态和类型约束 |
| UI | Element Plus | 快速构建统一、成熟的桌面管理型界面 |
| 状态管理 | Pinia | 管理 Feed、文章、设置和 Agent 状态 |
| 本地数据库 | SQLite + better-sqlite3 | 保存订阅源、文章、笔记、标签、LLM 用量 |
| 本地配置 | electron-store | 保存主题、Provider 配置、API Key 等 |
| Feed 解析 | rss-parser | 解析 RSS / Atom，统一为内部 Entry 模型 |
| OPML | fast-xml-parser 或 xml2js | 导入导出订阅源 |
| 正文提取 | @mozilla/readability + jsdom | 从网页 HTML 提取正文 |
| 内容清洗 | DOMPurify + turndown | 清洗 HTML 并转换为 Markdown |
| Markdown 渲染 | marked | 在阅读器中展示清洗后的内容 |
| LLM 调用 | openai SDK | 支持 OpenAI-compatible API 的摘要和翻译 |
| 打包 | electron-builder | 生成多平台安装包 |

### 2.3 为什么这些技术流行且合适

**Electron：成熟主流的跨平台桌面方案**

Electron 被 VS Code、Slack、Discord、Figma、Notion、ChatGPT、Claude 等桌面应用采用。它的优势不是最轻量，而是生态成熟、资料多、跨平台能力稳定，非常适合课程项目按期交付。

**Vue 3 + TypeScript：成熟、易学、AI 友好**

Vue 3 在国内团队中使用广泛，学习成本相对低；TypeScript 可以减少 IPC、数据库字段、前后端数据结构不一致的问题。对小组协作来说，统一使用 TypeScript 也能降低沟通成本。

**SQLite：本地优先应用的经典选择**

SQLite 是嵌入式数据库，不需要用户安装数据库服务，也不需要账号密码。数据就是本地文件，天然符合“所有数据在用户本地”的要求。

**OpenAI-compatible Provider：满足大模型中立**

我们不会把模型能力绑定到某一家厂商。抽象出 Provider 配置，包括 `baseURL`、`apiKey`、`model` 等字段，优先支持兼容 OpenAI API 的服务；如果某些厂商不兼容，则通过 Adapter 扩展。

### 2.4 和 Tauri 的比较

| 方案 | 优点 | 风险 | 结论 |
|---|---|---|---|
| Electron | 生态成熟、资料多、AI 生成代码质量高、前后端都用 TypeScript | 包体较大、内存占用较高 | **更适合本课程项目** |
| Tauri | 包体小、性能好、安全模型较现代 | 需要 Rust 和系统层知识，学习成本更高 | 可作为备选，不作为 MVP 主线 |

结论：**Tauri 更轻，但 Electron 更稳。** 对明天汇报和后续小组协作来说，Electron 是更保守、可交付性更高的选择。

---

## 三、需求与实现对照

| 功能 | 实现方案 | 负责组 |
|---|---|---|
| Feed 添加/删除 | 输入 RSS URL，解析标题、站点、文章条目 | Team A |
| RSS / Atom 解析 | `rss-parser` 统一转换为内部 Entry | Team A |
| OPML 导入导出 | 解析和生成 OPML XML | Team A |
| Feed 同步 | 手动同步 + 定时同步 + 增量更新 + 错误记录 | Team A |
| 文章列表 | 按订阅源、未读、收藏筛选 | Team A |
| 正文提取 | `@mozilla/readability + jsdom` | Team B |
| HTML 清洗 | `DOMPurify` 过滤风险 HTML | Team B |
| Markdown 转换 | `turndown` 转换并缓存到 SQLite | Team B |
| 阅读视图 | `marked` 渲染 Markdown，支持主题、字号、行距 | Team B |
| LLM Provider | Provider CRUD、连通性测试、模型选择 | Team C |
| Summary Agent | 对文章生成摘要，支持语言和长度选项 | Team C |
| Translation Agent | 分段翻译、双语对照、重试失败段落 | Team C |
| 本地存储 | SQLite schema、migration、配置存储 | Team D |
| 打包发布 | electron-builder 多平台构建 | Team D |

---

## 四、团队分工

团队 11 人，分为 4 组：Feed 组 3 人、阅读组 3 人、AI 组 4 人、基础设施组 1 人。

| 小组 | 成员 | 负责内容 | 交付标准 |
|---|---|---|---|
| Team A：Feed & 同步组 | 李欣昊、周孙睿、朱宇瑄 | Feed 添加/删除、RSS / Atom 解析、OPML 导入导出、Feed 同步、文章列表 | 输入 RSS URL 后可以显示文章列表，并能同步更新 |
| Team B：内容清洗 & 阅读组 | 刘烨铭、郑一钒、章可仲 | 正文提取、HTML 清洗、Markdown 转换、Reader 阅读视图、主题和阅读样式 | 点击文章后可以看到清洗后的正文，并具有基本阅读体验 |
| Team C：AI Agent 组 | 徐佳睿、曲馥诺、黄博、张笑铖 | LLM Provider 配置、连通性测试、Summary Agent、Translation Agent、Prompt 模板、LLM 用量记录 | 配置模型后可以生成文章摘要和分段翻译 |
| Team D：基础设施 & 集成组 | 陈岩松 | 项目脚手架、IPC 规范、数据库 schema、全局布局、打包配置、文档 | 应用能稳定启动，各组模块能接入，最终可以打包演示 |

### Team A：Feed & 同步组（3人）

负责 Mercury 的基础订阅能力。

- Feed 添加、删除、更新
- RSS / Atom 解析
- OPML 导入导出
- 同步服务：手动同步、定时同步、错误重试
- 文章列表查询 IPC
- 前端订阅源侧边栏和文章列表

交付标准：**输入一个 RSS URL，可以在应用里看到文章列表，并能同步更新。**

### Team B：内容清洗 & 阅读组（3人）

负责把文章内容变成适合阅读的形态。

- 抓取文章原文 HTML
- 正文提取：`@mozilla/readability + jsdom`
- HTML 清洗：`DOMPurify`
- Markdown 转换：`turndown`
- Reader 阅读视图
- 主题、字号、行距、暗色模式

交付标准：**点击文章后，可以看到清洗后的正文，并具有基本阅读体验。**

### Team C：AI Agent 组（4人）

负责摘要、翻译和模型 Provider。

- LLM Provider 配置：`baseURL / apiKey / model`
- Provider 连通性测试
- Summary Agent
- Translation Agent
- Prompt 模板
- LLM 调用错误处理和用量记录

内部拆分：

| 子任务 | 负责内容 |
|---|---|
| Provider 配置 | Provider CRUD、模型配置、连通性测试 |
| Summary Agent | 摘要生成、流式输出、摘要面板对接 |
| Translation Agent | 分段翻译、双语对照、失败重试 |
| Prompt / 用量 / 集成 | Prompt 模板、LLM 用量记录、AI 面板集成 |

交付标准：**用户配置模型后，可以对文章生成摘要和翻译。**

### Team D：基础设施 & 集成组（1人）

负责项目骨架、数据库、打包和集成。

- Electron + Vue + Vite 脚手架
- IPC 安全边界：`contextBridge`
- SQLite schema 和 migration
- 全局 Layout、路由、Pinia store 规范
- electron-builder 打包
- 日志、错误提示、README、汇报材料

说明：D 组只有 1 人，职责收窄为底座和集成；笔记、标签、导出、多语言等加分功能视进度由相关小组协作完成，不默认压给 D 组。

交付标准：**应用能稳定启动、各组模块能接入、最后能打包演示。**

### 角色建议

| 角色 | 人数 | 职责 |
|---|---:|---|
| 项目负责人 | 1 | 控制范围、同步进度、组织汇报 |
| 前端负责人 | 1 | 统一组件风格、页面结构、交互规范 |
| 后端负责人 | 1 | 统一 IPC、数据库 schema、服务接口 |
| 测试/集成负责人 | 1 | 负责最终联调、演示数据、打包检查 |

---

## 五、初步计划

### Week 1：项目骨架 + 最小闭环

目标：跑通 Electron 应用，并能添加 Feed 看到文章标题。

| 任务 | 负责 |
|---|---|
| 搭建 Electron + Vue 3 + Vite + TypeScript | Team D |
| 建立 Main / Renderer / Preload 结构 | Team D |
| 建立 SQLite `feeds`、`entries` 表 | Team D |
| 封装 addFeed、listEntries IPC | Team A |
| 使用 `rss-parser` 解析一个真实 RSS 源 | Team A |
| 实现侧边栏和文章列表页面 | Team A |

里程碑：**输入 RSS URL -> 保存订阅源 -> 显示文章标题列表。**

### Week 2：Feed 同步 + 阅读器

目标：完成作业 Feature ①② 的主要流程。

| 任务 | 负责 |
|---|---|
| Feed 手动同步和定时同步 | Team A |
| OPML 导入导出 | Team A |
| 已读/未读/收藏状态 | Team A |
| 正文提取与 HTML 清洗 | Team B |
| HTML 转 Markdown 并缓存 | Team B |
| Reader 阅读视图 | Team B |
| 主题、字号、行距、暗色模式 | Team B |

里程碑：**完整跑通“订阅 -> 同步 -> 清洗 -> 阅读”。**

### Week 3：AI 摘要和翻译

目标：完成作业 Feature ③④。

| 任务 | 负责 |
|---|---|
| LLM Provider CRUD | Team C |
| Provider 连通性测试 | Team C |
| Summary Agent | Team C |
| Translation Agent | Team C |
| 流式输出到前端：通过 IPC event 推送进度 | Team C |
| 摘要和翻译面板 UI | Team C |
| LLM 调用错误处理 | Team C |

里程碑：**配置模型 -> 对文章生成摘要 -> 对文章分段翻译。**

### Week 4：加分功能和体验完善

目标：在 MVP 稳定后补充辅助功能。

| 任务 | 负责 |
|---|---|
| 笔记 CRUD | A/B/D 协作，视进度 |
| 单篇/多篇 Markdown 导出 | A/B/D 协作，视进度 |
| 标签 CRUD 和文章关联 | A/B/D 协作，视进度 |
| LLM 用量记录 | Team C |
| 日志和错误提示 | Team D |
| UI 细节优化 | 全员 |

说明：Week 4 的功能是 **Stretch Goals**，如果进度不够，可以砍掉，不影响作业核心验收。

### Week 5：测试、打包、汇报

目标：能稳定演示和交付。

| 任务 | 负责 |
|---|---|
| Windows 本机测试 | 全员 |
| Linux / macOS 环境打包验证 | Team D |
| 准备 5-10 个测试 RSS 源 | Team A |
| 准备 2-3 个 LLM Provider 测试配置 | Team C |
| 修复关键 Bug | 全员 |
| README 和演示脚本 | Team D |
| 汇报 PPT 和分工说明 | 全员 |

里程碑：**有可运行应用、有演示数据、有清晰汇报材料。**

### Week 6：缓冲

只修 Bug，不加新功能。确保演示稳定。

---

## 六、数据库初步设计

```sql
feeds (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  site_url TEXT,
  description TEXT,
  last_sync_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

entries (
  id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  author TEXT,
  content_html TEXT,
  content_md TEXT,
  summary TEXT,
  published_at INTEGER,
  fetched_at INTEGER NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_starred INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(feed_id) REFERENCES feeds(id)
);

llm_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT,
  default_model TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

llm_usage (
  id TEXT PRIMARY KEY,
  provider_id TEXT,
  model TEXT,
  agent_type TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

notes (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  content_md TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(entry_id) REFERENCES entries(id)
);

tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT
);

entry_tags (
  entry_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (entry_id, tag_id)
);
```

---

## 七、关键风险和应对

| 风险 | 概率 | 应对 |
|---|---:|---|
| Electron 初期不熟悉 | 高 | Week 1 先做最小应用，不追求复杂功能 |
| 需求范围过大 | 高 | Feature ①②③④ 死保，笔记/标签/多语言/用量统计作为加分项 |
| RSS 源格式不统一 | 高 | 优先兼容 RSS / Atom 常见格式，异常源记录错误但不中断同步 |
| 正文提取效果不稳定 | 中 | Readability 失败时保留原始 HTML 或 Feed 原文作为兜底 |
| LLM Provider 不完全兼容 OpenAI API | 中 | 先支持 OpenAI-compatible API，再通过 Adapter 扩展特殊厂商 |
| 流式输出实现复杂 | 中 | Electron 内部用 IPC event 推送 token/段落，不使用 Web SSE 作为主方案 |
| `better-sqlite3` 原生依赖打包问题 | 中 | 提前验证 electron-builder rebuild，必要时切换到 `sqlite3` 或 WASM SQLite |
| API Key 本地保存安全 | 中 | 使用 electron-store 保存，后续可接入系统 keychain；汇报中说明不上传用户密钥 |

---

## 八、周五汇报话术建议

### 1. 技术选型

桌面端使用 Electron，前端使用 Vue 3 + TypeScript，后端逻辑运行在 Electron Main Process 中，使用 Node.js + TypeScript 实现，数据存储使用 SQLite。LLM 部分通过 Provider 抽象支持 OpenAI-compatible API，不绑定单一模型厂商。

这套技术不是最轻量，但很成熟、资料多、AI 辅助开发效果好，适合我们在课程周期内完成一个可运行的本地优先桌面应用。

### 2. 团队分工

我们按功能边界分成四组：Feed 组、阅读组、AI 组、基础设施组。  
这样每组都有清晰交付物，最后通过 IPC 和数据库集成。

### 3. 初步计划

第一周跑通最小闭环，第二周完成订阅和阅读，第三周完成摘要和翻译，第四周做加分功能和体验优化，第五周测试打包并准备演示，第六周只作为缓冲。

### 4. 风险控制

我们的原则是：**先完成核心验收，再做加分功能。**  
如果时间不够，笔记、标签、多语言、用量统计都可以延期，但 Feed、内容清洗、摘要、翻译必须完成。

---

## 九、明天汇报可用的一句话总结

> 我们的方案是用 Electron 做跨平台桌面端，Vue 3 + TypeScript 做前端界面，Node.js + TypeScript 做 Electron Main Process 中的本地后端逻辑，SQLite 做本地数据库，从而实现一个本地优先、跨平台的 Mercury 复刻版。先死保 Feed 同步、内容清洗、摘要和翻译四个核心功能，再根据进度补充笔记、标签、导出和用量统计等加分项。
