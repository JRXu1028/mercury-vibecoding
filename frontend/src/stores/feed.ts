import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { teamAApi } from '../api/client'
import type { EntryItem, FeedItem } from '../types'

export type FeedSourceSelection = 'all' | 'starred' | number

export const useFeedStore = defineStore('feed', () => {
  const feeds = ref<FeedItem[]>([])
  const entries = ref<EntryItem[]>([])
  const selectedSource = ref<FeedSourceSelection>('all')
  const selectedFeedId = computed<number | null>({
    get: () => (typeof selectedSource.value === 'number' ? selectedSource.value : null),
    set: (value) => {
      selectedSource.value = value ?? 'all'
    }
  })
  const selectedEntryId = ref<number | null>(null)
  const searchText = ref('')
  const unreadOnly = ref(false)
  const isLoadingFeeds = ref(false)
  const isLoadingEntries = ref(false)

  const selectedEntry = computed(() => entries.value.find((entry) => entry.id === selectedEntryId.value) ?? null)

  async function refreshFeeds(): Promise<void> {
    isLoadingFeeds.value = true
    try {
      feeds.value = await teamAApi.listFeeds()
      if (selectedFeedId.value !== null && !feeds.value.some((feed) => feed.id === selectedFeedId.value)) {
        selectedSource.value = 'all'
      }
    } finally {
      isLoadingFeeds.value = false
    }
  }

  async function refreshEntries(): Promise<void> {
    isLoadingEntries.value = true
    try {
      const loadedEntries = await teamAApi.listEntries({
        feedId: selectedFeedId.value ?? undefined,
        q: searchText.value
      })
      let filteredEntries = selectedSource.value === 'starred'
        ? loadedEntries.filter((entry) => entry.isFavorite)
        : loadedEntries
      if (unreadOnly.value) {
        filteredEntries = filteredEntries.filter((entry) => !entry.isRead)
      }
      entries.value = filteredEntries
      if (selectedEntryId.value !== null && !entries.value.some((entry) => entry.id === selectedEntryId.value)) {
        selectedEntryId.value = null
      }
      if (selectedEntryId.value === null && entries.value.length > 0) {
        selectedEntryId.value = entries.value[0].id
      }
    } finally {
      isLoadingEntries.value = false
    }
  }

  async function addFeed(url: string): Promise<void> {
    await teamAApi.addFeed(url)
    await refreshFeeds()
    await refreshEntries()
  }

  async function removeFeed(feedId: number): Promise<void> {
    await teamAApi.removeFeed(feedId)
    if (selectedFeedId.value === feedId) {
      selectedSource.value = 'all'
    }
    await refreshFeeds()
    await refreshEntries()
  }

  async function syncFeed(feedId: number): Promise<number> {
    const result = await teamAApi.syncFeed(feedId)
    await refreshFeeds()
    await refreshEntries()
    return result.newEntryCount
  }

  async function syncAllFeeds(): Promise<Array<{ feedId: number; newEntryCount: number }>> {
    const items = await teamAApi.syncAllFeeds()
    await refreshFeeds()
    await refreshEntries()
    return items
  }

  async function importOpml(content: string): Promise<{ imported: number; failed: Array<{ url: string; reason: string }> }> {
    const result = await teamAApi.importOpml(content)
    await refreshFeeds()
    await refreshEntries()
    return result
  }

  async function exportOpml(): Promise<string> {
    return await teamAApi.exportOpml()
  }

  async function updateEntryState(entryId: number, fields: { isRead?: boolean; isFavorite?: boolean }): Promise<void> {
    const updated = await teamAApi.updateEntryState(entryId, fields)
    const index = entries.value.findIndex((entry) => entry.id === entryId)
    if (index >= 0) {
      if (selectedSource.value === 'starred' && !updated.isFavorite) {
        entries.value.splice(index, 1)
        if (selectedEntryId.value === entryId) {
          selectedEntryId.value = null
        }
        return
      }
      entries.value[index] = updated
    }
  }

  return {
    feeds,
    entries,
    selectedFeedId,
    selectedSource,
    selectedEntryId,
    selectedEntry,
    searchText,
    unreadOnly,
    isLoadingFeeds,
    isLoadingEntries,
    refreshFeeds,
    refreshEntries,
    addFeed,
    removeFeed,
    syncFeed,
    syncAllFeeds,
    importOpml,
    exportOpml,
    updateEntryState
  }
})
