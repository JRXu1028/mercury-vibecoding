import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { teamAApi } from '../api/client'
import type { EntryItem, FeedItem } from '../types'

export const useFeedStore = defineStore('feed', () => {
  const feeds = ref<FeedItem[]>([])
  const entries = ref<EntryItem[]>([])
  const selectedFeedId = ref<number | null>(null)
  const selectedEntryId = ref<number | null>(null)
  const searchText = ref('')
  const isLoadingFeeds = ref(false)
  const isLoadingEntries = ref(false)

  const selectedEntry = computed(() => entries.value.find((entry) => entry.id === selectedEntryId.value) ?? null)

  async function refreshFeeds(): Promise<void> {
    isLoadingFeeds.value = true
    try {
      feeds.value = await teamAApi.listFeeds()
      if (selectedFeedId.value !== null && !feeds.value.some((feed) => feed.id === selectedFeedId.value)) {
        selectedFeedId.value = null
      }
    } finally {
      isLoadingFeeds.value = false
    }
  }

  async function refreshEntries(): Promise<void> {
    isLoadingEntries.value = true
    try {
      entries.value = await teamAApi.listEntries({
        feedId: selectedFeedId.value ?? undefined,
        q: searchText.value
      })
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
      selectedFeedId.value = null
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

  return {
    feeds,
    entries,
    selectedFeedId,
    selectedEntryId,
    selectedEntry,
    searchText,
    isLoadingFeeds,
    isLoadingEntries,
    refreshFeeds,
    refreshEntries,
    addFeed,
    removeFeed,
    syncFeed,
    syncAllFeeds,
    importOpml,
    exportOpml
  }
})
