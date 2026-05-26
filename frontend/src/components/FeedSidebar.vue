<script setup lang="ts">
import { Delete, Plus, Refresh, Upload, Download } from '@element-plus/icons-vue'
import type { FeedItem } from '../types'

defineProps<{
  feeds: FeedItem[]
  selectedFeedId: number | null
  loading: boolean
}>()

const emit = defineEmits<{
  select: [feedId: number | null]
  add: []
  syncAll: []
  importOpml: []
  exportOpml: []
  remove: [feed: FeedItem]
}>()
</script>

<template>
  <section class="pane sidebar-pane">
    <header class="pane-header">
      <h2>Feeds</h2>
      <div class="toolbar-actions">
        <el-button :icon="Plus" circle size="small" @click="emit('add')" />
        <el-button :icon="Refresh" circle size="small" @click="emit('syncAll')" />
      </div>
    </header>

    <div class="menu-actions">
      <el-button text :icon="Upload" @click="emit('importOpml')">Import OPML</el-button>
      <el-button text :icon="Download" @click="emit('exportOpml')">Export OPML</el-button>
      <el-button text @click="emit('select', null)">All Feeds</el-button>
    </div>

    <el-scrollbar class="feed-list">
      <div
        v-for="feed in feeds"
        :key="feed.id"
        class="feed-item"
        :class="{ selected: selectedFeedId === feed.id }"
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
      <el-empty v-if="!loading && feeds.length === 0" description="No feeds" :image-size="72" />
    </el-scrollbar>
  </section>
</template>
