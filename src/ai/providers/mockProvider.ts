import type { LLMChatOptions, LLMMessage, LLMProvider, LLMUsage } from '../types.js'

export const MOCK_PROVIDER_ID = 'mock'

const MOCK_MODELS = ['mock-model', 'mock-summary-model', 'mock-translation-model']

function countTokens(text: string): number {
  const normalizedText = text.trim()

  if (!normalizedText) {
    return 0
  }

  return normalizedText.split(/\s+/u).length
}

function createMockUsage(messages: LLMMessage[], content: string): LLMUsage {
  const promptTokens = messages.reduce(
    (total, message) => total + countTokens(message.content),
    0,
  )
  const completionTokens = countTokens(content)

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  }
}

function selectModel(options?: LLMChatOptions): string {
  return options?.model ?? 'mock-model'
}

function createMockContent(messages: LLMMessage[], model: string): string {
  const lastUserMessage =
    [...messages].reverse().find((message) => message.role === 'user')?.content ?? ''
  const compactPrompt = lastUserMessage.replace(/\s+/gu, ' ').trim()
  const promptPreview = compactPrompt.slice(0, 180)

  if (model.includes('translation')) {
    return `[mock translation] ${promptPreview}`
  }

  if (model.includes('summary')) {
    return `[mock summary] ${promptPreview}`
  }

  return `[mock response] ${promptPreview}`
}

export const mockProvider: LLMProvider = {
  id: MOCK_PROVIDER_ID,
  name: 'Mock LLM Provider',

  async testConnection() {
    return true
  },

  async listModels() {
    return [...MOCK_MODELS]
  },

  async chat(messages, options) {
    const model = selectModel(options)
    const content = createMockContent(messages, model)

    return {
      content,
      model,
      providerId: MOCK_PROVIDER_ID,
      usage: createMockUsage(messages, content),
      createdAt: new Date().toISOString(),
    }
  },
}
