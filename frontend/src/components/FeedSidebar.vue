<script setup lang="ts">
import { DArrowLeft, DArrowRight, Delete, Plus, Refresh, Upload, Download } from '@element-plus/icons-vue'
import type { FeedItem } from '../types'

const props = defineProps<{
  feeds: FeedItem[]
  selectedFeedId: number | null
  loading: boolean
  collapsed: boolean
}>()

const emit = defineEmits<{
  select: [feedId: number | null]
  add: []
  syncAll: []
  importOpml: []
  exportOpml: []
  remove: [feed: FeedItem]
  toggleCollapse: []
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
  color: var(--muted);
  transition: color 0.15s;
}

.collapsed-strip:hover {
  color: var(--brand);
  background: #f0f6ff;
}

.collapsed-label {
  writing-mode: vertical-rl;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 2px;
  user-select: none;
}
</style>
