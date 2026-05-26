<script setup lang="ts">
import type { EntryItem } from '../types'

defineProps<{
  entry: EntryItem | null
}>()

function formatTime(value: string | null): string {
  if (!value) {
    return 'Unknown date'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString()
}
</script>

<template>
  <section class="pane detail-pane">
    <template v-if="entry">
      <header class="detail-header">
        <h1>{{ entry.title }}</h1>
        <a :href="entry.url" target="_blank" rel="noreferrer">Open Source</a>
      </header>

      <div class="detail-meta">
        <span>{{ entry.author || 'Unknown author' }}</span>
        <span>{{ formatTime(entry.publishedAt || entry.createdAt) }}</span>
      </div>

      <el-scrollbar class="summary-box">
        <p>{{ entry.summary || 'No summary in feed item.' }}</p>
      </el-scrollbar>
    </template>

    <el-empty v-else description="Select an entry" :image-size="88" />
  </section>
</template>
