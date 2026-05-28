export interface FeedItem {
  id: number
  title: string
  url: string
  siteUrl: string | null
  description: string | null
  lastSyncedAt: string | null
  entryCount: number
}

export interface EntryItem {
  id: number
  feedId: number
  guid: string
  url: string
  title: string
  author: string | null
  summary: string | null
  contentHtml: string | null
  contentMd: string | null
  contentFetchedAt: string | null
  publishedAt: string | null
  createdAt: string
}

export interface EntryContent {
  entryId: number
  title: string
  url: string
  html: string
  markdown: string
  fetchedAt: string
}

export interface LLMUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type SummaryLength = 'short' | 'medium' | 'long'

export interface SummarizeEntryOptions {
  forceRefreshContent?: boolean
  providerId?: string
  model?: string
  language?: string
  length?: SummaryLength
}

export interface SummaryResult {
  articleId: string
  summary: string
  language: string
  length: SummaryLength
  providerId: string
  model: string
  createdAt: string
  usage: LLMUsage
}

export interface TranslateEntryOptions {
  forceRefreshContent?: boolean
  providerId?: string
  model?: string
  sourceLanguage?: string
  targetLanguage?: string
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
  targetLanguage: string
  bilingual: boolean
  segments: TranslationSegment[]
  providerId: string
  model: string
  createdAt: string
  usage: LLMUsage
}

export interface AddFeedResponse {
  feed: FeedItem
  newEntryCount: number
}

export interface SyncResponse {
  feed: FeedItem
  newEntryCount: number
}

export interface TeamABridgeApi {
  listFeeds(): Promise<FeedItem[]>
  addFeed(url: string): Promise<AddFeedResponse>
  removeFeed(feedId: number): Promise<{ ok: true }>
  syncFeed(feedId: number): Promise<SyncResponse>
  syncAllFeeds(): Promise<Array<{ feedId: number; newEntryCount: number }>>
  listEntries(params: { feedId?: number; q?: string }): Promise<EntryItem[]>
  getEntryContent(entryId: number, options?: { forceRefresh?: boolean }): Promise<EntryContent>
  summarizeEntry(entryId: number, options?: SummarizeEntryOptions): Promise<SummaryResult>
  translateEntry(entryId: number, options?: TranslateEntryOptions): Promise<TranslationResult>
  importOpml(content: string): Promise<{ imported: number; failed: Array<{ url: string; reason: string }> }>
  exportOpml(): Promise<string>
  openOpmlFile(): Promise<{ filePath: string; content: string } | null>
  saveOpmlFile(content: string): Promise<string | null>
}
