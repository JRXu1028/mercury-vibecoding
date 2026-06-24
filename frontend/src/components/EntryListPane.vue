<script setup lang="ts">
import { DArrowLeft, DArrowRight, RefreshRight } from '@element-plus/icons-vue'
import type { EntryItem, FeedItem } from '../types'

const props = defineProps<{
  entries: EntryItem[]
  feeds: FeedItem[]
  selectedFeedId: number | null
  selectedEntryId: number | null
  loading: boolean
  searchText: string
  collapsed: boolean
}>()

const emit = defineEmits<{
  selectEntry: [entryId: number]
  updateSearch: [value: string]
  syncCurrent: []
  toggleCollapse: []
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
  <section class="pane list-pane" :class="{ collapsed: props.collapsed }">
    <template v-if="props.collapsed">
      <div class="collapsed-strip" @click="emit('toggleCollapse')" title="展开文章列表">
        <el-icon :size="16"><DArrowRight /></el-icon>
        <span class="collapsed-label">Entries</span>
      </div>
    </template>

    <template v-else>
      <header class="pane-header">
        <h2>Entries</h2>
        <div class="toolbar-actions">
          <el-button :icon="RefreshRight" text @click="emit('syncCurrent')">Sync</el-button>
          <el-button :icon="DArrowLeft" circle size="small" title="收起侧栏" @click="emit('toggleCollapse')" />
        </div>
      </header>

      <div class="search-box">
        <el-input
          :model-value="props.searchText"
          placeholder="Search title or summary"
          clearable
          @update:model-value="emit('updateSearch', $event)"
        />
      </div>

      <el-scrollbar class="entry-list">
        <div
          v-for="entry in props.entries"
          :key="entry.id"
          class="entry-item"
          :class="{ selected: props.selectedEntryId === entry.id }"
          @click="emit('selectEntry', entry.id)"
        >
          <p class="entry-title">{{ entry.title }}</p>
          <p class="entry-meta">
            <span v-if="props.selectedFeedId === null">{{ feedTitle(entry.feedId) }}</span>
            <span>{{ formatTime(entry.publishedAt || entry.createdAt) }}</span>
          </p>
        </div>
        <el-empty v-if="!props.loading && props.entries.length === 0" description="No entries" :image-size="72" />
      </el-scrollbar>
    </template>
  </section>
</template>

<style scoped>
.list-pane.collapsed {
  width: 44px;
  min-width: 44px;
  flex: none;
}

.collapsed-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 0;
  cursor: pointer;
  height: 100%;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  color: var(--muted);
  transition: color 0.15s;
}

.collapsed-strip:hover {
  color: var(--brand);
  background: #f0f6ff;
}

.collapsed-label {
  margin-top: 22px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 2px;
  white-space: nowrap;
  transform: rotate(90deg);
  transform-origin: center;
  user-select: none;
}
</style>
