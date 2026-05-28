export interface Feed {
  id: number
  title: string
  url: string
  siteUrl: string | null
  description: string | null
  createdAt: string
  updatedAt: string
  lastSyncedAt: string | null
}

export interface Entry {
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

export interface ParsedEntry {
  guid: string
  url: string
  title: string
  author: string | null
  summary: string | null
  publishedAt: string | null
}

export interface ParsedFeed {
  title: string
  feedUrl: string
  siteUrl: string | null
  description: string | null
  entries: ParsedEntry[]
}
