import type { AddFeedResponse, EntryContent, EntryItem, FeedItem, SyncResponse } from '../types'

const bridge = window.teamAApi

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
    if (bridge) {
      return await bridge.listFeeds()
    }
    const data = await request<{ feeds: FeedItem[] }>('/api/feeds')
    return data.feeds
  },

  async addFeed(url: string): Promise<AddFeedResponse> {
    if (bridge) {
      return await bridge.addFeed(url)
    }
    return await request<AddFeedResponse>('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
  },

  async removeFeed(feedId: number): Promise<void> {
    if (bridge) {
      await bridge.removeFeed(feedId)
      return
    }
    await request<{ ok: boolean }>(`/api/feeds/${feedId}`, { method: 'DELETE' })
  },

  async syncFeed(feedId: number): Promise<SyncResponse> {
    if (bridge) {
      return await bridge.syncFeed(feedId)
    }
    return await request<SyncResponse>(`/api/feeds/${feedId}/sync`, { method: 'POST' })
  },

  async syncAllFeeds(): Promise<Array<{ feedId: number; newEntryCount: number }>> {
    if (bridge) {
      return await bridge.syncAllFeeds()
    }
    const data = await request<{ items: Array<{ feedId: number; newEntryCount: number }> }>('/api/sync-all', { method: 'POST' })
    return data.items
  },

  async listEntries(params: { feedId?: number; q?: string }): Promise<EntryItem[]> {
    if (bridge) {
      return await bridge.listEntries(params)
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

  async getEntryContent(entryId: number, options?: { forceRefresh?: boolean }): Promise<EntryContent> {
    if (bridge) {
      return await bridge.getEntryContent(entryId, options)
    }
    const query = new URLSearchParams()
    if (options?.forceRefresh) {
      query.set('refresh', '1')
    }
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return await request<EntryContent>(`/api/entries/${entryId}/content${suffix}`)
  },

  async importOpml(content: string): Promise<{ imported: number; failed: Array<{ url: string; reason: string }> }> {
    if (bridge) {
      return await bridge.importOpml(content)
    }
    return await request('/api/opml/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
  },

  async exportOpml(): Promise<string> {
    if (bridge) {
      return await bridge.exportOpml()
    }
    return await request('/api/opml/export')
  },

  async openOpmlFile(): Promise<{ filePath: string; content: string } | null> {
    if (!bridge) {
      return null
    }
    return await bridge.openOpmlFile()
  },

  async saveOpmlFile(content: string): Promise<string | null> {
    if (!bridge) {
      return null
    }
    return await bridge.saveOpmlFile(content)
  }
}
