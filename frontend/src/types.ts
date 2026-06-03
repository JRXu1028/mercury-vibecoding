export interface FeedItem {
  id: number
  title: string
  url: string
  siteUrl: string | null
  description: string | null
  createdAt: string
  updatedAt: string
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
  updatedAt: string
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
  /** IPC-only: force re-fetch entry content before summarizing */
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
  /** IPC-only: force re-fetch entry content before translating */
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
  removeFeed(feedId: number): Promise<void>
  syncFeed(feedId: number): Promise<SyncResponse>
  syncAllFeeds(): Promise<Array<{ feedId: number; newEntryCount: number }>>
  listEntries(params: { feedId?: number; q?: string }): Promise<EntryItem[]>
  importOpml(content: string): Promise<{ imported: number; failed: Array<{ url: string; reason: string }> }>
  exportOpml(): Promise<string>
  openOpmlFile(): Promise<{ filePath: string; content: string } | null>
  saveOpmlFile(content: string): Promise<string | null>
}

export interface TeamCBridgeApi {
  getEntryContent(entryId: number, options?: { forceRefresh?: boolean }): Promise<EntryContent>
  summarizeEntry(entryId: number, options?: SummarizeEntryOptions): Promise<SummaryResult>
  translateEntry(entryId: number, options?: TranslateEntryOptions): Promise<TranslationResult>
}

export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  details?: unknown
}

export interface TeamDBridgeApi {
  onAppLog(callback: (entry: LogEntry) => void): () => void
}

export interface NoteItem {
  id: number
  entryId: number
  title: string | null
  content: string
  createdAt: string
  updatedAt: string
}

export interface TagItem {
  id: number
  name: string
  color: string | null
  createdAt: string
}

export interface TagWithCount extends TagItem {
  entryCount: number
}

export interface TeamBBridgeApi {
  listNotes(entryId?: number): Promise<NoteItem[]>
  createNote(entryId: number, content: string, title?: string): Promise<NoteItem>
  updateNote(noteId: number, fields: { title?: string | null; content?: string }): Promise<NoteItem>
  deleteNote(noteId: number): Promise<void>
  listTags(): Promise<TagWithCount[]>
  createTag(name: string, color?: string): Promise<TagItem>
  updateTag(tagId: number, fields: { name?: string; color?: string | null }): Promise<TagItem>
  deleteTag(tagId: number): Promise<void>
  addTagToEntry(entryId: number, tagId: number): Promise<void>
  removeTagFromEntry(entryId: number, tagId: number): Promise<void>
  getTagsForEntry(entryId: number): Promise<TagItem[]>
}
