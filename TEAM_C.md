# Team C 实现说明（AI 摘要与翻译）

## 负责范围

当前实现覆盖 Team C 第一版 AI 模块基础能力：

- 通过统一 Provider 抽象生成文章摘要
- 通过同一套 Provider 抽象翻译 Markdown 文章
- 提供 Mock LLM Provider，便于无 API Key 的本地验证
- 提供 mock article 数据和独立 mock flow
- 通过统一入口导出能力，方便后续 IPC、UI、测试或真实 Provider 接入

第一版重点是跑通框架和接口边界。它不默认连接真实 LLM 服务，不把 AI 结果写入 SQLite，也不修改 Renderer 前端 UI。

## 当前架构

- 运行环境：Node.js + TypeScript
- 模块位置：`src/ai/`
- 统一导出入口：`src/index.ts`
- Mock 演示命令：`npm run dev:ai`

当前文件结构：

```txt
src/ai/
  types.ts
  providerRegistry.ts
  providers/
    mockProvider.ts
    deepSeekProvider.ts
  summaryAgent.ts
  translationAgent.ts
  mockArticle.ts
  mockFlow.ts
  deepSeekSmokeFlow.ts
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

## 统一导出

`src/index.ts` 保留 Team A 原有导出，并追加 Team C 导出：

- AI 类型
- Provider registry
- Mock Provider
- DeepSeek Provider
- Summary Agent
- Translation Agent

后续模块可以从项目级入口统一导入 Team C 能力。

## 当前未实现

第一版暂未包含：

- OpenRouter 或本地模型 Provider
- 持久化 API Key 存储或密钥管理 UI
- Electron IPC handler
- Renderer UI
- SQLite schema 或结果持久化
- 流式输出
- 重试策略
- 翻译缓存
- 更复杂的 Markdown parser
- 长文 map-reduce 摘要

## 后续接入边界

接真实 Provider 时，在 `src/ai/providers/` 下新增 provider 文件并实现 `LLMProvider` 即可。理论上 Summary Agent 和 Translation Agent 不需要修改。

接 UI 时，应通过 Electron main 或 IPC service layer 调用 Team C。Renderer 组件不应该直接调用 LLM Provider，也不应该保存 API Key。

接 SQLite 时，在 Agent 调用完成后持久化结构化结果字段即可。Team C 当前只返回数据，不直接写数据库。

接正文清洗时，把清洗后的 Markdown 放入 `ArticleInput.contentMarkdown`。Team C 第一版不负责抓取、解析或清洗文章正文。

## 验证状态

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
- 另外已临时注册 ModelBest/Ali OpenAI-compatible provider，使用 `gpt-5.5` 成功跑通同一套 Summary Agent 和 Translation Agent。该测试没有把 API Key 写入项目文件。
