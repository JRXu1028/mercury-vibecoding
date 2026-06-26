# Vibe Reader 演示指南

## 0. 演示前准备

### 0.1 下载安装

下载 https://github.com/JRXu1028/mercury-vibecoding/releases/latest 的 `Vibe.Reader-0.2.6-arm64.dmg`。

双击 dmg → 拖入 Applications → 首次启动需右键 → 打开（Gatekeeper）。

### 0.2 启动方式

- **默认（Mock AI）**：直接双击 `Vibe Reader.app`
- **真实 DeepSeek AI**：
  ```bash
  export DEEPSEEK_API_KEY=sk-your-key
  "/Applications/Vibe Reader.app/Contents/MacOS/Vibe Reader" &
  ```
- **OpenAI 兼容**：
  ```bash
  export OPENAI_COMPATIBLE_API_KEY=sk-your-key
  export OPENAI_COMPATIBLE_BASE_URL=https://your-endpoint/v1
  export OPENAI_COMPATIBLE_MODEL=gpt-4o-mini
  "/Applications/Vibe Reader.app/Contents/MacOS/Vibe Reader" &
  ```

> ⚠️ 不用 `open -a` — macOS GUI 应用不继承终端环境变量。

### 0.3 推荐演示 RSS 源

| 名称 | 地址 | 用途 |
|------|------|------|
| 少数派 | `https://sspai.com/feed` | 中文文章，AI 翻译对比 |
| Hacker News | `https://hnrss.org/frontpage` | 英文，演示 AI Summary |
| 阮一峰博客 | `https://www.ruanyifeng.com/blog/atom.xml` | 中文长文 |

---

## 1. 演示流程（约 8 分钟）

### Step 1 — 应用启动与命名（30s）

> 「这是我们这周完成的 Vibe Reader，一个本地优先的 RSS 阅读器。」

- 打开应用，Dock 显示自定义图标
- 顶部菜单栏简洁——**删除了占空间的旧 Header 栏**（本周改动 #6）
- 应用名 **Vibe Reader**（不再叫 Mercury，本周改动 #5）

### Step 2 — 添加订阅源（1 分钟）

- 点 **+ Add Feed**，粘贴 `https://hnrss.org/frontpage`，回车
- 同步完成，文章列表自动出现
- 再加 `https://sspai.com/feed`

### Step 3 — 阅读体验 + 主题切换（1 分钟）

- 点击一篇文章，右侧自动清洗 HTML → Markdown 渲染
- 工具栏切换 **Reader / Markdown** 视图
- 切换 **Light / Sepia / Dark** 主题
- 字号 / 行高调节

### Step 4 — 流式摘要 + 非阻塞（本周亮点 #2，2 分钟）

> 「这是本周最大的改进——摘要生成不再卡 UI。」

- 选一篇英文长文（Hacker News）
- 点 **AI Summary**
- **观察**：摘要逐字流入右侧，可以**同时切换其他文章、点其他按钮**，不被阻塞
- 流式输出由 SSE 推送，体验类似 ChatGPT
- 可在 Summary 进行中切到其他文章 → 演示并发

### Step 5 — AI 结果持久化（本周亮点 #3，1 分钟）

> 「关掉再开，AI 结果还在。」

- 等摘要生成完
- **切到另一篇文章再切回来** → 上次的摘要仍在
- 重启应用 → 同样保留
- 数据存在本地 SQLite (`aiResults` 表)

### Step 6 — 内嵌浏览器（本周亮点 #4，1.5 分钟）

> 「链接不再弹新窗口，像浏览器一样内嵌。」

- 在阅读视图点击文章中的超链接
- **应用内**打开浏览器窗口（不弹外部 Chrome）
- 演示 **前进 / 后退 / 刷新** 按钮（本周新增）
- 窗口可缩放，关闭后回到阅读器

### Step 7 — 侧栏折叠 + 文本适配（本周亮点 #1，1 分钟）

> 「折叠时图标/文本自适应。」

- 点左侧 Feed Sidebar 顶部的折叠按钮
- **展开状态**：显示完整 Feed 名称
- **折叠状态**：仅显示图标，无文本溢出/截断
- 同样适用于中间文章列表栏

### Step 8 — 翻译功能（1 分钟）

- 选中文文章，点 **AI Translation**
- 同样流式输出
- 切换 Provider：Mock ↔ DeepSeek（演示真实翻译质量）

### Step 9 — 标签 + 笔记（30s）

- 给当前文章打标签：**+ Tag** → 输入 "AI" → 回车
- 添加笔记：底部 Notes 区 → **+ Note** → 写一段 → 保存
- 关闭重开 → 标签和笔记都保留

### Step 10 — 数据 + AI 用量（30s，可选）

- 数据库文件位置：`~/Library/Application Support/Vibe Reader/mercury-vibecoding.db`
- Token 用量统计：点 AI 工具栏**齿轮图标 ⚙️** → 打开 Provider 面板 → 底部「用量统计」区
  - 显示 totalCalls / prompt tokens / completion tokens / 总 tokens
  - 右上角刷新按钮可重查

---

## 2. 本周改动对照

| # | 改动 | 演示位置 | Step |
|---|------|----------|------|
| 1 | 侧栏折叠文本适配 | Feed Sidebar 折叠按钮 | Step 7 |
| 2 | 流式摘要 + 非阻塞 | AI Summary 过程中切文章 | Step 4 |
| 3 | AI 结果持久化 | 切文章 / 重启应用 | Step 5 |
| 4 | 内嵌浏览器 back/forward | 点击文章内链接 | Step 6 |
| 5 | 应用改名 Vibe Reader | Dock / 窗口标题 | Step 1 |
| 6 | 删除冗余 Header 栏 | 顶部对比 | Step 1 |

---

## 3. 应急预案

| 状况 | 处理 |
|------|------|
| 首次打开被 Gatekeeper 拦 | 右键应用 → 打开 → 确认 |
| RSS 源同步失败 | 换源；HN/阮一峰最稳 |
| DeepSeek API 余额不足 | 切回 Mock Provider |
| AI Summary 卡住 | 流式 chunk 没推过来，等几秒；或重启应用 |
| 链接打不开内嵌浏览器 | 确认不是 PDF / 外部协议 |

## 4. 提问预演

- **Q: 为什么用 SQLite 而不是 Postgres？**
  A: 本地优先设计，零配置，单文件部署，跨平台一致。

- **Q: 流式怎么实现的？**
  A: 后端 `openAIStream.ts` 调 OpenAI-compatible `/chat/completions` with `stream: true`，通过 IPC `ai:summaryChunk` 事件推送给渲染进程。

- **Q: 持久化怎么不丢？**
  A: `aiResultService.ts` 在每个 chunk 完成后写入 `aiResults` 表，文章切换时通过 `ai:getLatestResults` 读回。

- **Q: 为什么不签名？**
  A: Apple Developer 99 美元/年，课程阶段绕过 Gatekeeper 即可。

- **Q: 内嵌浏览器为什么不用系统 WebView？**
  A: Electron `<webview>` 标签内嵌，通过 `webContents` API 实现导航栈管理（forward/back），与主进程通信实现 IPC 路由。

- **Q: 多平台怎么构建？**
  A: GitHub Actions 矩阵构建（macOS / Windows / Linux），打 tag 触发自动 release。
