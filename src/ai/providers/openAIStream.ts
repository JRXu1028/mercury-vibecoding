import type { LLMResponse, LLMStreamChunk, LLMUsage } from '../types.js'

interface OpenAICompatibleStreamUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  input_tokens?: number
  output_tokens?: number
}

interface OpenAICompatibleStreamChunk {
  model?: string
  choices?: Array<{
    delta?: {
      content?: string
    }
  }>
  usage?: OpenAICompatibleStreamUsage
}

function toUsage(usage?: OpenAICompatibleStreamUsage): LLMUsage {
  const promptTokens = usage?.prompt_tokens ?? usage?.input_tokens ?? 0
  const completionTokens = usage?.completion_tokens ?? usage?.output_tokens ?? 0

  return {
    promptTokens,
    completionTokens,
    totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
  }
}

function parseDataLine(
  data: string,
  state: {
    content: string
    model: string
    usage?: OpenAICompatibleStreamUsage
    done: boolean
  },
  onChunk: (chunk: LLMStreamChunk) => void,
): void {
  const payload = data.trim()

  if (!payload) {
    return
  }

  if (payload === '[DONE]') {
    state.done = true
    return
  }

  const chunk = JSON.parse(payload) as OpenAICompatibleStreamChunk

  if (chunk.model) {
    state.model = chunk.model
  }

  if (chunk.usage) {
    state.usage = chunk.usage
  }

  const content = chunk.choices?.[0]?.delta?.content

  if (typeof content === 'string' && content.length > 0) {
    state.content += content
    onChunk({ content })
  }
}

export async function readOpenAICompatibleStream(
  response: Response,
  fallbackModel: string,
  providerId: string,
  onChunk: (chunk: LLMStreamChunk) => void,
): Promise<LLMResponse> {
  if (!response.body) {
    throw new Error('OpenAI-compatible streaming response body is empty.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const state = {
    content: '',
    model: fallbackModel,
    usage: undefined as OpenAICompatibleStreamUsage | undefined,
    done: false,
  }
  let bufferedText = ''

  try {
    while (!state.done) {
      const { value, done } = await reader.read()

      if (done) {
        break
      }

      bufferedText += decoder.decode(value, { stream: true })
      const lines = bufferedText.split(/\r?\n/u)
      bufferedText = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data:')) {
          parseDataLine(line.slice('data:'.length), state, onChunk)
        }

        if (state.done) {
          break
        }
      }
    }

    bufferedText += decoder.decode()

    if (!state.done && bufferedText.startsWith('data:')) {
      parseDataLine(bufferedText.slice('data:'.length), state, onChunk)
    }
  } finally {
    reader.releaseLock()
  }

  return {
    content: state.content,
    model: state.model,
    providerId,
    usage: toUsage(state.usage),
    createdAt: new Date().toISOString(),
  }
}
