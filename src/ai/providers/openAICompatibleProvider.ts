import type { LLMChatOptions, LLMMessage, LLMProvider, LLMUsage } from '../types.js'

export const OPENAI_COMPATIBLE_PROVIDER_ID = 'openai-compatible'
export const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'https://api.openai.com/v1'
export const DEFAULT_OPENAI_COMPATIBLE_MODEL = 'gpt-4o-mini'

interface OpenAICompatibleProviderOptions {
  id?: string
  name?: string
  apiKey?: string
  baseUrl?: string
  model?: string
}

interface OpenAICompatibleChoice {
  message?: {
    content?: string
  }
}

interface OpenAICompatibleUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  input_tokens?: number
  output_tokens?: number
}

interface OpenAICompatibleChatResponse {
  choices?: OpenAICompatibleChoice[]
  model?: string
  usage?: OpenAICompatibleUsage
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/u, '')
}

function readRequiredValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not set.`)
  }

  return value
}

function resolveApiKey(explicitApiKey?: string): string {
  return readRequiredValue(explicitApiKey ?? process.env.OPENAI_COMPATIBLE_API_KEY, 'OPENAI_COMPATIBLE_API_KEY')
}

function resolveBaseUrl(explicitBaseUrl?: string): string {
  return normalizeBaseUrl(
    explicitBaseUrl ??
      process.env.OPENAI_COMPATIBLE_BASE_URL ??
      DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  )
}

function resolveModel(explicitModel?: string): string {
  return explicitModel ?? process.env.OPENAI_COMPATIBLE_MODEL ?? DEFAULT_OPENAI_COMPATIBLE_MODEL
}

function resolveProviderId(explicitId?: string): string {
  return explicitId ?? process.env.OPENAI_COMPATIBLE_PROVIDER_ID ?? OPENAI_COMPATIBLE_PROVIDER_ID
}

function toUsage(usage?: OpenAICompatibleUsage): LLMUsage {
  const promptTokens = usage?.prompt_tokens ?? usage?.input_tokens ?? 0
  const completionTokens = usage?.completion_tokens ?? usage?.output_tokens ?? 0

  return {
    promptTokens,
    completionTokens,
    totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
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

function toChatCompletionsUrl(baseUrl: string): string {
  if (baseUrl.endsWith('/chat/completions')) {
    return baseUrl
  }

  return `${baseUrl}/chat/completions`
}

export function createOpenAICompatibleProvider(
  options: OpenAICompatibleProviderOptions = {},
): LLMProvider {
  const providerId = resolveProviderId(options.id)
  const providerName = options.name ?? 'OpenAI-Compatible Provider'
  const baseUrl = resolveBaseUrl(options.baseUrl)
  const defaultModel = resolveModel(options.model)
  const chatCompletionsUrl = toChatCompletionsUrl(baseUrl)

  async function postChat(messages: LLMMessage[], chatOptions?: LLMChatOptions) {
    const model = chatOptions?.model ?? defaultModel
    const response = await fetch(chatCompletionsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolveApiKey(options.apiKey)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: chatOptions?.temperature,
        max_tokens: chatOptions?.maxTokens,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `${providerName} chat completion failed: ${await readErrorMessage(response)}`,
      )
    }

    const data = (await response.json()) as OpenAICompatibleChatResponse
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content) {
      throw new Error(`${providerName} chat completion returned an empty message.`)
    }

    return {
      content,
      model: data.model ?? model,
      providerId,
      usage: toUsage(data.usage),
      createdAt: new Date().toISOString(),
    }
  }

  return {
    id: providerId,
    name: providerName,

    async testConnection() {
      await postChat([{ role: 'user', content: 'ping' }], {
        model: defaultModel,
        maxTokens: 8,
      })
      return true
    },

    async listModels() {
      return [defaultModel]
    },

    async chat(messages, chatOptions) {
      return postChat(messages, chatOptions)
    },
  }
}

export const openAICompatibleProvider = createOpenAICompatibleProvider()
