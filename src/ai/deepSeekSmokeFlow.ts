import { mockArticle } from './mockArticle.js'
import { clearProviders, registerProvider } from './providerRegistry.js'
import {
  DEEPSEEK_PROVIDER_ID,
  DEFAULT_DEEPSEEK_MODEL,
  deepSeekProvider,
} from './providers/deepSeekProvider.js'
import { summarizeArticle } from './summaryAgent.js'
import { translateArticle } from './translationAgent.js'
import type { ArticleInput } from './types.js'

const SMOKE_SEGMENT_COUNT = 5

function createSmokeArticle(article: ArticleInput): ArticleInput {
  return {
    ...article,
    id: `${article.id}-deepseek-smoke`,
    contentMarkdown: article.contentMarkdown
      .split(/\n\s*\n/u)
      .slice(0, SMOKE_SEGMENT_COUNT)
      .join('\n\n'),
  }
}

export async function runDeepSeekSmokeFlow(): Promise<void> {
  clearProviders()
  registerProvider(deepSeekProvider)

  const article = createSmokeArticle(mockArticle)
  const model = process.env.DEEPSEEK_MODEL ?? DEFAULT_DEEPSEEK_MODEL
  const connectionOk = await deepSeekProvider.testConnection()

  if (!connectionOk) {
    throw new Error('DeepSeek provider testConnection returned false.')
  }

  const summaryResult = await summarizeArticle(article, {
    providerId: DEEPSEEK_PROVIDER_ID,
    model,
    language: 'zh-CN',
    length: 'short',
  })

  const translationResult = await translateArticle(article, {
    providerId: DEEPSEEK_PROVIDER_ID,
    model,
    targetLanguage: 'zh-CN',
    bilingual: true,
  })

  console.log(
    JSON.stringify(
      {
        provider: {
          id: DEEPSEEK_PROVIDER_ID,
          model,
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

runDeepSeekSmokeFlow().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Team C DeepSeek smoke flow failed: ${message}`)
  process.exitCode = 1
})
