<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { teamAApi } from '../api/client'
import type { EntryContent, EntryItem } from '../types'

const props = defineProps<{
  entry: EntryItem | null
}>()

const content = ref<EntryContent | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const readerTheme = ref<'light' | 'sepia' | 'dark'>('light')
const activeView = ref<'reader' | 'markdown'>('reader')
const fontSize = ref(17)
const lineHeight = ref(1.7)
let loadVersion = 0

function formatTime(value: string | null): string {
  if (!value) {
    return 'Unknown date'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString()
}

const readerStyle = computed(() => ({
  fontSize: `${fontSize.value}px`,
  lineHeight: String(lineHeight.value)
}))

async function loadContent(forceRefresh = false): Promise<void> {
  if (!props.entry) {
    content.value = null
    errorMessage.value = ''
    return
  }

  const version = ++loadVersion
  isLoading.value = true
  errorMessage.value = ''
  try {
    const result = await teamAApi.getEntryContent(props.entry.id, { forceRefresh })
    if (version === loadVersion) {
      content.value = result
    }
  } catch (error) {
    if (version === loadVersion) {
      content.value = null
      errorMessage.value = error instanceof Error ? error.message : String(error)
    }
  } finally {
    if (version === loadVersion) {
      isLoading.value = false
    }
  }
}

watch(
  () => props.entry?.id,
  () => {
    void loadContent(false)
  },
  { immediate: true }
)
</script>

<template>
  <section class="pane detail-pane">
    <template v-if="entry">
      <header class="detail-header">
        <h1>{{ entry.title }}</h1>
        <div class="detail-actions">
          <el-button
            circle
            :icon="Refresh"
            :loading="isLoading"
            title="Refresh cleaned content"
            @click="loadContent(true)"
          />
          <a :href="entry.url" target="_blank" rel="noreferrer">Open Source</a>
        </div>
      </header>

      <div class="detail-meta">
        <span>{{ entry.author || 'Unknown author' }}</span>
        <span>{{ formatTime(entry.publishedAt || entry.createdAt) }}</span>
        <span v-if="content">Cleaned {{ formatTime(content.fetchedAt) }}</span>
      </div>

      <div class="reader-toolbar">
        <el-segmented
          v-model="activeView"
          :options="[
            { label: 'Reader', value: 'reader' },
            { label: 'Markdown', value: 'markdown' }
          ]"
        />
        <el-segmented
          v-model="readerTheme"
          :options="[
            { label: 'Light', value: 'light' },
            { label: 'Sepia', value: 'sepia' },
            { label: 'Dark', value: 'dark' }
          ]"
        />
        <el-input-number v-model="fontSize" :min="12" :max="18" size="small" controls-position="right" />
        <el-input-number v-model="lineHeight" :min="1.4" :max="2.2" :step="0.1" size="small" controls-position="right" />
      </div>

      <el-scrollbar class="reader-scroll">
        <el-skeleton v-if="isLoading" :rows="8" animated />

        <template v-else-if="content">
          <article
            v-if="activeView === 'reader'"
            class="reader-article"
            :class="`reader-${readerTheme}`"
            :style="readerStyle"
            v-html="content.html"
          />
          <pre
            v-else
            class="reader-markdown"
            :class="`reader-${readerTheme}`"
            :style="readerStyle"
          >{{ content.markdown }}</pre>
        </template>

        <div v-else class="reader-fallback">
          <el-alert
            v-if="errorMessage"
            type="warning"
            :title="errorMessage"
            show-icon
            :closable="false"
          />
          <p>{{ entry.summary || 'No summary in feed item.' }}</p>
        </div>
      </el-scrollbar>
    </template>

    <el-empty v-else description="Select an entry" :image-size="88" />
  </section>
</template>
