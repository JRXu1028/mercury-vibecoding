import { mockArticle } from './mockArticle.js'
import { clearProviders, registerProvider } from './providerRegistry.js'
import { createOpenAICompatibleProvider } from './providers/openAICompatibleProvider.js'
import { summarizeArticle } from './summaryAgent.js'
import { translateArticle } from './translationAgent.js'
import type { ArticleInput } from './types.js'

const SMOKE_SEGMENT_COUNT = 5

function createSmokeArticle(article: ArticleInput): ArticleInput {
  return {
    ...article,
    id: `${article.id}-openai-compatible-smoke`,
    contentMarkdown: article.contentMarkdown
      .split(/\n\s*\n/u)
      .slice(0, SMOKE_SEGMENT_COUNT)
      .join('\n\n'),
  }
}

export async function runOpenAICompatibleSmokeFlow(): Promise<void> {
  const provider = createOpenAICompatibleProvider({
    id: process.env.OPENAI_COMPATIBLE_PROVIDER_ID ?? 'openai-compatible-smoke',
    name: process.env.OPENAI_COMPATIBLE_PROVIDER_NAME ?? 'OpenAI-Compatible Smoke Provider',
  })

  clearProviders()
  registerProvider(provider)

  const article = createSmokeArticle(mockArticle)
  const model = process.env.OPENAI_COMPATIBLE_MODEL
  const connectionOk = await provider.testConnection()

  if (!connectionOk) {
    throw new Error(`${provider.name} testConnection returned false.`)
  }

  const summaryResult = await summarizeArticle(article, {
    providerId: provider.id,
    model,
    language: 'zh-CN',
    length: 'short',
  })

  const translationResult = await translateArticle(article, {
    providerId: provider.id,
    model,
    targetLanguage: 'zh-CN',
    bilingual: true,
  })

  console.log(
    JSON.stringify(
      {
        provider: {
          id: provider.id,
          name: provider.name,
          model: model ?? 'provider-default',
          smokeSegmentCount: SMOKE_SEGMENT_COUNT,
        },
        article: {
          id: article.id,
          title: article.title,
          source: article.source,
          language: article.language,
        },
        summaryResult,
        translationResult,
      },
      null,
      2,
    ),
  )
}

runOpenAICompatibleSmokeFlow().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Team C OpenAI-compatible smoke flow failed: ${message}`)
  process.exitCode = 1
})
