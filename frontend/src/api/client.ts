import type {
  AddFeedResponse,
  EntryContent,
  EntryItem,
  FeedItem,
  NoteItem,
  ProviderInfo,
  SummarizeEntryOptions,
  SummaryResult,
  SyncResponse,
  TagItem,
  TagWithCount,
  TranslateEntryOptions,
  TranslationResult,
  TranslationSegmentEvent,
  UsageStats
} from '../types'

const bridgeA = window.teamAApi
const bridgeB = window.teamBApi
const bridgeC = window.teamCApi

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return await response.json() as T
  }
  return await response.text() as T
}

export const teamAApi = {
  async listFeeds(): Promise<FeedItem[]> {
    if (bridgeA) {
      return await bridgeA.listFeeds()
    }
    const data = await request<{ feeds: FeedItem[] }>('/api/feeds')
    return data.feeds
  },

  async addFeed(url: string): Promise<AddFeedResponse> {
    if (bridgeA) {
      return await bridgeA.addFeed(url)
    }
    return await request<AddFeedResponse>('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
  },

  async removeFeed(feedId: number): Promise<void> {
    if (bridgeA) {
      await bridgeA.removeFeed(feedId)
      return
    }
    await request<{ ok: boolean }>(`/api/feeds/${feedId}`, { method: 'DELETE' })
  },

  async syncFeed(feedId: number): Promise<SyncResponse> {
    if (bridgeA) {
      return await bridgeA.syncFeed(feedId)
    }
    return await request<SyncResponse>(`/api/feeds/${feedId}/sync`, { method: 'POST' })
  },

  async syncAllFeeds(): Promise<Array<{ feedId: number; newEntryCount: number }>> {
    if (bridgeA) {
      return await bridgeA.syncAllFeeds()
    }
    const data = await request<{ items: Array<{ feedId: number; newEntryCount: number }> }>('/api/sync-all', { method: 'POST' })
    return data.items
  },

  async listEntries(params: { feedId?: number; q?: string }): Promise<EntryItem[]> {
    if (bridgeA) {
      return await bridgeA.listEntries(params)
    }
    const query = new URLSearchParams()
    if (params.feedId !== undefined) {
      query.set('feedId', String(params.feedId))
    }
    if (params.q && params.q.trim()) {
      query.set('q', params.q.trim())
    }

    const data = await request<{ entries: EntryItem[] }>(`/api/entries?${query.toString()}`)
    return data.entries
  },

  async importOpml(content: string): Promise<{ imported: number; failed: Array<{ url: string; reason: string }> }> {
    if (bridgeA) {
      return await bridgeA.importOpml(content)
    }
    return await request('/api/opml/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
  },

  async exportOpml(): Promise<string> {
    if (bridgeA) {
      return await bridgeA.exportOpml()
    }
    return await request('/api/opml/export')
  },

  async openOpmlFile(): Promise<{ filePath: string; content: string } | null> {
    if (!bridgeA) {
      return null
    }
    return await bridgeA.openOpmlFile()
  },

  async saveOpmlFile(content: string): Promise<string | null> {
    if (!bridgeA) {
      return null
    }
    return await bridgeA.saveOpmlFile(content)
  }
}

export const teamCApi = {
  async getEntryContent(entryId: number, options?: { forceRefresh?: boolean }): Promise<EntryContent> {
    if (bridgeC) {
      return await bridgeC.getEntryContent(entryId, options)
    }
    const query = new URLSearchParams()
    if (options?.forceRefresh) {
      query.set('refresh', '1')
    }
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return await request<EntryContent>(`/api/entries/${entryId}/content${suffix}`)
  },

  async summarizeEntry(entryId: number, options?: SummarizeEntryOptions): Promise<SummaryResult> {
    if (bridgeC) {
      return await bridgeC.summarizeEntry(entryId, options)
    }
    throw new Error('AI summary is only available in the desktop app.')
  },

  async translateEntry(entryId: number, options?: TranslateEntryOptions): Promise<TranslationResult> {
    if (bridgeC) {
      return await bridgeC.translateEntry(entryId, options)
    }
    throw new Error('AI translation is only available in the desktop app.')
  },

  async listProviders(): Promise<ProviderInfo[]> {
    if (bridgeC) {
      return await bridgeC.listProviders()
    }
    return []
  },

  async testConnection(providerId: string): Promise<{ ok: boolean; error: string | null }> {
    if (bridgeC) {
      return await bridgeC.testConnection(providerId)
    }
    throw new Error('连通性测试仅在桌面端可用。')
  },

  async saveProviderApiKey(providerId: string, apiKey: string): Promise<{ ok: boolean; error: string | null }> {
    if (bridgeC) {
      return await bridgeC.saveProviderApiKey(providerId, apiKey)
    }
    throw new Error('API Key 设置仅在桌面端可用。')
  },

  async getUsageStats(): Promise<UsageStats> {
    if (bridgeC) {
      return await bridgeC.getUsageStats()
    }
    throw new Error('用量统计仅在桌面端可用。')
  },

  onTranslationSegment(callback: (data: TranslationSegmentEvent) => void): () => void {
    if (bridgeC) {
      return bridgeC.onTranslationSegment(callback)
    }
    // HTTP mode: no-op, return empty cleanup
    return () => {}
  }
}

export const teamBApi = {
  async listNotes(entryId?: number): Promise<NoteItem[]> {
    if (bridgeB) {
      return await bridgeB.listNotes(entryId)
    }
    const query = entryId !== undefined ? `?entryId=${entryId}` : ''
    const data = await request<{ notes: NoteItem[] }>(`/api/notes${query}`)
    return data.notes
  },

  async createNote(entryId: number, content: string, title?: string): Promise<NoteItem> {
    if (bridgeB) {
      return await bridgeB.createNote(entryId, content, title)
    }
    return await request<NoteItem>('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId, content, title })
    })
  },

  async updateNote(noteId: number, fields: { title?: string | null; content?: string }): Promise<NoteItem> {
    if (bridgeB) {
      return await bridgeB.updateNote(noteId, fields)
    }
    return await request<NoteItem>(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    })
  },

  async deleteNote(noteId: number): Promise<void> {
    if (bridgeB) {
      await bridgeB.deleteNote(noteId)
      return
    }
    await request(`/api/notes/${noteId}`, { method: 'DELETE' })
  },

  async listTags(): Promise<TagWithCount[]> {
    if (bridgeB) {
      return await bridgeB.listTags()
    }
    const data = await request<{ tags: TagWithCount[] }>('/api/tags')
    return data.tags
  },

  async createTag(name: string, color?: string): Promise<TagItem> {
    if (bridgeB) {
      return await bridgeB.createTag(name, color)
    }
    return await request<TagItem>('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color })
    })
  },

  async updateTag(tagId: number, fields: { name?: string; color?: string | null }): Promise<TagItem> {
    if (bridgeB) {
      return await bridgeB.updateTag(tagId, fields)
    }
    return await request<TagItem>(`/api/tags/${tagId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    })
  },

  async deleteTag(tagId: number): Promise<void> {
    if (bridgeB) {
      await bridgeB.deleteTag(tagId)
      return
    }
    await request(`/api/tags/${tagId}`, { method: 'DELETE' })
  },

  async addTagToEntry(entryId: number, tagId: number): Promise<void> {
    if (bridgeB) {
      await bridgeB.addTagToEntry(entryId, tagId)
      return
    }
    await request(`/api/entries/${entryId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId })
    })
  },

  async removeTagFromEntry(entryId: number, tagId: number): Promise<void> {
    if (bridgeB) {
      await bridgeB.removeTagFromEntry(entryId, tagId)
      return
    }
    await request(`/api/entries/${entryId}/tags/${tagId}`, { method: 'DELETE' })
  },

  async getTagsForEntry(entryId: number): Promise<TagItem[]> {
    if (bridgeB) {
      return await bridgeB.getTagsForEntry(entryId)
    }
    const data = await request<{ tags: TagItem[] }>(`/api/entries/${entryId}/tags`)
    return data.tags
  }
}
