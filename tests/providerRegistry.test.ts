import { afterEach, describe, expect, it } from 'vitest'
import {
  clearProviders,
  getProvider,
  registerProvider,
} from '../src/ai/providerRegistry.js'
import type { LLMProvider } from '../src/ai/types.js'

function makeProvider(overrides: Record<string, unknown> = {}): LLMProvider {
  return {
    id: 'test-provider',
    name: 'Test Provider',
    capabilities: {
      chat: true,
      streamChat: true,
    },
    async testConnection() {
      return true
    },
    async listModels() {
      return ['test-model']
    },
    async chat() {
      return {
        content: 'ok',
        model: 'test-model',
        providerId: 'test-provider',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        createdAt: '2026-01-01T00:00:00.000Z',
      }
    },
    async streamChat(_messages, _options, onChunk) {
      onChunk({ content: 'ok' })
      return {
        content: 'ok',
        model: 'test-model',
        providerId: 'test-provider',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        createdAt: '2026-01-01T00:00:00.000Z',
      }
    },
    ...overrides,
  } as unknown as LLMProvider
}

describe('provider registry streamChat requirements', () => {
  afterEach(() => {
    clearProviders()
  })

  it('registers a provider that supports streamChat', () => {
    const provider = makeProvider()

    registerProvider(provider)

    expect(getProvider('test-provider')).toBe(provider)
  })

  it('rejects a provider whose streamChat capability is not true', () => {
    const provider = makeProvider({
      capabilities: { chat: true, streamChat: false },
    })

    expect(() => registerProvider(provider)).toThrow(/must support streamChat/u)
  })

  it('rejects a provider whose streamChat implementation is not a function', () => {
    const provider = makeProvider({ streamChat: undefined })

    expect(() => registerProvider(provider)).toThrow(/must implement streamChat/u)
  })
})
