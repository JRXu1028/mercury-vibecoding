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
  importOpml(content: string): Promise<{ imported: number; failed: Array<{ url: string; reason: string }> }>
  exportOpml(): Promise<string>
  openOpmlFile(): Promise<{ filePath: string; content: string } | null>
  saveOpmlFile(content: string): Promise<string | null>
}
