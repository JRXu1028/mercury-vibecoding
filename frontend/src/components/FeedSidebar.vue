<script setup lang="ts">
import { DArrowLeft, DArrowRight, Delete, Plus, Refresh, Upload, Download } from '@element-plus/icons-vue'
import type { FeedItem } from '../types'

const props = defineProps<{
  feeds: FeedItem[]
  selectedFeedId: number | null
  loading: boolean
  collapsed: boolean
  autoSyncEnabled: boolean
  autoSyncIntervalMinutes: number
}>()

const emit = defineEmits<{
  select: [feedId: number | null]
  add: []
  syncAll: []
  importOpml: []
  exportOpml: []
  remove: [feed: FeedItem]
  toggleCollapse: []
  updateAutoSyncEnabled: [value: boolean]
  updateAutoSyncInterval: [value: number]
}>()
</script>

<template>
  <section class="pane sidebar-pane" :class="{ collapsed: props.collapsed }">
    <template v-if="props.collapsed">
      <div class="collapsed-strip" @click="emit('toggleCollapse')" title="展开订阅源列表">
        <el-icon :size="16"><DArrowRight /></el-icon>
        <span class="collapsed-label">Feeds</span>
      </div>
    </template>

    <template v-else>
      <header class="pane-header">
        <h2>Feeds</h2>
        <div class="toolbar-actions">
          <el-button :icon="Plus" circle size="small" @click="emit('add')" />
          <el-button :icon="Refresh" circle size="small" @click="emit('syncAll')" />
          <el-button :icon="DArrowLeft" circle size="small" title="收起侧栏" @click="emit('toggleCollapse')" />
        </div>
      </header>

      <div class="menu-actions">
        <el-button text :icon="Upload" @click="emit('importOpml')">Import OPML</el-button>
        <el-button text :icon="Download" @click="emit('exportOpml')">Export OPML</el-button>
        <el-button text @click="emit('select', null)">All Feeds</el-button>
      </div>

      <div class="auto-sync-settings">
        <el-switch
          :model-value="props.autoSyncEnabled"
          active-text="Auto Sync"
          @update:model-value="emit('updateAutoSyncEnabled', $event)"
        />
        <el-select
          :model-value="props.autoSyncIntervalMinutes"
          :disabled="!props.autoSyncEnabled"
          aria-label="Auto sync interval"
          @update:model-value="emit('updateAutoSyncInterval', $event)"
        >
          <el-option :value="5" label="5 min" />
          <el-option :value="10" label="10 min" />
          <el-option :value="15" label="15 min" />
          <el-option :value="30" label="30 min" />
        </el-select>
      </div>

      <el-scrollbar class="feed-list">
        <div
          v-for="feed in props.feeds"
          :key="feed.id"
          class="feed-item"
          :class="{ selected: props.selectedFeedId === feed.id }"
          @click="emit('select', feed.id)"
        >
          <div class="feed-main">
            <p class="feed-title">{{ feed.title }}</p>
            <p class="feed-meta">{{ feed.entryCount }} entries</p>
          </div>
          <el-button
            :icon="Delete"
            link
            type="danger"
            @click.stop="emit('remove', feed)"
          />
        </div>
        <el-empty v-if="!props.loading && props.feeds.length === 0" description="No feeds" :image-size="72" />
      </el-scrollbar>
    </template>
  </section>
</template>

<style scoped>
.sidebar-pane.collapsed {
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
  margin-top: 18px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 2px;
  white-space: nowrap;
  transform: rotate(90deg);
  transform-origin: center;
  user-select: none;
}

.auto-sync-settings {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 84px;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}
</style>
