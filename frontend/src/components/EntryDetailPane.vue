<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChatLineRound, MagicStick, Refresh } from '@element-plus/icons-vue'
import { teamAApi } from '../api/client'
import type { EntryContent, EntryItem, SummaryResult, TranslationResult } from '../types'

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
const isSummarizing = ref(false)
const isTranslating = ref(false)
const aiErrorMessage = ref('')
const summaryResult = ref<SummaryResult | null>(null)
const translationResult = ref<TranslationResult | null>(null)
const aiProviderId = ref<'mock' | 'deepseek'>('mock')
let loadVersion = 0
let aiVersion = 0

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

const hasAiResult = computed(() => Boolean(summaryResult.value || translationResult.value || aiErrorMessage.value))
const cleanedMarkdown = computed(() => content.value?.markdown.trim() ?? '')
const hasCleanedMarkdown = computed(() => cleanedMarkdown.value.length > 0)
const aiContentMessage = '当前文章没有可用于 AI 处理的 cleaned Markdown，请刷新正文或换一篇文章。'
const isAiActionDisabled = computed(() => isLoading.value || !hasCleanedMarkdown.value)
const aiProviderOptions: Array<{ label: string; value: 'mock' | 'deepseek' }> = [
  { label: 'Mock', value: 'mock' },
  { label: 'DeepSeek', value: 'deepseek' }
]

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

async function summarizeEntry(): Promise<void> {
  if (!props.entry) {
    return
  }
  if (!hasCleanedMarkdown.value) {
    aiErrorMessage.value = aiContentMessage
    return
  }

  const version = ++aiVersion
  isSummarizing.value = true
  aiErrorMessage.value = ''
  try {
    const result = await teamAApi.summarizeEntry(props.entry.id, {
      providerId: aiProviderId.value,
      length: 'medium'
    })
    if (version === aiVersion) {
      summaryResult.value = result
    }
  } catch (error) {
    if (version === aiVersion) {
      aiErrorMessage.value = error instanceof Error ? error.message : String(error)
    }
  } finally {
    if (version === aiVersion) {
      isSummarizing.value = false
    }
  }
}

async function translateEntry(): Promise<void> {
  if (!props.entry) {
    return
  }
  if (!hasCleanedMarkdown.value) {
    aiErrorMessage.value = aiContentMessage
    return
  }

  const version = ++aiVersion
  isTranslating.value = true
  aiErrorMessage.value = ''
  try {
    const result = await teamAApi.translateEntry(props.entry.id, {
      providerId: aiProviderId.value,
      targetLanguage: 'zh-CN',
      bilingual: false
    })
    if (version === aiVersion) {
      translationResult.value = result
    }
  } catch (error) {
    if (version === aiVersion) {
      aiErrorMessage.value = error instanceof Error ? error.message : String(error)
    }
  } finally {
    if (version === aiVersion) {
      isTranslating.value = false
    }
  }
}

function resetAiResults(): void {
  aiVersion += 1
  isSummarizing.value = false
  isTranslating.value = false
  aiErrorMessage.value = ''
  summaryResult.value = null
  translationResult.value = null
}

watch(
  () => props.entry?.id,
  () => {
    resetAiResults()
    void loadContent(false)
  },
  { immediate: true }
)

watch(aiProviderId, () => {
  resetAiResults()
})
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

      <div class="ai-toolbar">
        <el-segmented
          v-model="aiProviderId"
          :options="aiProviderOptions"
          size="small"
          class="ai-provider-switch"
        />
        <el-button
          type="primary"
          plain
          :icon="MagicStick"
          :loading="isSummarizing"
          :disabled="isTranslating || isAiActionDisabled"
          @click="summarizeEntry"
        >
          AI Summary
        </el-button>
        <el-button
          type="primary"
          plain
          :icon="ChatLineRound"
          :loading="isTranslating"
          :disabled="isSummarizing || isAiActionDisabled"
          @click="translateEntry"
        >
          AI Translation
        </el-button>
        <span v-if="aiProviderId === 'deepseek'" class="ai-provider-hint">
          DeepSeek 需要在启动桌面应用的 shell 中临时设置 DEEPSEEK_API_KEY。
        </span>
        <span v-if="content && !hasCleanedMarkdown" class="ai-provider-hint">
          {{ aiContentMessage }}
        </span>
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

      <section v-if="hasAiResult" class="ai-result-area">
        <el-alert
          v-if="aiErrorMessage"
          type="warning"
          :title="aiErrorMessage"
          show-icon
          :closable="false"
        />

        <section v-if="summaryResult" class="ai-result-block">
          <header>
            <h2>AI Summary</h2>
            <span>{{ summaryResult.providerId }} / {{ summaryResult.model }}</span>
          </header>
          <p>{{ summaryResult.summary }}</p>
        </section>

        <section v-if="translationResult" class="ai-result-block">
          <header>
            <h2>AI Translation</h2>
            <span>{{ translationResult.providerId }} / {{ translationResult.model }}</span>
          </header>
          <div class="translation-segments">
            <div
              v-for="segment in translationResult.segments"
              :key="segment.index"
              class="translation-segment"
            >
              <p v-if="translationResult.bilingual" class="translation-source">{{ segment.source }}</p>
              <p>{{ segment.translated || segment.error }}</p>
            </div>
          </div>
        </section>
      </section>
    </template>

    <el-empty v-else description="Select an entry" :image-size="88" />
  </section>
</template>

<style scoped>
.ai-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  border-top: 1px solid var(--line);
  padding-top: 10px;
}

.ai-provider-switch {
  flex: 0 0 auto;
}

.ai-provider-hint {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
  max-width: 420px;
}

.ai-result-area {
  border-top: 1px solid var(--line);
  max-height: 36%;
  overflow: auto;
  padding-top: 12px;
}

.ai-result-block {
  max-width: 780px;
  margin: 0 auto 12px;
  padding: 0 26px;
}

.ai-result-block header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.ai-result-block h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
}

.ai-result-block span,
.translation-source {
  color: var(--muted);
  font-size: 12px;
}

.ai-result-block p {
  margin: 0 0 10px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.translation-segment {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}

.translation-segment:first-child {
  border-top: 0;
  padding-top: 0;
}
</style>
