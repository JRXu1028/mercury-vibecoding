import { afterEach, describe, expect, it } from 'vitest'
import { clearProviders, registerProvider } from '../src/ai/providerRegistry.js'
import { summarizeArticleStream } from '../src/ai/summaryAgent.js'
import type { ArticleInput, LLMProvider } from '../src/ai/types.js'

const article: ArticleInput = {
  id: 'article-1',
  title: 'Streaming summaries',
  language: 'en',
  contentMarkdown: 'This article explains why streaming summaries improve perceived latency.',
}

function makeProvider(chunks: string[], responseContent = chunks.join('')): LLMProvider {
  return {
    id: 'stream-test',
    name: 'Stream Test Provider',
    capabilities: {
      chat: true,
      streamChat: true,
    },
    async testConnection() {
      return true
    },
    async listModels() {
      return ['stream-model']
    },
    async chat() {
      throw new Error('summarizeArticleStream must use streamChat')
    },
    async streamChat(_messages, _options, onChunk) {
      for (const content of chunks) {
        onChunk({ content })
      }

      return {
        content: responseContent,
        model: 'stream-model',
        providerId: 'stream-test',
        usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
        createdAt: '2026-01-01T00:00:00.000Z',
      }
    },
  }
}

describe('summarizeArticleStream', () => {
  afterEach(() => {
    clearProviders()
  })

  it('passes each chunk and accumulated summary to the callback', async () => {
    registerProvider(makeProvider(['Hello ', 'world']))
    const events: Array<{ chunk: string; accumulated: string }> = []

    await summarizeArticleStream(
      article,
      { providerId: 'stream-test' },
      (chunk, accumulated) => events.push({ chunk, accumulated }),
    )

    expect(events).toEqual([
      { chunk: 'Hello ', accumulated: 'Hello ' },
      { chunk: 'world', accumulated: 'Hello world' },
    ])
  })

  it('returns the complete streamed summary', async () => {
    registerProvider(makeProvider(['Hello ', 'world']))

    const result = await summarizeArticleStream(article, { providerId: 'stream-test' }, () => {})

    expect(result.summary).toBe('Hello world')
    expect(result).toMatchObject({
      articleId: 'article-1',
      language: 'zh-CN',
      length: 'medium',
      providerId: 'stream-test',
      model: 'stream-model',
      usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
    })
  })

  it('throws when the streamed summary is empty', async () => {
    registerProvider(makeProvider(['   '], '   '))

    await expect(
      summarizeArticleStream(article, { providerId: 'stream-test' }, () => {}),
    ).rejects.toThrow(/returned an empty summary/u)
  })
})
