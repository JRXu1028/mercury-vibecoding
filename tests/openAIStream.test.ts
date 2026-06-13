import { describe, expect, it } from 'vitest'
import { readOpenAICompatibleStream } from '../src/ai/providers/openAIStream.js'

const encoder = new TextEncoder()

function streamResponse(events: string[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(event))
        }
        controller.close()
      },
    }),
  )
}

describe('readOpenAICompatibleStream', () => {
  it('accumulates two delta content chunks into a complete response', async () => {
    const chunks: string[] = []
    const response = streamResponse([
      'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"world"}}]}\n\n',
      'data: [DONE]\n\n',
    ])

    const result = await readOpenAICompatibleStream(
      response,
      'fallback-model',
      'test-provider',
      (chunk) => chunks.push(chunk.content),
    )

    expect(chunks).toEqual(['Hello ', 'world'])
    expect(result.content).toBe('Hello world')
    expect(result.model).toBe('fallback-model')
    expect(result.providerId).toBe('test-provider')
    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })
  })

  it('reads usage from the final stream chunk', async () => {
    const response = streamResponse([
      'data: {"model":"stream-model","choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\n',
      'data: [DONE]\n\n',
    ])

    const result = await readOpenAICompatibleStream(
      response,
      'fallback-model',
      'test-provider',
      () => {},
    )

    expect(result.content).toBe('Hi')
    expect(result.model).toBe('stream-model')
    expect(result.usage).toEqual({ promptTokens: 3, completionTokens: 2, totalTokens: 5 })
  })

  it('throws when the streaming response body is empty', async () => {
    const response = new Response(null)

    await expect(
      readOpenAICompatibleStream(response, 'fallback-model', 'test-provider', () => {}),
    ).rejects.toThrow(/streaming response body is empty/u)
  })
})
