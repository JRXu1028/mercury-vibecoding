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
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.round((startOfToday - startOfTarget) / 86_400_000)
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (dayDiff === 0) {
    return `今天 ${time}`
  }
  if (dayDiff === 1) {
    return `昨天 ${time}`
  }
  if (dayDiff > 1 && dayDiff < 7) {
    return `${dayDiff} 天前`
  }
  return date.toLocaleDateString()
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
        <div class="pane-title-group">
          <span class="pane-eyebrow">Reading Queue</span>
          <h2>Entries</h2>
        </div>
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
            <span v-if="props.selectedFeedId === null" class="entry-source">{{ feedTitle(entry.feedId) }}</span>
            <span v-if="entry.author" class="entry-author">{{ entry.author }}</span>
            <span class="entry-time">{{ formatTime(entry.publishedAt || entry.createdAt) }}</span>
          </p>
        </div>
        <el-empty v-if="!props.loading && props.entries.length === 0" description="No entries" :image-size="72" />
      </el-scrollbar>
    </template>
  </section>
</template>

<style scoped>
.list-pane.collapsed {
  width: 46px;
  min-width: 46px;
  flex: none;
}

.collapsed-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  cursor: pointer;
  height: 100%;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  color: var(--muted);
  border-radius: 0;
  background: transparent;
  transition: color 0.15s, background 0.15s;
}

.collapsed-strip:hover {
  color: var(--brand);
  background: rgba(244, 229, 210, 0.74);
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
