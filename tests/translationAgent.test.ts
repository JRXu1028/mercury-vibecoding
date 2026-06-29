import { afterEach, describe, expect, it } from 'vitest'
import { clearProviders, registerProvider } from '../src/ai/providerRegistry.js'
import { translateArticle } from '../src/ai/translationAgent.js'
import type { ArticleInput, LLMProvider } from '../src/ai/types.js'

function makeProvider(onChat: (content: string) => string): LLMProvider {
  return {
    id: 'translation-test',
    name: 'Translation Test Provider',
    capabilities: {
      chat: true,
      streamChat: true,
    },
    async testConnection() {
      return true
    },
    async listModels() {
      return ['translation-model']
    },
    async chat(messages) {
      const content = messages[messages.length - 1]?.content ?? ''
      return {
        content: onChat(content),
        model: 'translation-model',
        providerId: 'translation-test',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        createdAt: '2026-01-01T00:00:00.000Z',
      }
    },
    async streamChat() {
      throw new Error('not used')
    },
  }
}

const article: ArticleInput = {
  id: 'article-1',
  title: 'Media translation',
  language: 'en',
  contentMarkdown: '![Chart](https://example.com/chart.png)\n\nThis is a text paragraph.',
}

describe('translateArticle', () => {
  afterEach(() => {
    clearProviders()
  })

  it('preserves media-only segments without sending them to the provider', async () => {
    let chatCalls = 0
    registerProvider(makeProvider(() => {
      chatCalls += 1
      return '这是一段文字。'
    }))

    const result = await translateArticle(article, {
      providerId: 'translation-test',
      targetLanguage: 'zh-CN',
    })

    expect(chatCalls).toBe(1)
    expect(result.segments[0]).toMatchObject({
      source: '![Chart](https://example.com/chart.png)',
      translated: '![Chart](https://example.com/chart.png)',
      status: 'success',
    })
    expect(result.segments[1].translated).toBe('这是一段文字。')
  })

  it('preserves html image-only segments without sending them to the provider', async () => {
    let chatCalls = 0
    registerProvider(makeProvider(() => {
      chatCalls += 1
      return 'unused'
    }))

    const result = await translateArticle({
      ...article,
      contentMarkdown: '<p><img src="https://example.com/photo.jpg" alt="Photo"></p>',
    }, {
      providerId: 'translation-test',
      targetLanguage: 'zh-CN',
    })

    expect(chatCalls).toBe(0)
    expect(result.segments[0]).toMatchObject({
      source: '<p><img src="https://example.com/photo.jpg" alt="Photo"></p>',
      translated: '<p><img src="https://example.com/photo.jpg" alt="Photo"></p>',
      status: 'success',
    })
  })
})
