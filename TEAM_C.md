# Team C: AI 摘要与翻译组

> 成员: 徐佳睿、曲馥诺、黄博、张笑铖
> 职责: AI 摘要、AI 翻译、Provider 管理、流式输出、结果持久化与桌面端接入
> 交付标准: 文章详情页可稳定生成摘要与翻译，Provider 可配置、可测试、可持久化，结果可在切换文章或重启后恢复

---

## 1. 项目架构

```
┌──────────────────────────────────────────────┐
│ Renderer (Vue 3 + Vite + Element Plus)       │
│ frontend/src/components/EntryDetailPane.vue    │
│ frontend/src/components/ProviderPanel.vue      │
├──────────────────────────────────────────────┤
│ Preload / IPC bridge                          │
│ electron/preload.cjs + src/electronMain.ts    │
├──────────────────────────────────────────────┤
│ Main Process / Services                       │
│ src/ai/                                       │
│ src/aiResultService.ts                        │
│ src/usageService.ts                           │
└──────────────────────────────────────────────┘
```

Team C 的核心链路如下：

1. 从文章正文读取清洗后的 Markdown
2. 组装 `ArticleInput`
3. 调用 `SummaryAgent` 或 `TranslationAgent`
4. 通过 IPC 把结果发回前端
5. 将结果持久化，供后续恢复展示

## 2. 实现范围与核心能力

Team C 负责的能力包括：

- 对清洗后的文章正文生成摘要
- 对 Markdown 文章进行翻译
- 提供统一的 Provider 抽象，支持 Mock / DeepSeek / OpenAI-compatible / ECNU
- 提供 Provider 配置、连通性测试与 API Key 加密存储
- 支持流式输出与非阻塞生成体验
- 支持摘要与翻译结果持久化，切换文章或重启应用后可恢复

## 3. 数据模型

Team C 依赖以下持久化能力：

- `llm_providers`：Provider 注册信息与加密密钥元数据
- `llm_usage`：Token 用量与调用统计
- `ai_summaries`：摘要结果持久化
- `ai_translations`：翻译结果持久化

## 4. 阶段推进

### 4.1 第一阶段：基础 Agent 与 Provider 框架

这一阶段建立了 AI 的基础链路：

- 实现 `SummaryAgent` 与 `TranslationAgent`
- 在 `src/ai/types.ts` 中定义统一输入输出契约
- 增加 Provider 注册机制，支持 mock 与真实模型
- 提供 smoke flow，便于在无真实 API Key 的情况下先验证链路

这一阶段确认了从文章内容到结构化输出的端到端流程可以稳定跑通。

### 4.2 第二阶段：Provider 配置与连接测试

这一阶段让 AI 能力真正进入桌面端：

- 通过 Electron IPC 提供 Provider 列表与连通性测试
- 使用 Electron `safeStorage` 对 API Key 做加密存储
- 新增 `ProviderPanel.vue`，支持 Provider 管理与密钥设置
- 在 UI 中展示用量统计与 Provider 状态

这一阶段把 Team C 从命令行原型推进为可直接使用的桌面端能力。

### 4.3 第三阶段：阅读器集成、实时体验与 ECNU 接入

这一阶段把 AI 能力嵌入到真正的阅读流程中：

- 把摘要与翻译接入文章详情页
- 支持动态 Provider 切换与可用性反馈
- 支持翻译生成过程中的实时进度展示
- 接入 ECNU 等 OpenAI-compatible Provider，并提升结果展示的 Markdown 体验

此时 AI 已经不再是单独的调试功能，而是阅读器中的增强能力。

### 4.4 第四阶段：非阻塞生成、流式输出与持久化存储

这一阶段是 Team C 的重点，主要解决体验与数据连续性问题：

- AI 生成过程不再阻塞其他操作
- 摘要与翻译支持流式输出，用户可边生成边查看内容
- 摘要与翻译结果会持久化保存，切换文章或重启应用后可恢复
- 前端可通过 IPC 拉取最新已保存结果
- AI 流程更加接近生产级阅读助手体验

关键实现点包括：

- `openAIStream.ts`：统一处理流式输出
- `summaryAgentStream` / 进度回调：把生成过程实时推送到前端
- `aiResultService.ts`：负责摘要与翻译结果的持久化
- `ai:getLatestResults` / `ai:summaryChunk` / `ai:translationSegment`：支撑状态恢复与实时展示

### 4.5 第五阶段：用户体验优化与内容展示增强

在第四阶段的基础上，Team C 继续补齐一批与使用体验直接相关的优化点：

- 为 Add Feed 流程补充更清晰的加载状态、按钮禁用与提示反馈，降低误操作概率
- 对翻译结果中的链接、图片等非纯文本内容做更稳妥的展示处理，避免媒体内容被错误地当成普通文本
- 优化 Provider 切换时的提示逻辑，未配置 Provider 时会明确提示并引导进入设置面板
- 在翻译视图中对媒体段落做保留展示，提升长文阅读与多媒体内容处理体验

这部分改动虽然不改变 AI 的核心能力，但显著提升了桌面端使用体验和结果可读性。

## 5. 协作纪实

Team C 的工作并不是单纯“接一个模型接口”，而是围绕“阅读体验是否真的可用”持续推进。

- 项目早期，Team C 先把 AI 逻辑抽象成两条稳定链路：摘要和翻译。
- 随后，Team C 把这些能力接入桌面端，让 Provider 可以被管理、测试和配置。
- 再往后，Team C 把 AI 能力嵌入阅读器内，开始支持实时反馈和多 Provider 切换。
- 当前阶段则重点解决生成过程是否顺畅、结果是否可恢复、展示是否清晰等体验问题。

这几步推进的共同目标都是：让 AI 不只是“能生成”，而是“能在阅读场景中稳定、自然地使用”。

## 6. 当前进度

截至当前版本，Team C 已完成：

- Summary Agent 与 Translation Agent
- Mock / DeepSeek / OpenAI-compatible / ECNU Provider 接入
- Provider 管理、API Key 加密存储与连通性测试
- LLM 用量记录
- 桌面端阅读器内的摘要与翻译入口
- 流式输出与实时进度反馈
- 摘要与翻译结果持久化存储
- AI 生成过程不阻塞其他操作

## 7. 验证方式

建议在项目根目录执行：

```bash
npm run build
npm --prefix frontend run build
npm run dev:ai
npm run dev:desktop
```

预期结果包括：

- 后端 TypeScript 构建通过
- 前端构建通过
- Mock flow 可正常输出摘要和翻译
- 桌面端 UI 可触发摘要与翻译生成
- 切换文章后，已生成结果仍可恢复
