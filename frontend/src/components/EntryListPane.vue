<script setup lang="ts">
import { Clock, DArrowLeft, DArrowRight, Document, Reading, RefreshRight, User } from '@element-plus/icons-vue'
import type { EntryItem, FeedItem } from '../types'

const props = defineProps<{
  entries: EntryItem[]
  feeds: FeedItem[]
  selectedFeedId: number | null
  selectedEntryId: number | null
  loading: boolean
  searchText: string
  unreadOnly: boolean
  collapsed: boolean
}>()

const emit = defineEmits<{
  selectEntry: [entryId: number]
  updateEntryState: [entryId: number, fields: { isRead?: boolean; isFavorite?: boolean }]
  updateSearch: [value: string]
  toggleUnreadOnly: []
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
          <h2><el-icon><Document /></el-icon> Entries</h2>
        </div>
        <div class="toolbar-actions">
          <el-button
            :icon="Reading"
            :type="props.unreadOnly ? 'primary' : 'default'"
            class="unread-filter-button"
            :class="{ selected: props.unreadOnly }"
            plain
            size="small"
            @click="emit('toggleUnreadOnly')"
          >Unread</el-button>
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
          :class="{ selected: props.selectedEntryId === entry.id, unread: !entry.isRead, favorite: entry.isFavorite }"
          @click="emit('selectEntry', entry.id)"
        >
          <div class="entry-title-row">
            <span class="unread-dot" :class="{ hidden: entry.isRead }" title="Unread" />
            <p class="entry-title">{{ entry.title }}</p>
            <button
              type="button"
              class="entry-icon-button"
              :class="{ active: entry.isFavorite }"
              :title="entry.isFavorite ? 'Remove favorite' : 'Add favorite'"
              @click.stop="emit('updateEntryState', entry.id, { isFavorite: !entry.isFavorite })"
            >
              <span v-if="entry.isFavorite" class="entry-star" aria-hidden="true">&#9733;</span>
              <span v-else class="entry-star" aria-hidden="true">&#9734;</span>
            </button>
            <button
              type="button"
              class="entry-icon-button"
              :class="{ active: entry.isRead }"
              :title="entry.isRead ? 'Mark unread' : 'Mark read'"
              @click.stop="emit('updateEntryState', entry.id, { isRead: !entry.isRead })"
            >
              <el-icon><Reading /></el-icon>
            </button>
          </div>
          <p class="entry-meta">
            <span v-if="props.selectedFeedId === null" class="entry-source">
              <el-icon><Document /></el-icon>{{ feedTitle(entry.feedId) }}
            </span>
            <span v-if="entry.author" class="entry-author">
              <el-icon><User /></el-icon>{{ entry.author }}
            </span>
            <span class="entry-time">
              <el-icon><Clock /></el-icon>{{ formatTime(entry.publishedAt || entry.createdAt) }}
            </span>
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
  background: rgba(248, 250, 252, 0.96);
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

.entry-title-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 24px 24px;
  align-items: start;
  gap: 6px;
}

.entry-item:not(.unread) .entry-title,
.entry-item.favorite:not(.unread) .entry-title {
  color: var(--muted);
  font-weight: 560;
}

.unread-dot {
  width: 7px;
  height: 7px;
  margin-top: 8px;
  border-radius: 999px;
  background: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.unread-dot.hidden {
  opacity: 0;
}

.entry-icon-button {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  color: var(--muted-soft);
  cursor: pointer;
  background: transparent;
}

.entry-icon-button:hover {
  color: var(--brand-strong);
  background: var(--brand-soft);
}

.entry-icon-button.active {
  color: var(--brand-strong);
}

.entry-star {
  font-size: 17px;
  line-height: 1;
}

.entry-item.favorite.unread .entry-title {
  color: var(--text);
}

.unread-filter-button.selected {
  --el-button-text-color: #1d4ed8;
  --el-button-border-color: #bfdbfe;
  --el-button-bg-color: #eaf4ff;
  --el-button-hover-text-color: #1d4ed8;
  --el-button-hover-border-color: #93c5fd;
  --el-button-hover-bg-color: #dbeafe;
}
</style>
