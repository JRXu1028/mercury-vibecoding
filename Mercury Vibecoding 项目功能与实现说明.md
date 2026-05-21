# Mercury Vibecoding 项目功能与实现说明

## 1. 项目整体理解

这个项目可以理解成：

> 做一个本地运行的 RSS 阅读器，但比普通 RSS 阅读器多了 AI 摘要、AI 翻译、内容清洗和本地数据管理。

它不是网站，不需要部署服务器；也不是 macOS 原生 App。它是一个跨平台桌面应用，类似 VS Code、Notion 桌面版那种。

Mercury 本质上是一个 **AI RSS 阅读器**。

用户使用流程大概是：

1. 用户打开桌面应用
2. 添加 RSS 订阅源，比如博客、新闻站、技术网站
3. 应用自动拉取这些网站的文章列表
4. 用户点击文章阅读
5. 应用把网页里的广告、导航、杂乱 HTML 清洗掉，只保留正文
6. 用户可以让 AI 帮忙总结文章
7. 用户可以让 AI 帮忙翻译文章
8. 所有订阅源、文章、笔记、标签、AI 结果都存在本地

所以它不是简单的“展示 RSS”，而是：

> Feed 订阅 + 本地阅读 + 内容清洗 + AI 辅助阅读。

---

## 2. 必须完成的核心功能

根据作业要求，重点是 PDF p.40 Features 前四点和 p.41 Technical Constraints 前四点。

### 2.1 Feed / OPML 解析 + Sync + 内容呈现

这是 RSS 阅读器的基础。

用户需要能：

- 添加一个 RSS 链接
- 解析这个 RSS 源
- 看到文章列表
- 同步最新文章
- 导入 / 导出 OPML 订阅列表

RSS 是什么？

比如一个博客会提供一个 RSS 地址，里面是 XML 格式，大概包含：

```xml
<item>
  <title>文章标题</title>
  <link>文章链接</link>
  <pubDate>发布时间</pubDate>
  <description>文章摘要</description>
</item>
```

我们要做的是把这些 XML 内容解析出来，存成统一的数据结构。

实现方式：

- 用 `rss-parser` 解析 RSS / Atom
- 用 `fast-xml-parser` 或 `xml2js` 解析 OPML
- 用 SQLite 保存订阅源和文章
- 用 Electron 的 Main Process 定时同步 Feed
- 用 Vue 页面展示文章列表

相关表：

```sql
feeds
entries
```

`feeds` 存订阅源，`entries` 存文章。

---

### 2.2 内容清洗

RSS 里有时只有摘要，没有完整正文。所以用户点击文章后，应用可能需要访问原文网页，把正文抓下来。

但网页里有很多杂乱内容：

- 导航栏
- 广告
- 推荐阅读
- 评论区
- 脚本
- 样式
- 无关链接

所以要做“内容清洗”。

目标是：

> 把一个网页变成干净、适合阅读的正文。

实现流程：

```text
文章 URL
-> 抓取 HTML
-> Readability 提取正文
-> DOMPurify 清洗危险 HTML
-> Turndown 转成 Markdown
-> 存入 SQLite
-> 前端用 marked 渲染
```

对应技术：

| 步骤 | 技术 |
|---|---|
| 抓取网页 HTML | Node.js fetch |
| 正文提取 | `@mozilla/readability + jsdom` |
| HTML 安全清洗 | `DOMPurify` |
| HTML 转 Markdown | `turndown` |
| Markdown 展示 | `marked` |

为什么要转 Markdown？

因为 Markdown 更干净，方便：

- 展示
- 存储
- 做摘要
- 做翻译
- 导出笔记

---

### 2.3 Summary Agent

这个就是 AI 摘要。

用户点击一篇文章后，可以点“生成摘要”。

应用会把文章正文发给大语言模型，然后返回摘要。

实现流程：

```text
用户点击生成摘要
-> 前端通过 IPC 通知 Main Process
-> Main Process 读取文章 content_md
-> 调用 LLM Provider
-> 接收模型返回
-> 保存 summary 到 SQLite
-> 前端展示摘要
```

这里的重点是 **LLM Provider**。

我们不能只写死 OpenAI，因为作业要求“大模型中立”。

所以要支持类似这种配置：

```ts
{
  name: "OpenAI",
  baseURL: "https://api.openai.com/v1",
  apiKey: "...",
  model: "gpt-4o-mini"
}
```

也可以换成：

```ts
{
  name: "本地模型",
  baseURL: "http://localhost:11434/v1",
  apiKey: "",
  model: "qwen2.5"
}
```

只要它兼容 OpenAI API，就可以接入。

---

### 2.4 Translation Agent

这个是 AI 翻译。

和摘要类似，但翻译更复杂一点。

因为一篇文章可能很长，不能直接整篇塞给模型，所以建议分段翻译。

实现流程：

```text
文章 Markdown
-> 按段落拆分
-> 每段调用 LLM 翻译
-> 保持原文和译文对应
-> 前端双语展示
```

比如：

```text
原文段落 1
译文段落 1

原文段落 2
译文段落 2
```

需要注意：

- 太长的文章要分段
- 某一段失败可以单独重试
- 翻译结果要和原文段落对应
- 可以控制并发数量，比如同时翻译 2-3 段

---

## 3. 技术分别负责什么

当前技术栈是：

> 桌面端使用 Electron，前端使用 Vue 3 + TypeScript，后端逻辑运行在 Electron Main Process 中，使用 Node.js + TypeScript 实现，数据存储使用 SQLite。

### 3.1 Electron：桌面应用外壳

Electron 负责把 Web 技术变成桌面应用。

它里面有两个重要部分：

| 部分 | 作用 |
|---|---|
| Renderer Process | 显示界面，类似浏览器页面 |
| Main Process | 控制窗口、访问本地文件、数据库、网络请求 |

Vue 页面运行在 Renderer 里。

Feed 同步、数据库读写、AI 调用运行在 Main Process 里。

---

### 3.2 Vue 3 + TypeScript：前端界面

Vue 负责做界面，比如：

- 左边订阅源列表
- 中间文章列表
- 右边阅读区域
- 设置页面
- 摘要面板
- 翻译面板

TypeScript 负责让数据类型更清楚，比如一篇文章是什么结构：

```ts
interface Entry {
  id: string
  feedId: string
  title: string
  url: string
  contentMd?: string
  summary?: string
  isRead: boolean
}
```

---

### 3.3 Node.js + TypeScript：本地后端逻辑

Main Process 里跑 Node.js。

它负责：

- 解析 RSS
- 同步 Feed
- 读写 SQLite
- 抓取网页 HTML
- 清洗正文
- 调用 LLM API
- 处理本地文件导入导出

可以理解成：

> Electron Main Process 就是这个桌面应用里的“本地后端”。

---

### 3.4 SQLite：本地数据库

SQLite 是本地文件数据库。

它不需要服务器，不需要用户安装数据库软件。

可以把数据存在：

```text
mercury.db
```

里面保存：

- 订阅源
- 文章
- 清洗后的正文
- 摘要
- 翻译
- 笔记
- 标签
- LLM 用量记录

---

## 4. 整体架构

可以这样理解：

```text
用户点击界面
   ↓
Vue 前端
   ↓ IPC
Electron Main Process
   ↓
业务服务：Feed / Cleaner / Agent
   ↓
SQLite 本地数据库
```

比如添加 Feed：

```text
用户输入 RSS URL
-> Vue 调用 window.electronAPI.addFeed(url)
-> preload.ts 通过 contextBridge 暴露安全 API
-> Main Process 接收 IPC
-> rss-parser 解析 RSS
-> 写入 SQLite
-> 返回文章列表
-> Vue 更新页面
```

比如生成摘要：

```text
用户点击“生成摘要”
-> Vue 调用 runSummary(entryId)
-> Main Process 从 SQLite 读取文章正文
-> 调用 LLM Provider
-> 返回摘要
-> 保存到 SQLite
-> 前端展示
```

---

## 5. 四个 Team 分别做什么

### 5.1 Team A：Feed & 同步

这是 RSS 阅读器的地基。

负责：

- 添加 Feed
- 删除 Feed
- 解析 RSS / Atom
- 导入导出 OPML
- 同步文章
- 做文章列表

交付物：

> 输入 RSS URL，可以看到文章列表。

---

### 5.2 Team B：内容清洗 & 阅读

负责把文章变得“能好好读”。

负责：

- 抓取原文 HTML
- 提取正文
- 清洗 HTML
- 转 Markdown
- 做阅读器界面
- 支持字体、主题、暗色模式

交付物：

> 点击一篇文章，可以看到干净正文。

---

### 5.3 Team C：AI Agent

这是难度最高的一组。

负责：

- 配置模型 Provider
- 测试模型连接
- 摘要 Agent
- 翻译 Agent
- Prompt 模板
- LLM 用量记录

交付物：

> 配好模型后，可以对文章摘要和翻译。

---

### 5.4 Team D：基础设施 & 集成

D 组只有一个人，所以不能扛太多业务功能。

负责：

- 项目脚手架
- Electron 主进程结构
- IPC 规范
- SQLite 初始化
- 打包配置
- 文档和汇报材料

交付物：

> 项目能跑起来，各组代码能接进去，最后能打包。

---

## 6. 第一周最重要的目标

第一周不要贪多。

最重要的是跑通最小闭环：

```text
打开应用
-> 输入 RSS URL
-> 解析 RSS
-> 存入 SQLite
-> 展示文章标题列表
```

只要这个跑通，项目就有基础了。

第一周不需要完成：

- 完整 AI
- 完整翻译
- 完整笔记系统
- 完整标签系统
- 完整多语言

这些都可以后面做。

---

## 7. 汇报时可以怎么讲

可以用这段话：

> 我们这个项目是复刻 Mercury，一个本地优先的 AI RSS 阅读器。用户可以添加 RSS 订阅源，同步文章，阅读清洗后的正文，并使用大语言模型生成摘要和翻译。  
> 技术上，我们用 Electron 做跨平台桌面端，Vue 3 + TypeScript 做前端界面，Electron Main Process 中用 Node.js + TypeScript 实现本地后端逻辑，SQLite 负责本地数据存储。  
> 团队分成四组：A 组做 Feed 和同步，B 组做内容清洗和阅读器，C 组做 AI 摘要、翻译和 Provider，D 组做基础设施和集成。第一周目标是先跑通添加 RSS 并展示文章列表的最小闭环。

---

## 8. 最容易被老师问的问题

### 8.1 为什么不是普通 Web 应用？

答：

> 作业要求本地优先，不需要用户注册登录，数据在用户本地，所以我们选择桌面应用方案，而不是云端 Web 部署。

### 8.2 Node.js 在哪里？

答：

> Node.js 运行在 Electron Main Process 里，负责本地后端逻辑，比如 Feed 同步、数据库读写、内容清洗和 LLM 调用。

### 8.3 AI 功能是不是必须联网？

答：

> 如果使用云端模型，需要联网；但应用本身不依赖云端部署。我们通过 Provider 抽象支持 OpenAI-compatible API，也可以接入本地模型服务。

### 8.4 数据存在在哪里？

答：

> 订阅源、文章、清洗后的正文、摘要和翻译结果都保存在本地 SQLite 数据库中。

### 8.5 D 组只有一个人够吗？

答：

> D 组只负责底座和集成，不承担主要业务功能。具体业务分别由 A/B/C 组完成，所以任务边界是可控的。
