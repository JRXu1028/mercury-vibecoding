<script setup lang="ts">
import { RefreshRight } from '@element-plus/icons-vue'
import type { EntryItem, FeedItem } from '../types'

const props = defineProps<{
  entries: EntryItem[]
  feeds: FeedItem[]
  selectedFeedId: number | null
  selectedEntryId: number | null
  loading: boolean
  searchText: string
}>()

const emit = defineEmits<{
  selectEntry: [entryId: number]
  updateSearch: [value: string]
  syncCurrent: []
}>()

function feedTitle(feedId: number): string {
  return props.feeds.find((item) => item.id === feedId)?.title || 'Unknown Feed'
}

function formatTime(value: string | null): string {
  if (!value) {
    return 'Unknown date'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString()
}
</script>

<template>
  <section class="pane list-pane">
    <header class="pane-header">
      <h2>Entries</h2>
      <el-button :icon="RefreshRight" text @click="emit('syncCurrent')">Sync</el-button>
    </header>

    <div class="search-box">
      <el-input
        :model-value="searchText"
        placeholder="Search title or summary"
        clearable
        @update:model-value="emit('updateSearch', $event)"
      />
    </div>

    <el-scrollbar class="entry-list">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="entry-item"
        :class="{ selected: selectedEntryId === entry.id }"
        @click="emit('selectEntry', entry.id)"
      >
        <p class="entry-title">{{ entry.title }}</p>
        <p class="entry-meta">
          <span v-if="selectedFeedId === null">{{ feedTitle(entry.feedId) }}</span>
          <span>{{ formatTime(entry.publishedAt || entry.createdAt) }}</span>
        </p>
      </div>
      <el-empty v-if="!loading && entries.length === 0" description="No entries" :image-size="72" />
    </el-scrollbar>
  </section>
</template>
