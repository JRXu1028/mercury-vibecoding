export type ArticleLanguage = string

export interface ArticleInput {
  id: string
  title: string
  url?: string
  source?: string
  author?: string
  publishedAt?: string
  language: ArticleLanguage
  contentMarkdown: string
}

export type LLMMessageRole = 'system' | 'user' | 'assistant'

export interface LLMMessage {
  role: LLMMessageRole
  content: string
}

export interface LLMUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface LLMResponse {
  content: string
  model: string
  providerId: string
  usage: LLMUsage
  createdAt: string
}

export interface LLMChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface LLMProviderCapabilities {
  chat: true
  streamChat: true
}

export interface LLMStreamChunk {
  content: string
}

export interface LLMProvider {
  id: string
  name: string
  capabilities: LLMProviderCapabilities
  testConnection: () => Promise<boolean>
  listModels: () => Promise<string[]>
  chat: (messages: LLMMessage[], options?: LLMChatOptions) => Promise<LLMResponse>
  streamChat: (
    messages: LLMMessage[],
    options: LLMChatOptions | undefined,
    onChunk: (chunk: LLMStreamChunk) => void,
  ) => Promise<LLMResponse>
}

export type SummaryLength = 'short' | 'medium' | 'long'

export interface SummaryOptions {
  language?: ArticleLanguage
  length?: SummaryLength
  providerId?: string
  model?: string
}

export interface SummaryResult {
  articleId: string
  summary: string
  language: ArticleLanguage
  length: SummaryLength
  providerId: string
  model: string
  createdAt: string
  usage: LLMUsage
}

export interface TranslationOptions {
  targetLanguage: ArticleLanguage
  sourceLanguage?: ArticleLanguage
  providerId?: string
  model?: string
  bilingual?: boolean
}

export type TranslationSegmentStatus = 'success' | 'failed'

export interface TranslationSegment {
  index: number
  source: string
  translated: string
  status: TranslationSegmentStatus
  error?: string
}

export interface TranslationResult {
  articleId: string
  targetLanguage: ArticleLanguage
  bilingual: boolean
  segments: TranslationSegment[]
  providerId: string
  model: string
  createdAt: string
  usage: LLMUsage
}

export interface LatestAiResults {
  summary: SummaryResult | null
  translation: TranslationResult | null
}
