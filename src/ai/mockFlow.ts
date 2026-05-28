import { pathToFileURL } from 'node:url'

import { mockArticle } from './mockArticle.js'
import { clearProviders, registerProvider } from './providerRegistry.js'
import {
  MOCK_PROVIDER_ID,
  mockProvider,
} from './providers/mockProvider.js'
import { summarizeArticle } from './summaryAgent.js'
import { translateArticle } from './translationAgent.js'

export async function runMockFlow(): Promise<void> {
  clearProviders()
  registerProvider(mockProvider)

  const summaryResult = await summarizeArticle(mockArticle, {
    providerId: MOCK_PROVIDER_ID,
    model: 'mock-summary-model',
    language: 'zh-CN',
    length: 'medium',
  })

  const translationResult = await translateArticle(mockArticle, {
    providerId: MOCK_PROVIDER_ID,
    model: 'mock-translation-model',
    targetLanguage: 'zh-CN',
    bilingual: true,
  })

  console.log(
    JSON.stringify(
      {
        article: {
          id: mockArticle.id,
          title: mockArticle.title,
          source: mockArticle.source,
          language: mockArticle.language,
        },
        summaryResult,
        translationResult,
      },
      null,
      2,
    ),
  )
}

function isDirectRun(): boolean {
  const scriptPath = process.argv[1]

  if (!scriptPath) {
    return false
  }

  return import.meta.url === pathToFileURL(scriptPath).href
}

if (isDirectRun()) {
  runMockFlow().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Team C mock AI flow failed: ${message}`)
    process.exitCode = 1
  })
}
