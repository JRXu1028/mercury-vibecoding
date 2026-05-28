import type { LLMChatOptions, LLMMessage, LLMProvider, LLMUsage } from '../types.js'

export const DEEPSEEK_PROVIDER_ID = 'deepseek'
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash'
export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

interface DeepSeekProviderOptions {
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
}

interface DeepSeekChatChoice {
  message?: {
    content?: string
  }
}

interface DeepSeekChatUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

interface DeepSeekChatResponse {
  choices?: DeepSeekChatChoice[]
  model?: string
  usage?: DeepSeekChatUsage
}

function readApiKey(explicitApiKey?: string): string {
  const apiKey = explicitApiKey ?? process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY is not set. Set it in your shell before running the DeepSeek AI flow.',
    )
  }

  return apiKey
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/u, '')
}

function toUsage(usage?: DeepSeekChatUsage): LLMUsage {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  const detail = text.trim()

  if (!detail) {
    return `${response.status} ${response.statusText}`
  }

  return `${response.status} ${response.statusText}: ${detail}`
}

export function createDeepSeekProvider(
  options: DeepSeekProviderOptions = {},
): LLMProvider {
  const baseUrl = normalizeBaseUrl(
    options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_DEEPSEEK_BASE_URL,
  )
  const defaultModel =
    options.defaultModel ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_DEEPSEEK_MODEL

  return {
    id: DEEPSEEK_PROVIDER_ID,
    name: 'DeepSeek Provider',

    async testConnection() {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${readApiKey(options.apiKey)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: defaultModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 8,
          stream: false,
          thinking: { type: 'disabled' },
        }),
      })

      return response.ok
    },

    async listModels() {
      return [DEFAULT_DEEPSEEK_MODEL, 'deepseek-v4-pro', 'deepseek-chat']
    },

    async chat(messages: LLMMessage[], chatOptions?: LLMChatOptions) {
      const model = chatOptions?.model ?? defaultModel
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${readApiKey(options.apiKey)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: chatOptions?.temperature,
          max_tokens: chatOptions?.maxTokens,
          stream: false,
          thinking: { type: 'disabled' },
        }),
      })

      if (!response.ok) {
        throw new Error(`DeepSeek chat completion failed: ${await readErrorMessage(response)}`)
      }

      const data = (await response.json()) as DeepSeekChatResponse
      const content = data.choices?.[0]?.message?.content?.trim()

      if (!content) {
        throw new Error('DeepSeek chat completion returned an empty message.')
      }

      return {
        content,
        model: data.model ?? model,
        providerId: DEEPSEEK_PROVIDER_ID,
        usage: toUsage(data.usage),
        createdAt: new Date().toISOString(),
      }
    },
  }
}

export const deepSeekProvider = createDeepSeekProvider()
