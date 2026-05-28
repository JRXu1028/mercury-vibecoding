import { getProvider } from './providerRegistry.js'
import type {
  ArticleInput,
  LLMMessage,
  SummaryLength,
  SummaryOptions,
  SummaryResult,
} from './types.js'

const DEFAULT_SUMMARY_LANGUAGE = 'zh-CN'
const DEFAULT_SUMMARY_LENGTH: SummaryLength = 'medium'

interface SummaryLengthSpec {
  guidance: string
  formatting: string
  maxTokens: number
}

const SUMMARY_LENGTH_SPECS: Record<SummaryLength, SummaryLengthSpec> = {
  short: {
    guidance: '提炼文章最核心观点，并保留 1 个高价值支撑细节。',
    formatting: '使用 1 段或 2 个很短的段落，总计约 2-5 句。',
    maxTokens: 768,
  },
  medium: {
    guidance: '概括文章主旨、关键论据、重要数据或结论，让读者快速理解文章价值。',
    formatting: '使用 1-3 个短段落，通常每段 2-3 句。',
    maxTokens: 1536,
  },
  long: {
    guidance: '按重要性梳理主要观点、支撑事实、事件脉络和作者明确给出的结论。',
    formatting: '最多使用 3 个短段落；必要时可以使用简短项目符号提升可读性。',
    maxTokens: 3072,
  },
}

function escapeTaggedValue(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;')
}

function buildTaggedPrompt({
  instructions,
  context,
  content,
}: {
  instructions: string
  context: string
  content: string
}): string {
  return [
    `<instructions>\n${instructions.trim()}\n</instructions>`,
    `<context>\n${escapeTaggedValue(context.trim())}\n</context>`,
    `<content>\n${escapeTaggedValue(content)}\n</content>`,
  ].join('\n\n')
}

function resolveSummaryLengthSpec(length: SummaryLength): SummaryLengthSpec {
  return SUMMARY_LENGTH_SPECS[length]
}

function normalizeArticleMarkdown(article: ArticleInput): string {
  const contentMarkdown = article.contentMarkdown.trim()

  if (!contentMarkdown) {
    throw new Error(
      `Cannot summarize article "${article.id}" because contentMarkdown is empty.`,
    )
  }

  return contentMarkdown
}

function buildSummaryContext(article: ArticleInput): string {
  const lines = [
    `Article ID: ${article.id}`,
    `Title: ${article.title}`,
    `Source language: ${article.language}`,
  ]

  if (article.source) {
    lines.push(`Source: ${article.source}`)
  }

  if (article.url) {
    lines.push(`URL: ${article.url}`)
  }

  if (article.author) {
    lines.push(`Author: ${article.author}`)
  }

  if (article.publishedAt) {
    lines.push(`Published at: ${article.publishedAt}`)
  }

  return lines.join('\n')
}

export function buildSummaryMessages(
  article: ArticleInput,
  options: SummaryOptions = {},
): LLMMessage[] {
  const contentMarkdown = normalizeArticleMarkdown(article)
  const language = options.language ?? DEFAULT_SUMMARY_LANGUAGE
  const length = options.length ?? DEFAULT_SUMMARY_LENGTH
  const lengthSpec = resolveSummaryLengthSpec(length)

  const systemPrompt = [
    '你是一个精确、可靠的文章摘要引擎。',
    '严格根据用户消息中的 <instructions>、<context> 和 <content> 完成摘要。',
    '只输出最终给用户看的摘要，不要输出推理过程、前言、免责声明或“以下是摘要”等套话。',
    '不要编造 <content> 中没有的信息；如果原文未提及，就不要补充。',
  ].join('\n')

  const instructions = [
    `输出语言：${language}。`,
    `摘要长度：${length}。`,
    lengthSpec.guidance,
    lengthSpec.formatting,
    '保留原文中的关键事实、数据、人物、组织和结论。',
    '忽略 RSS/网页模板、导航、版权、广告、订阅引导等与正文无关内容。',
    '使用 Markdown 输出，但不要添加标题，除非原文结构复杂且摘要长度为 long。',
  ].join('\n')

  return [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: buildTaggedPrompt({
        instructions,
        context: buildSummaryContext(article),
        content: contentMarkdown,
      }),
    },
  ]
}

export async function summarizeArticle(
  article: ArticleInput,
  options: SummaryOptions = {},
): Promise<SummaryResult> {
  const language = options.language ?? DEFAULT_SUMMARY_LANGUAGE
  const length = options.length ?? DEFAULT_SUMMARY_LENGTH
  const lengthSpec = resolveSummaryLengthSpec(length)
  const provider = getProvider(options.providerId)
  const messages = buildSummaryMessages(article, { ...options, language, length })
  const response = await provider.chat(messages, {
    model: options.model,
    temperature: 0.2,
    maxTokens: lengthSpec.maxTokens,
  })
  const summary = response.content.trim()

  if (!summary) {
    throw new Error(
      `AI provider "${response.providerId}" returned an empty summary for article "${article.id}".`,
    )
  }

  return {
    articleId: article.id,
    summary,
    language,
    length,
    providerId: response.providerId,
    model: response.model,
    createdAt: response.createdAt,
    usage: response.usage,
  }
}
