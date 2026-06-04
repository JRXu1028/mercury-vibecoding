# Team C 实现说明（AI 摘要与翻译）

## 负责范围

当前实现覆盖 Team C 第一版 AI 模块与桌面端接入能力：

- 通过统一 Provider 抽象生成文章摘要
- 通过同一套 Provider 抽象翻译 Markdown 文章
- 提供 Mock LLM Provider，便于无 API Key 的本地验证
- 提供 DeepSeek Provider，支持通过运行时环境变量接真实模型
- 提供 mock article 数据和独立 mock flow
- 通过 Electron IPC / preload 暴露当前文章的 AI 摘要与翻译能力
- 在桌面端文章详情页提供 Mock / DeepSeek Provider 切换，并展示结果

第一版重点是跑通框架、接口边界和真实 Provider 端到端链路。它不把 AI 结果写入 SQLite，不提供 API Key 输入框，也不做复杂 Provider 管理、模型管理、流式输出、历史记录或结果持久化。

## 当前架构

- 运行环境：Node.js + TypeScript
- 模块位置：`src/ai/`
- 统一导出入口：`src/index.ts`
- Mock 演示命令：`npm run dev:ai`
- 桌面端入口：`src/electronMain.ts` + `electron/preload.cjs` + `frontend/src/components/EntryDetailPane.vue`

当前文件结构：

```txt
src/ai/
  types.ts
  providerRegistry.ts
  providers/
    mockProvider.ts
    deepSeekProvider.ts
    openAICompatibleProvider.ts
  summaryAgent.ts
  translationAgent.ts
  mockArticle.ts
  mockFlow.ts
  deepSeekSmokeFlow.ts
  openAICompatibleSmokeFlow.ts
```

模块分为三层：

- 类型层：定义 Team C 与其他团队协作的输入输出契约。
- Agent 层：负责任务流程、prompt 构造和结果组装。
- Provider 层：隐藏具体模型服务差异，对外实现统一 `LLMProvider` 接口。

## 输入类型

`ArticleInput` 是第一版上游文章输入契约，字段包括：

- `id`
- `title`
- `url`
- `source`
- `author`
- `publishedAt`
- `language`
- `contentMarkdown`

Team C 期望 `contentMarkdown` 已经是清洗后的 Markdown 正文。RSS 解析、正文清洗和文章持久化不属于第一版 Team C 范围。

## 输出类型

`SummaryResult` 包含：

- `articleId`
- `summary`
- `language`
- `length`
- `providerId`
- `model`
- `createdAt`
- `usage`

`TranslationResult` 包含：

- `articleId`
- `targetLanguage`
- `bilingual`
- `segments`
- `providerId`
- `model`
- `createdAt`
- `usage`

每个翻译段落 `TranslationSegment` 保留：

- `index`
- `source`
- `translated`
- `status`
- `error`

## Provider 注册机制

`src/ai/providerRegistry.ts` 提供：

- `registerProvider(provider, options)`
- `getProvider(providerId)`
- `hasProvider(providerId)`
- `listProviderIds()`
- `clearProviders()`
- `DEFAULT_PROVIDER_ID`

默认 Provider ID 是 `mock`。重复注册同一个 provider 时默认抛出错误；如果确实需要覆盖，可以传入 `overwrite: true`。

## Mock Provider

`src/ai/providers/mockProvider.ts` 导出：

- `MOCK_PROVIDER_ID`
- `mockProvider`

Mock Provider 实现了 `LLMProvider`：

- `testConnection()` 固定返回 `true`
- `listModels()` 返回 mock 模型 id
- `chat()` 返回稳定的 mock 文本和 mock token usage

Mock Provider 不发起真实网络请求，也不需要真实 API Key。

## Mock 数据与演示入口

`src/ai/mockArticle.ts` 提供了一条可复用的 `ArticleInput` mock 数据，内容基于本地 `repos/skillsbench-report.md` 压缩整理，适合后续 Team C 组员在没有 RSS 清洗结果、没有数据库、没有真实 API Key 的情况下直接验证摘要和翻译流程。

`src/ai/mockFlow.ts` 会注册 Mock Provider，并使用这条 mock article 依次调用：

- `summarizeArticle(...)`
- `translateArticle(...)`

推荐后续开发或改动 Agent 时先运行：

```bash
npm run dev:ai
```

如果输出中包含 `article`、`summaryResult` 和 `translationResult`，就说明 mock 数据、Provider 注册、Summary Agent 和 Translation Agent 的基础链路仍然可用。

## DeepSeek Provider

`src/ai/providers/deepSeekProvider.ts` 导出：

- `DEEPSEEK_PROVIDER_ID`
- `DEFAULT_DEEPSEEK_MODEL`
- `DEFAULT_DEEPSEEK_BASE_URL`
- `createDeepSeekProvider()`
- `deepSeekProvider`

DeepSeek Provider 从环境变量读取配置：

- `DEEPSEEK_API_KEY`：必填
- `DEEPSEEK_MODEL`：可选，默认 `deepseek-v4-flash`
- `DEEPSEEK_BASE_URL`：可选，默认 `https://api.deepseek.com`

不要把真实 API Key 写入源码、文档、日志或提交脚本。

## 桌面端 IPC 与 UI 接入

桌面端已接入 Team C AI 能力：

- Main Process 在 `src/electronMain.ts` 注册 `mockProvider` 和 `deepSeekProvider`。
- Main Process 暴露 `ai:summarizeEntry` 和 `ai:translateEntry` IPC。
- IPC 复用 Team B `ContentService.getEntryContent(...)` 读取 cleaned Markdown，并构造 `ArticleInput`。
- preload 在 `electron/preload.cjs` 中暴露 `summarizeEntry` 和 `translateEntry`。
- Renderer 通过 `frontend/src/api/client.ts` 的 `teamAApi.summarizeEntry(...)` 和 `teamAApi.translateEntry(...)` 调用 IPC。
- 文章详情页 `frontend/src/components/EntryDetailPane.vue` 提供 `Mock / DeepSeek` 分段选择。
- 摘要和翻译请求都会带上当前 `providerId`。
- 切换 Provider 时会清空旧 AI 结果，避免 mock 与 deepseek 结果混淆。
- cleaned Markdown 为空时，UI 会提示“当前文章没有可用于 AI 处理的 cleaned Markdown，请刷新正文或换一篇文章。”

DeepSeek API Key 仍只允许从启动 Electron 的 shell 环境变量 `DEEPSEEK_API_KEY` 读取。Renderer 不展示、不保存、不记录 API Key，也不提供 API Key 输入框。

## OpenAI-compatible Provider

`src/ai/providers/openAICompatibleProvider.ts` 是通用 OpenAI-compatible Provider，用于接入兼容 `/chat/completions` 的模型服务，例如 ModelBest/Ali、OpenRouter 或官方 OpenAI Chat Completions。

该 Provider 导出：

- `OPENAI_COMPATIBLE_PROVIDER_ID`
- `DEFAULT_OPENAI_COMPATIBLE_BASE_URL`
- `DEFAULT_OPENAI_COMPATIBLE_MODEL`
- `createOpenAICompatibleProvider()`
- `openAICompatibleProvider`

环境变量：

- `OPENAI_COMPATIBLE_API_KEY`：必填
- `OPENAI_COMPATIBLE_BASE_URL`：可选，默认 `https://api.openai.com/v1`
- `OPENAI_COMPATIBLE_MODEL`：可选，默认 `gpt-4o-mini`
- `OPENAI_COMPATIBLE_PROVIDER_ID`：可选，默认 `openai-compatible`
- `OPENAI_COMPATIBLE_PROVIDER_NAME`：可选，仅用于 smoke flow 输出

如果 `OPENAI_COMPATIBLE_BASE_URL` 已经是完整的 `/chat/completions` 地址，会直接使用；如果只是 base URL，会自动拼接 `/chat/completions`。

## Summary Agent 流程

`summarizeArticle(article, options)` 执行流程：

```txt
ArticleInput + SummaryOptions
  -> buildSummaryMessages(...)
  -> getProvider(providerId)
  -> provider.chat(...)
  -> SummaryResult
```

Agent 会校验 `contentMarkdown` 不能为空，构造带标签分区的 prompt，调用指定 Provider，并返回结构化 `SummaryResult`。

## Translation Agent 流程

`translateArticle(article, options)` 执行流程：

```txt
ArticleInput + TranslationOptions
  -> 按空行切分 Markdown 段落
  -> 对每个段落 buildTranslationMessages(...)
  -> getProvider(providerId)
  -> 对每个段落调用 provider.chat(...)
  -> TranslationResult
```

第一版使用简单的空行分段策略。如果单个段落失败，该段会记录 `status: 'failed'` 和 `error`，整体仍返回 `TranslationResult`，避免一个段落失败导致整篇结果丢失。

## 运行方式

在 `mercury-vibecoding` 目录下执行：

```bash
npm run build
npm run dev:ai
```

期望结果：

- `npm run build` 通过 TypeScript 编译。
- `npm run dev:ai` 输出包含 `article`、`summaryResult` 和 `translationResult` 的结构化 JSON。

如果要用 DeepSeek 真实环境测试同一套 Agent 流程：

```powershell
$env:DEEPSEEK_API_KEY="<your-deepseek-api-key>"
npm run dev:ai:deepseek
```

`dev:ai:deepseek` 使用较短的 smoke article 片段，以较低成本验证 Provider 注册、`testConnection`、摘要、翻译和结构化输出。

如果要演示桌面端真实链路：

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run build:desktop
$env:DEEPSEEK_API_KEY="<your-deepseek-api-key>"
node_modules\.bin\electron.cmd dist\electronMain.js
```

注意：

- 必须在 `mercury-vibecoding` 项目根目录启动 Electron。
- 如果 `node_modules\.bin\electron.cmd --version` 显示 Node 版本而不是 Electron 版本，通常是当前 shell 存在 `ELECTRON_RUN_AS_NODE=1`，需要先移除该环境变量。
- 演示时先用 `Mock` 验证 UI 链路，再切到 `DeepSeek` 验证真实模型链路。

如果要测试兼容 OpenAI Chat Completions 的第三方服务，例如 ModelBest/Ali 的 `gpt-5.5`：

```powershell
$env:OPENAI_COMPATIBLE_API_KEY="<your-api-key>"
$env:OPENAI_COMPATIBLE_BASE_URL="https://llm-center.ali.modelbest.cn/llm/v1/chat/completions"
$env:OPENAI_COMPATIBLE_MODEL="gpt-5.5"
$env:OPENAI_COMPATIBLE_PROVIDER_ID="modelbest-gpt55"
$env:OPENAI_COMPATIBLE_PROVIDER_NAME="ModelBest GPT-5.5 Provider"
npm run dev:ai:openai-compatible
```

该脚本同样使用较短的 smoke article 片段，验证 provider 注册、`testConnection`、摘要、翻译和结构化输出。

## 统一导出

`src/index.ts` 保留 Team A 原有导出，并追加 Team C 导出：

- AI 类型
- Provider registry
- Mock Provider
- DeepSeek Provider
- OpenAI-compatible Provider
- Summary Agent
- Translation Agent

后续模块可以从项目级入口统一导入 Team C 能力。

## 当前未实现

第一版暂未包含：

- 本地模型 Provider
- 持久化 API Key 存储或密钥管理 UI
- SQLite schema 或结果持久化
- 流式输出
- 重试策略
- 翻译缓存
- 更复杂的 Markdown parser
- 长文 map-reduce 摘要
- 复杂 Provider 管理页面或模型管理页面
- 翻译结果的富 Markdown 渲染、图片/badge/锚点过滤和更精细的排版优化

## 后续接入边界

接真实 Provider 时，在 `src/ai/providers/` 下新增 provider 文件并实现 `LLMProvider` 即可。理论上 Summary Agent 和 Translation Agent 不需要修改。

接 UI 时，应通过 Electron main 或 IPC service layer 调用 Team C。Renderer 组件不应该直接调用 LLM Provider，也不应该保存 API Key。

当前桌面端已经完成最小 UI 接入。后续 UI 优化应继续保持该边界：Renderer 只传 `providerId`、文章 id 和展示选项，不接触 Provider 实例、请求头、Authorization 或 API Key。

接 SQLite 时，在 Agent 调用完成后持久化结构化结果字段即可。Team C 当前只返回数据，不直接写数据库。

接正文清洗时，把清洗后的 Markdown 放入 `ArticleInput.contentMarkdown`。Team C 第一版不负责抓取、解析或清洗文章正文。

## 第二阶段：LLM Provider 配置与连通性测试 UI

### 新增功能

1. **Provider 列表 IPC**：后端新增 `ai:listProviders` handler，从 `llm_providers` 表读取所有已注册 Provider 的元信息（名称、默认模型、API Key 环境变量、是否可用、是否已存储密钥），返回给前端。

2. **连通性测试 IPC**：后端新增 `ai:testConnection` handler，调用对应 Provider 的 `provider.testConnection()`，返回 `{ ok, error }` 结构，失败时包含详细错误原因。

3. **API Key 加密存储 IPC**：后端新增 `ai:saveProviderApiKey` handler，使用 Electron `safeStorage.encryptString()` 将 API Key 加密后存入 `llm_providers.api_key_encrypted`（BLOB 列）。主进程启动时通过 `decryptStoredKey()` 解密并重建对应 Provider 实例，使存储的密钥立即生效，无需重启或重设环境变量。

4. **ProviderPanel 组件**（`frontend/src/components/ProviderPanel.vue`）：独立的 Provider 管理面板，功能包括：
   - 列出所有注册 Provider 及其信息（名称、ID、默认模型、API Key 环境变量、是否可用、是否已存储密钥）
   - API Key 列显示已存储密钥的遮盖状态（`●●●●●●●●`）或"未配置"，并提供"设置 / 修改"按钮，点击弹出密码输入 dialog，输入后调用 `ai:saveProviderApiKey` 加密保存
   - 每行有"测试连接"按钮，点击后显示连接成功（绿色）或失败原因（红色，hover 显示详细错误）
   - 刷新按钮重新加载列表
   - 底部提示：API Key 加密存储在本地数据库，应用内不会明文展示

5. **Provider Settings 入口**：在 `EntryDetailPane.vue` 的 AI 工具栏末尾新增 Setting 图标按钮，点击弹出 `el-dialog` 包裹的 `ProviderPanel`，与项目既有 dialog 模式一致。

### 涉及文件

| 文件 | 改动 |
|------|------|
| `src/database.ts` | `runMigrations()` 追加 `llm_providers.api_key_encrypted BLOB` 列迁移 |
| `src/usageService.ts` | 新增 `getProvider(providerId)` 查询（含 `hasStoredKey`）、`saveApiKey()`、`loadApiKey()` |
| `src/electronMain.ts` | 新增 `ai:listProviders`、`ai:testConnection`、`ai:saveProviderApiKey` IPC handler；新增 `decryptStoredKey()` 在启动时用存储密钥重建 Provider；import 补全 `getProvider`、`listProviderIds`、`createDeepSeekProvider`、`createOpenAICompatibleProvider`、`safeStorage` |
| `electron/preload.cjs` | `teamCApi` 追加 `listProviders()`、`testConnection(providerId)`、`saveProviderApiKey(providerId, apiKey)` |
| `frontend/src/types.ts` | 新增 `ProviderInfo` 接口（含 `hasStoredKey`）；`TeamCBridgeApi` 追加三个方法签名 |
| `frontend/src/api/client.ts` | `teamCApi` 追加 `listProviders()`、`testConnection()`、`saveProviderApiKey()` |
| `frontend/src/element-plus-icons-vue.d.ts` | 追加 `Setting` 图标类型声明 |
| `frontend/src/components/ProviderPanel.vue` | 新建，Provider 管理面板组件（含 API Key 设置 dialog） |
| `frontend/src/components/EntryDetailPane.vue` | 引入 `ProviderPanel`、`Setting` 图标；ai-toolbar 增加设置按钮；新增 Provider 设置 dialog |

### 架构边界说明

- Renderer 仍只传 `providerId`，不接触 Provider 实例。API Key 只在主进程内流通，Renderer 仅传入明文一次（用于保存），主进程加密后不再下发。
- `testConnection` 和 `saveProviderApiKey` 均在主进程执行，错误原因经 IPC 返回。
- `available` 字段由主进程同时检查 `process.env[apiKeyEnvVar]` 和 `hasStoredKey` 决定，Renderer 只展示状态。
- `safeStorage` 加密与系统账户绑定，密钥无法直接被其他用户账户或进程读取。若系统加密不可用，`ai:saveProviderApiKey` 会返回错误而非明文存储。


2026-05-28 已验证：

```bash
npm run build
npm run dev:ai
npm run dev:ai:deepseek
```

验证结果：

- `npm run build` 通过。
- `npm run dev:ai` 成功输出 mock `SummaryResult` 和 `TranslationResult`。
- `npm run dev:ai:deepseek` 成功调用真实 DeepSeek Provider，返回中文摘要和 5 个成功翻译段落。
- 已使用 ModelBest/Ali OpenAI-compatible endpoint 和 `gpt-5.5` 成功跑通同一套 Summary Agent 和 Translation Agent。该测试没有把 API Key 写入项目文件。

2026-05-29 已验证：

```powershell
npm run build
npm run dev:ai
npm run build:desktop
rg -n "sk-[A-Za-z0-9_-]{16,}" . -S
```

验证结果：

- `npm run build` 通过。
- `npm run dev:ai` 成功输出 mock `SummaryResult` 和 `TranslationResult`。
- `npm run build:desktop` 通过，前端 typecheck 和 Vite build 均成功。
- 桌面端 Mock Provider UI 链路可用，摘要与翻译结果可展示。
- 桌面端 DeepSeek Provider UI 链路可用，`AI Summary` 返回真实中文摘要。
- 桌面端 DeepSeek `AI Translation` 已修正模型参数问题，结果显示 `deepseek / deepseek-v4-flash`，不再把 `mock-translation-model` 传给 DeepSeek。
- 安全扫描未发现真实 `sk-...` API Key 落盘。

当前真实 UI 测试观察：

- `Creusot helps you prove your Rust code is correct` 这类 GitHub README 页面可以跑通真实翻译链路，但由于 cleaned Markdown 中包含图片、badge、锚点、分隔线和大量 Markdown 链接，翻译结果排版体验较差。
- 前端结果区目前是最小演示版，只按 segment 输出文本，不做完整 Markdown 渲染、非正文段落过滤或阅读器级排版。
- 为了演示更清晰，桌面端默认翻译请求已改为 `bilingual: false`，只展示译文，避免原文和译文逐段混排造成明显重复。
- 后续建议单独优化 Markdown 分段、翻译前过滤、翻译后渲染和结果区交互，不应和本次真实 Provider 链路提交混在一起扩大范围。

2026-06-04 已验证（第二阶段 Provider 配置与加密存储）：

```bash
npm run build
npm --prefix frontend run build
```

验证结果：

- `npm run build`（TypeScript 后端）通过，无编译错误。
- `npm --prefix frontend run build`（前端 typecheck + Vite build）通过，1607 个模块，typecheck 无报错。
- 新增的 `ProviderPanel.vue`、`ProviderInfo` 接口、`saveProviderApiKey` IPC 链路和 `api_key_encrypted` 迁移均通过编译验证。
