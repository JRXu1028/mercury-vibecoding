<script setup lang="ts">
import { Collection, DArrowLeft, DArrowRight, Delete, Download, MoreFilled, Plus, Refresh, Timer, Upload } from '@element-plus/icons-vue'
import type { FeedItem } from '../types'
import type { FeedSourceSelection } from '../stores/feed'

const props = defineProps<{
  feeds: FeedItem[]
  selectedSource: FeedSourceSelection
  selectedFeedId: number | null
  loading: boolean
  collapsed: boolean
  autoSyncEnabled: boolean
  autoSyncIntervalMinutes: number
}>()

const emit = defineEmits<{
  select: [source: FeedSourceSelection]
  add: []
  syncAll: []
  importOpml: []
  exportOpml: []
  remove: [feed: FeedItem]
  toggleCollapse: []
  updateAutoSyncEnabled: [value: boolean]
  updateAutoSyncInterval: [value: number]
}>()

function handleLibraryCommand(command: string): void {
  if (command === 'import') {
    emit('importOpml')
  } else if (command === 'export') {
    emit('exportOpml')
  }
}
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
        <div class="pane-title-group">
          <span class="pane-eyebrow">Library</span>
          <h2><el-icon><Collection /></el-icon> Feeds</h2>
        </div>
        <div class="toolbar-actions">
          <el-button :icon="Plus" circle size="small" @click="emit('add')" />
          <el-button :icon="Refresh" circle size="small" @click="emit('syncAll')" />
          <el-dropdown trigger="click" @command="handleLibraryCommand">
            <el-button :icon="MoreFilled" circle size="small" title="更多订阅源操作" />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="import" :icon="Upload">Import OPML</el-dropdown-item>
                <el-dropdown-item command="export" :icon="Download">Export OPML</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button :icon="DArrowLeft" circle size="small" title="收起侧栏" @click="emit('toggleCollapse')" />
        </div>
      </header>

      <div class="menu-actions">
        <el-button text class="all-feeds-button" :class="{ selected: props.selectedSource === 'all' }" @click="emit('select', 'all')">
          <el-icon><Collection /></el-icon>
          <span>All Feeds</span>
        </el-button>
        <el-button text class="all-feeds-button" :class="{ selected: props.selectedSource === 'starred' }" @click="emit('select', 'starred')">
          <span class="star-icon" aria-hidden="true">★</span>
          <span>Starred</span>
        </el-button>
      </div>

      <el-scrollbar class="feed-list">
        <div
          v-for="feed in props.feeds"
          :key="feed.id"
          class="feed-item"
          :class="{ selected: props.selectedFeedId === feed.id }"
          @click="emit('select', feed.id)"
        >
          <span class="feed-accent" aria-hidden="true">{{ feed.title.slice(0, 1).toUpperCase() }}</span>
          <div class="feed-main">
            <p class="feed-title">{{ feed.title }}</p>
          </div>
          <span class="feed-count">{{ feed.entryCount }}</span>
          <el-button
            class="feed-delete-button"
            :icon="Delete"
            link
            type="danger"
            @click.stop="emit('remove', feed)"
          />
        </div>
        <el-empty v-if="!props.loading && props.feeds.length === 0" description="No feeds" :image-size="72" />
      </el-scrollbar>

      <div class="auto-sync-settings">
        <el-switch
          :model-value="props.autoSyncEnabled"
          @update:model-value="emit('updateAutoSyncEnabled', $event)"
        />
        <span class="auto-sync-label"><el-icon><Timer /></el-icon> Auto Sync</span>
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
    </template>
  </section>
</template>

<style scoped>
.sidebar-pane.collapsed {
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
  margin-top: auto;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 84px;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.46);
}

.auto-sync-settings :deep(.el-switch__label) {
  color: var(--muted);
  font-weight: 650;
}

.auto-sync-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}

.auto-sync-settings :deep(.el-select__wrapper) {
  min-height: 32px;
}

.star-icon {
  width: 1em;
  display: inline-flex;
  justify-content: center;
  color: #60a5fa;
  font-size: 14px;
  line-height: 1;
}
</style>
