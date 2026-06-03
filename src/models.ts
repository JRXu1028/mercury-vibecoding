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

// --- LLM Provider & Usage ---

export interface LLMProviderRow {
  id: number
  provider_id: string
  name: string
  api_base_url: string | null
  api_key_env_var: string | null
  default_model: string | null
  created_at: string
  updated_at: string
}

export interface LLMUsageRow {
  id: number
  provider_id: string
  entry_id: number
  operation: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  created_at: string
}

// --- Notes ---

export interface Note {
  id: number
  entryId: number
  title: string | null
  content: string
  createdAt: string
  updatedAt: string
}

export interface NoteRow {
  id: number
  entry_id: number
  title: string | null
  content: string
  created_at: string
  updated_at: string
}

// --- Tags ---

export interface Tag {
  id: number
  name: string
  color: string | null
  createdAt: string
}

export interface TagRow {
  id: number
  name: string
  color: string | null
  created_at: string
}
