import { getProvider } from './providerRegistry.js'
import type {
  ArticleInput,
  ArticleLanguage,
  LLMMessage,
  LLMUsage,
  TranslationOptions,
  TranslationResult,
  TranslationSegment,
} from './types.js'

const DEFAULT_TRANSLATION_MAX_TOKENS = 2048

interface TranslationSourceSegment {
  index: number
  source: string
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

function normalizeArticleMarkdown(article: ArticleInput): string {
  const contentMarkdown = article.contentMarkdown.trim()

  if (!contentMarkdown) {
    throw new Error(
      `Cannot translate article "${article.id}" because contentMarkdown is empty.`,
    )
  }

  return contentMarkdown
}

function splitMarkdownIntoSourceSegments(markdown: string): TranslationSourceSegment[] {
  return markdown
    .split(/\n\s*\n/gu)
    .map((source) => source.trim())
    .filter((source) => source.length > 0)
    .map((source, index) => ({ index, source }))
}

function buildTranslationContext({
  article,
  sourceLanguage,
  targetLanguage,
  segment,
  totalSegments,
}: {
  article: ArticleInput
  sourceLanguage: ArticleLanguage
  targetLanguage: ArticleLanguage
  segment: TranslationSourceSegment
  totalSegments: number
}): string {
  const lines = [
    `Article ID: ${article.id}`,
    `Title: ${article.title}`,
    `Source language: ${sourceLanguage}`,
    `Target language: ${targetLanguage}`,
    `Segment: ${segment.index + 1} of ${totalSegments}`,
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

export function buildTranslationMessages(
  article: ArticleInput,
  segment: TranslationSourceSegment,
  options: TranslationOptions,
  totalSegments = 1,
): LLMMessage[] {
  const sourceLanguage = options.sourceLanguage ?? article.language
  const targetLanguage = options.targetLanguage

  const systemPrompt = [
    '你是一个精确、可靠的 Markdown 文章翻译引擎。',
    '严格根据用户消息中的 <instructions>、<context> 和 <content> 完成翻译。',
    '只输出当前段落的译文，不要输出推理过程、前言、解释、免责声明或“以下是译文”等套话。',
    '不要翻译 <content> 之外的内容，也不要编造原文没有的信息。',
  ].join('\n')

  const instructions = [
    `从 ${sourceLanguage} 翻译到 ${targetLanguage}。`,
    '只翻译 <content> 中的当前 Markdown 段落。',
    '保留 Markdown 结构、链接、代码、列表符号和必要的行内格式。',
    '保留专有名词、产品名、代码标识符、URL 和无法可靠翻译的术语。',
    '译文应准确、自然、简洁，并保持原文语气。',
    '如果原文已经是目标语言，也仍然输出整理后的目标语言文本。',
    '结果对象会单独保存原文；即使 bilingual 为 true，也不要在译文里重复原文。',
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
        context: buildTranslationContext({
          article,
          sourceLanguage,
          targetLanguage,
          segment,
          totalSegments,
        }),
        content: segment.source,
      }),
    },
  ]
}

function createEmptyUsage(): LLMUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  }
}

function addUsage(total: LLMUsage, usage: LLMUsage): LLMUsage {
  return {
    promptTokens: total.promptTokens + usage.promptTokens,
    completionTokens: total.completionTokens + usage.completionTokens,
    totalTokens: total.totalTokens + usage.totalTokens,
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function translateArticle(
  article: ArticleInput,
  options: TranslationOptions,
): Promise<TranslationResult> {
  const contentMarkdown = normalizeArticleMarkdown(article)
  const sourceSegments = splitMarkdownIntoSourceSegments(contentMarkdown)
  const provider = getProvider(options.providerId)
  const bilingual = options.bilingual ?? false
  let usage = createEmptyUsage()
  let responseProviderId = provider.id
  let responseModel = options.model ?? 'provider-default'

  const segments: TranslationSegment[] = []

  for (const sourceSegment of sourceSegments) {
    try {
      const messages = buildTranslationMessages(
        article,
        sourceSegment,
        { ...options, bilingual },
        sourceSegments.length,
      )
      const response = await provider.chat(messages, {
        model: options.model,
        temperature: 0.2,
        maxTokens: DEFAULT_TRANSLATION_MAX_TOKENS,
      })
      const translated = response.content.trim()

      if (!translated) {
        throw new Error(
          `AI provider "${response.providerId}" returned an empty translation for article "${article.id}" segment ${sourceSegment.index}.`,
        )
      }

      usage = addUsage(usage, response.usage)
      responseProviderId = response.providerId
      responseModel = response.model

      segments.push({
        index: sourceSegment.index,
        source: sourceSegment.source,
        translated,
        status: 'success',
      })
    } catch (error) {
      segments.push({
        index: sourceSegment.index,
        source: sourceSegment.source,
        translated: '',
        status: 'failed',
        error: getErrorMessage(error),
      })
    }
  }

  return {
    articleId: article.id,
    targetLanguage: options.targetLanguage,
    bilingual,
    segments,
    providerId: responseProviderId,
    model: responseModel,
    createdAt: new Date().toISOString(),
    usage,
  }
}
