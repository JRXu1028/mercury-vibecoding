<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ChatLineRound, MagicStick, Refresh, Setting } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { teamBApi, teamCApi } from '../api/client'
import type { EntryContent, EntryItem, SummaryResult, TranslationResult, TranslationSegmentEvent } from '../types'
import { renderMarkdownToHtml } from '../utils/readerMarkdown'
import { resolveAiAction } from '../utils/aiAction'
import { resetAiView, type ReaderViewMode } from '../utils/readerView'
import { waitForVisibleReset } from '../utils/uiPaint'
import ProviderPanel from './ProviderPanel.vue'
import EntryTags from './EntryTags.vue'
import EntryNotes from './EntryNotes.vue'

const props = defineProps<{
  entry: EntryItem | null
}>()

const content = ref<EntryContent | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const readerTheme = ref<'light' | 'sepia' | 'dark'>('light')
const readerTemplate = ref<'classic' | 'editorial' | 'technical'>('classic')
const activeView = ref<ReaderViewMode>('reader')
const fontSize = ref(17)
const lineHeight = ref(1.7)
const inAppLinkUrl = ref('')
const inAppDialogVisible = ref(false)
const inAppFallbackMessage = ref('')
const isSummarizing = ref(false)
const isTranslating = ref(false)
const aiErrorMessage = ref('')
const summaryResult = ref<SummaryResult | null>(null)
const translationResult = ref<TranslationResult | null>(null)
const aiProviderId = ref('mock')
const providerPanelVisible = ref(false)
const availableProviders = ref<Array<{ providerId: string; name: string; available: boolean }>>([])
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

const renderedReaderHtml = computed(() => {
  if (!content.value) {
    return ''
  }
  return renderMarkdownToHtml(content.value.markdown)
})

const readerClass = computed(() => [
  `reader-${readerTheme.value}`,
  `reader-template-${readerTemplate.value}`
])

const hasAiResult = computed(() => Boolean(summaryResult.value || translationResult.value || aiErrorMessage.value))
const cleanedMarkdown = computed(() => content.value?.markdown.trim() ?? '')
const hasCleanedMarkdown = computed(() => cleanedMarkdown.value.length > 0)
const aiContentMessage = '当前文章没有可用于 AI 处理的 cleaned Markdown，请刷新正文或换一篇文章。'
const isAiActionDisabled = computed(() => isLoading.value || !hasCleanedMarkdown.value)

const viewModeOptions = computed(() => {
  const options: Array<{ label: string; value: string }> = [
    { label: 'Reader', value: 'reader' },
    { label: 'Markdown', value: 'markdown' }
  ]
  if (summaryResult.value) {
    options.push({ label: 'Summary', value: 'summary' })
  }
  if (translationResult.value) {
    options.push({ label: 'Translation', value: 'translation' })
  }
  return options
})

const aiProviderOptions = computed(() => {
  if (availableProviders.value.length === 0) {
    return [{ label: 'Mock', value: 'mock' }]
  }
  return availableProviders.value
    .map((p) => ({
      label: p.available ? p.name : `${p.name} (未配置)`,
      value: p.providerId
    }))
})

/**
 * Convert Markdown text into HTML for the bilingual translation view.
 * Handles: headings, bold, italic, inline code, fenced code blocks,
 * links, images, lists, blockquotes, horizontal rules, paragraphs, and line breaks.
 */
function simpleMarkdownToHtml(text: string): string {
  // ---- phase 0: protect fenced code blocks ----
  const codeBlocks: string[] = []
  let phase0 = text.replace(/```(\S*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : ''
    codeBlocks.push(`<pre><code${langAttr}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`)
    return `\x00CODEBLOCK${idx}\x00`
  })

  // ---- phase 1: escape HTML in non-code parts ----
  const escaped = escapeHtml(phase0)

  // ---- phase 2: restore code blocks ----
  let phase2 = escaped.replace(/\x00CODEBLOCK(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)])

  // ---- phase 3: block-level elements ----

  // Horizontal rules
  phase2 = phase2.replace(/^(\s*[-*_]){3,}\s*$/gm, '<hr>')

  // Headings (must be at line start)
  phase2 = phase2.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
  phase2 = phase2.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
  phase2 = phase2.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
  phase2 = phase2.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
  phase2 = phase2.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
  phase2 = phase2.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')

  // Blockquotes — collect consecutive > lines
  phase2 = phase2.replace(/((?:^&gt;.+(?:\n|$))+)/gm, (block: string) => {
    const inner = block
      .split(/\n/)
      .map((l) => l.replace(/^&gt;\s?/, ''))
      .join('\n')
    return `<blockquote>${inner}</blockquote>`
  })

  // Unordered lists — collect consecutive - /* items
  phase2 = phase2.replace(/((?:^[-*]\s+.+(?:\n|$))+)/gm, (block: string) => {
    const items = block
      .split(/\n/)
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => `<li>${l.replace(/^[-*]\s+/, '')}</li>`)
      .join('')
    return `<ul>${items}</ul>`
  })

  // Ordered lists — collect consecutive 1. 2. items
  phase2 = phase2.replace(/((?:^\d+\.\s+.+(?:\n|$))+)/gm, (block: string) => {
    const items = block
      .split(/\n/)
      .filter((l) => /^\d+\.\s+/.test(l))
      .map((l) => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`)
      .join('')
    return `<ol>${items}</ol>`
  })

  // ---- phase 4: split into paragraphs (double newline) ----
  const paragraphs = phase2.split(/\n\s*\n/)

  const result = paragraphs.map((p) => {
    const trimmed = p.trim()
    if (!trimmed) return ''

    // Skip wrapping if already a block element
    if (/^<(h[1-6]|ul|ol|blockquote|pre|hr|li)/.test(trimmed)) {
      return processInline(trimmed)
    }

    // Convert single newlines to <br>, then process inline
    const withBreaks = trimmed.split(/\n/).join('<br>')
    return `<p>${processInline(withBreaks)}</p>`
  })

  return result.filter(Boolean).join('\n')
}

/** Escape HTML special characters. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Process inline markdown: bold, italic, strikethrough, inline code,
 *  markdown links, images, and bare URLs. */
function processInline(text: string): string {
  let t = text

  // Images ![alt](url) — must go before links
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, alt, url, title) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${titleAttr}>`
    })

  // Links [text](url "title")
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, label, url, title) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"${titleAttr}>${label}</a>`
    })

  // Bold **text** or __text__
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  // Italic *text* or _text_ (but not inside words for _)
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  t = t.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>')

  // Strikethrough ~~text~~
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>')

  // Inline code `text`
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Bare URLs (that aren't already inside an HTML tag attribute)
  t = t.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noreferrer">$1</a>'
  )

  return t
}

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
    const result = await teamCApi.getEntryContent(props.entry.id, { forceRefresh })
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

async function openLinkInApp(url: string): Promise<void> {
  try {
    const openedInDesktopWindow = await teamBApi.openInApp(url)
    if (openedInDesktopWindow) {
      return
    }
  } catch (error) {
    inAppFallbackMessage.value = error instanceof Error ? error.message : String(error)
  }

  inAppLinkUrl.value = url
  inAppFallbackMessage.value = inAppFallbackMessage.value || 'This site may block embedded viewing.'
  inAppDialogVisible.value = true
}

async function openLinkInBrowser(url: string): Promise<void> {
  await teamBApi.openExternal(url)
}

async function chooseOpenLink(url: string): Promise<void> {
  try {
    await ElMessageBox.confirm(url, 'Open link', {
      confirmButtonText: 'Open in App',
      cancelButtonText: 'Open in Browser',
      distinguishCancelAndClose: true,
      type: 'info'
    })
    void openLinkInApp(url)
  } catch (action) {
    if (action === 'cancel') {
      void openLinkInBrowser(url)
    }
  }
}

function toAbsoluteUrl(href: string): string {
  const baseUrl = content.value?.url || props.entry?.url || window.location.href
  return new URL(href, baseUrl).toString()
}

function handleReaderClick(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const link = target.closest('a[href]')
  if (!(link instanceof HTMLAnchorElement)) {
    return
  }

  event.preventDefault()
  void chooseOpenLink(toAbsoluteUrl(link.getAttribute('href') || link.href))
}

async function loadProviders(): Promise<void> {
  try {
    const list = await teamCApi.listProviders()
    availableProviders.value = list.map((p) => ({
      providerId: p.providerId,
      name: p.name,
      available: p.available
    }))
    // Auto-select first available provider if current selection is unavailable
    const currentAvailable = list.find((p) => p.providerId === aiProviderId.value && p.available)
    if (!currentAvailable) {
      const firstAvailable = list.find((p) => p.available)
      if (firstAvailable) {
        aiProviderId.value = firstAvailable.providerId
      }
    }
  } catch {
    // Keep default provider on error.
  }
}

async function loadLatestAiResults(): Promise<void> {
  if (!props.entry) {
    summaryResult.value = null
    translationResult.value = null
    return
  }

  const entryId = props.entry.id
  try {
    const result = await teamCApi.getLatestAiResults(entryId)
    if (props.entry?.id === entryId) {
      summaryResult.value = result.summary
      translationResult.value = result.translation
    }
  } catch {
    if (props.entry?.id === entryId) {
      summaryResult.value = null
      translationResult.value = null
    }
  }
}

function handleSummaryClick(): void {
  const action = resolveAiAction(Boolean(summaryResult.value), 'summary')
  if (action === 'show-summary') {
    activeView.value = 'summary'
    return
  }
  void summarizeEntry()
}

function handleTranslationClick(): void {
  const action = resolveAiAction(Boolean(translationResult.value), 'translation')
  if (action === 'show-translation') {
    activeView.value = 'translation'
    return
  }
  void translateEntry()
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
  const entryId = props.entry.id
  isSummarizing.value = true
  aiErrorMessage.value = ''
  summaryResult.value = {
    articleId: String(entryId),
    summary: '',
    language: 'zh-CN',
    length: 'medium',
    providerId: aiProviderId.value,
    model: '',
    createdAt: new Date().toISOString(),
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  }
  activeView.value = 'summary'

  await nextTick()
  await waitForVisibleReset()

  if (removeSummaryListener) removeSummaryListener()
  removeSummaryListener = teamCApi.onSummaryChunk((data) => {
    if (version !== aiVersion) return
    if (data.entryId !== entryId) return
    if (!summaryResult.value) return
    summaryResult.value = {
      ...summaryResult.value,
      summary: data.accumulated
    }
  })

  try {
    const result = await teamCApi.summarizeEntry(entryId, {
      providerId: aiProviderId.value,
      length: 'medium'
    })
    if (version === aiVersion) {
      summaryResult.value = result
    }
  } catch (error) {
    if (version === aiVersion) {
      summaryResult.value = null
      aiErrorMessage.value = error instanceof Error ? error.message : String(error)
    }
  } finally {
    if (version === aiVersion) {
      isSummarizing.value = false
    }
    if (removeSummaryListener) {
      removeSummaryListener()
      removeSummaryListener = null
    }
  }
}

const translationProgress = ref({ done: 0, total: 0 })
let removeSegmentListener: (() => void) | null = null
let removeSummaryListener: (() => void) | null = null

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
  translationResult.value = {
    articleId: String(props.entry.id),
    targetLanguage: 'zh-CN',
    bilingual: false,
    segments: [],
    providerId: aiProviderId.value,
    model: '',
    createdAt: new Date().toISOString(),
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  }
  activeView.value = 'translation'
  translationProgress.value = { done: 0, total: 0 }
  await nextTick()
  await waitForVisibleReset()

  // Register listener for real-time segments
  if (removeSegmentListener) removeSegmentListener()
  removeSegmentListener = teamCApi.onTranslationSegment((data) => {
    if (version !== aiVersion) return
    if (data.entryId !== props.entry!.id) return

    // Build accumulating result
    const current = translationResult.value
    if (!current || current.segments.length === 0) {
      // First segment — create result shell
      translationResult.value = {
        articleId: String(data.entryId),
        targetLanguage: 'zh-CN',
        bilingual: false,
        segments: [data.segment],
        providerId: '',
        model: '',
        createdAt: new Date().toISOString(),
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      }
    } else {
      // Append or update segment
      const existingIdx = current.segments.findIndex((s) => s.index === data.segment.index)
      if (existingIdx >= 0) {
        current.segments[existingIdx] = data.segment
      } else {
        current.segments.push(data.segment)
      }
      // Keep segments sorted by index
      current.segments.sort((a, b) => a.index - b.index)
    }
    translationProgress.value = { done: data.done, total: data.total }
    // Auto-switch to Translation view on first segment
    if (data.done === 1) {
      activeView.value = 'translation'
    }
  })

  try {
    const result = await teamCApi.translateEntry(props.entry.id, {
      providerId: aiProviderId.value,
      targetLanguage: 'zh-CN',
      bilingual: false
    })
    if (version === aiVersion) {
      // Replace with final result (has correct provider/model/usage)
      translationResult.value = result
    }
  } catch (error) {
    if (version === aiVersion) {
      aiErrorMessage.value = error instanceof Error ? error.message : String(error)
    }
  } finally {
    if (version === aiVersion) {
      isTranslating.value = false
      translationProgress.value = { done: 0, total: 0 }
    }
    if (removeSegmentListener) {
      removeSegmentListener()
      removeSegmentListener = null
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
  activeView.value = resetAiView(activeView.value)
  translationProgress.value = { done: 0, total: 0 }
  if (removeSegmentListener) {
    removeSegmentListener()
    removeSegmentListener = null
  }
  if (removeSummaryListener) {
    removeSummaryListener()
    removeSummaryListener = null
  }
}

watch(
  () => props.entry?.id,
  () => {
    resetAiResults()
    void loadContent(false)
    void loadProviders()
    void loadLatestAiResults()
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
          <el-button link type="primary" @click="chooseOpenLink(entry.url)">Open Source</el-button>
        </div>
      </header>

      <div class="detail-meta">
        <span>{{ entry.author || 'Unknown author' }}</span>
        <span>{{ formatTime(entry.publishedAt || entry.createdAt) }}</span>
        <span v-if="content">Cleaned {{ formatTime(content.fetchedAt) }}</span>
      </div>

      <EntryTags :entry-id="entry.id" />

      <div class="reader-toolbar">
        <el-segmented
          v-model="activeView"
          :options="viewModeOptions"
        />
        <el-segmented
          v-model="readerTheme"
          :options="[
            { label: 'Light', value: 'light' },
            { label: 'Sepia', value: 'sepia' },
            { label: 'Dark', value: 'dark' }
          ]"
        />
        <el-select v-model="readerTemplate" size="small" style="width: 128px">
          <el-option value="classic" label="Classic" />
          <el-option value="editorial" label="Editorial" />
          <el-option value="technical" label="Technical" />
        </el-select>
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
          @click="handleSummaryClick"
        >
          AI Summary
        </el-button>
        <el-button
          type="primary"
          plain
          :icon="ChatLineRound"
          :loading="isTranslating"
          :disabled="isSummarizing || isAiActionDisabled"
          @click="handleTranslationClick"
        >
          AI Translation
        </el-button>
        <el-button
          plain
          :icon="Setting"
          size="small"
          title="AI Provider 设置"
          @click="providerPanelVisible = true"
        />
        <span v-if="content && !hasCleanedMarkdown" class="ai-provider-hint">
          {{ aiContentMessage }}
        </span>
      </div>

      <!-- Reading Area -->
      <el-scrollbar class="reader-scroll">
        <el-skeleton v-if="isLoading" :rows="8" animated />

        <template v-else-if="content">
          <!-- ── Summary card (shown at top of Reader / Markdown views) ── -->
          <div
            v-if="summaryResult && (activeView === 'reader' || activeView === 'markdown')"
            class="summary-inline-card"
            :class="`reader-${readerTheme}`"
          >
            <div class="summary-inline-header">
              <span class="summary-inline-label">AI Summary</span>
              <span class="summary-inline-meta">{{ summaryResult.providerId }} / {{ summaryResult.model }}</span>
            </div>
            <p class="summary-inline-text">{{ summaryResult.summary }}</p>
          </div>

          <!-- Reader View -->
          <article
            v-if="activeView === 'reader'"
            class="reader-article"
            :class="readerClass"
            :style="readerStyle"
            @click="handleReaderClick"
            v-html="renderedReaderHtml"
          />

          <!-- Markdown View -->
          <pre
            v-else-if="activeView === 'markdown'"
            class="reader-markdown"
            :class="readerClass"
            :style="readerStyle"
          >{{ content.markdown }}</pre>

          <!-- Summary View (dedicated) -->
          <article
            v-else-if="activeView === 'summary' && summaryResult"
            class="summary-dedicated-view"
            :class="`reader-${readerTheme}`"
            :style="readerStyle"
          >
            <div class="summary-dedicated-header">
              <h2>AI Summary</h2>
              <span>{{ summaryResult.providerId }} / {{ summaryResult.model }}</span>
              <el-button
                size="small"
                plain
                :loading="isSummarizing"
                :disabled="isTranslating || isAiActionDisabled"
                @click="summarizeEntry"
              >重新生成</el-button>
            </div>
            <div class="summary-dedicated-body">
              <p>{{ summaryResult.summary }}</p>
            </div>
            <div class="summary-dedicated-footer">
              <span class="summary-dedicated-hint">
                摘要仅供参考，建议阅读原文获取完整信息。
              </span>
            </div>
          </article>

          <!-- Translation View (bilingual, segment-by-segment) -->
          <article
            v-else-if="activeView === 'translation' && translationResult"
            class="translation-view"
            :class="`reader-${readerTheme}`"
            :style="readerStyle"
          >
            <div class="translation-header">
              <h2>AI Translation</h2>
              <span class="translation-meta">
                <template v-if="isTranslating && translationProgress.total > 0">
                  翻译中 {{ translationProgress.done }}/{{ translationProgress.total }} 段…
                </template>
                <template v-else>
                  {{ translationResult.providerId }} / {{ translationResult.model }} · {{ translationResult.targetLanguage }}
                </template>
              </span>
              <el-button
                size="small"
                plain
                :loading="isTranslating"
                :disabled="isSummarizing || isAiActionDisabled"
                @click="translateEntry"
              >重新生成</el-button>
            </div>

            <div
              v-for="seg in translationResult.segments"
              :key="seg.index"
              class="trans-pair"
            >
              <div
                v-if="seg.status === 'success'"
                class="trans-seg-source"
                v-html="simpleMarkdownToHtml(seg.source)"
              />
              <div
                v-else
                class="trans-seg-source trans-seg-failed"
              >
                <span class="trans-failed-badge">翻译失败</span>
                <span v-html="simpleMarkdownToHtml(seg.source)" />
                <p class="trans-error-detail">{{ seg.error }}</p>
              </div>
              <div
                v-if="seg.status === 'success'"
                class="trans-seg-target"
                v-html="simpleMarkdownToHtml(seg.translated)"
              />
            </div>
          </article>
        </template>

        <!-- Error / Fallback -->
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

      <!-- AI Error (shown only when no results to display) -->
      <section v-if="aiErrorMessage && !summaryResult && !translationResult" class="ai-error-area">
        <el-alert
          type="warning"
          :title="aiErrorMessage"
          show-icon
          :closable="false"
        />
      </section>

      <EntryNotes :entry-id="entry.id" />
    </template>

    <el-empty v-else description="Select an entry" :image-size="88" />
  </section>

  <el-dialog v-model="inAppDialogVisible" title="In-App Browser" width="80%" top="6vh">
    <div class="in-app-toolbar">
      <el-alert
        v-if="inAppFallbackMessage"
        :title="inAppFallbackMessage"
        type="warning"
        show-icon
        :closable="false"
      />
      <el-button type="primary" plain @click="openLinkInBrowser(inAppLinkUrl)">Open in Browser</el-button>
    </div>
    <iframe
      v-if="inAppLinkUrl"
      class="in-app-browser"
      :src="inAppLinkUrl"
      sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
    />
  </el-dialog>

  <el-dialog
    v-model="providerPanelVisible"
    title="AI Provider 设置"
    width="680"
    :destroy-on-close="true"
  >
    <ProviderPanel />
  </el-dialog>
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

.ai-error-area {
  border-top: 1px solid var(--line);
  padding: 10px 16px;
}

/* ── Inline summary card (top of Reader / Markdown views) ── */
.summary-inline-card {
  max-width: 780px;
  margin: 0 auto 18px;
  padding: 14px 20px;
  border-radius: 8px;
  border: 1px solid #d4e2f5;
  background: linear-gradient(135deg, #f0f6ff, #f7faff);
}

.summary-inline-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.summary-inline-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-inline-meta {
  font-size: 11px;
  color: var(--muted);
}

.summary-inline-text {
  margin: 0;
  font-size: 0.94em;
  line-height: 1.65;
  color: var(--text);
}

/* Dark / sepia overrides */
.summary-inline-card.reader-dark {
  background: linear-gradient(135deg, #1a2535, #1e2a3a);
  border-color: #2d4055;
}

.summary-inline-card.reader-dark .summary-inline-text {
  color: #e6edf3;
}

.summary-inline-card.reader-sepia {
  background: linear-gradient(135deg, #f5ecd7, #f8f0dd);
  border-color: #d8cca8;
}

.summary-inline-card.reader-sepia .summary-inline-text {
  color: #2f2a24;
}

/* ── Dedicated Summary view ── */
.summary-dedicated-view {
  max-width: 780px;
  margin: 0 auto;
  padding: 22px 26px 36px;
}

.summary-dedicated-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}

.summary-dedicated-header h2 {
  margin: 0;
  font-size: 16px;
}

.summary-dedicated-header span {
  font-size: 12px;
  color: var(--muted);
}

.summary-dedicated-body p {
  margin: 0;
  font-size: 1.05em;
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.summary-dedicated-footer {
  margin-top: 24px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.summary-dedicated-hint {
  font-size: 12px;
  color: var(--muted);
}

/* ── Translation bilingual view ── */
.translation-view {
  max-width: 820px;
  margin: 0 auto;
  padding: 18px 26px 36px;
}

.translation-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.translation-header h2 {
  margin: 0;
  font-size: 16px;
}

.translation-meta {
  font-size: 12px;
  color: var(--muted);
}

.trans-pair {
  margin-bottom: 18px;
  padding-bottom: 18px;
  border-bottom: 1px dashed var(--line);
}

.trans-pair:last-child {
  border-bottom: 0;
  margin-bottom: 0;
}

.trans-seg-source {
  font-size: 0.92em;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 8px;
  padding: 8px 12px;
  background: rgba(128, 128, 128, 0.06);
  border-radius: 6px;
  border-left: 3px solid #d0d5dd;
}

.trans-seg-source :deep(p) {
  margin: 0 0 0.4em;
}

.trans-seg-source :deep(p:last-child) {
  margin-bottom: 0;
}

.trans-seg-source :deep(a) {
  color: var(--brand);
  opacity: 0.8;
}

.trans-seg-source :deep(strong) {
  font-weight: 600;
}

.trans-seg-source :deep(code) {
  font-family: "SF Mono", "Cascadia Code", Menlo, monospace;
  font-size: 0.9em;
  background: rgba(128, 128, 128, 0.12);
  padding: 1px 4px;
  border-radius: 3px;
}

.trans-seg-source :deep(h1),
.trans-seg-source :deep(h2),
.trans-seg-source :deep(h3) {
  font-size: 1em;
  font-weight: 600;
  margin: 0.5em 0 0.3em;
  color: inherit;
}

.trans-seg-target {
  font-size: 1em;
  line-height: 1.7;
  padding: 4px 12px;
  overflow-wrap: anywhere;
}

.trans-seg-target :deep(p) {
  margin: 0 0 0.6em;
}

.trans-seg-target :deep(p:last-child) {
  margin-bottom: 0;
}

.trans-seg-target :deep(h1),
.trans-seg-target :deep(h2),
.trans-seg-target :deep(h3),
.trans-seg-target :deep(h4),
.trans-seg-target :deep(h5),
.trans-seg-target :deep(h6) {
  margin: 0.8em 0 0.4em;
  line-height: 1.3;
}

.trans-seg-target :deep(h1:first-child),
.trans-seg-target :deep(h2:first-child),
.trans-seg-target :deep(h3:first-child) {
  margin-top: 0;
}

.trans-seg-target :deep(strong) {
  font-weight: 600;
}

.trans-seg-target :deep(code) {
  font-family: "SF Mono", "Cascadia Code", Menlo, monospace;
  font-size: 0.9em;
  background: rgba(128, 128, 128, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
}

.trans-seg-target :deep(pre) {
  font-family: "SF Mono", "Cascadia Code", Menlo, monospace;
  font-size: 0.88em;
  background: rgba(128, 128, 128, 0.08);
  padding: 10px 14px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0.6em 0;
}

.trans-seg-target :deep(blockquote) {
  margin: 0.6em 0;
  padding: 4px 12px;
  border-left: 3px solid #d0d5dd;
  color: var(--muted);
}

.trans-seg-target :deep(ul),
.trans-seg-target :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.5em;
}

.trans-seg-target :deep(li) {
  margin-bottom: 0.2em;
}

.trans-seg-target :deep(a) {
  color: var(--brand);
}

.trans-seg-target :deep(hr) {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 0.8em 0;
}

.trans-seg-failed {
  border-left-color: var(--el-color-danger, #f56c6c);
  background: rgba(245, 108, 108, 0.05);
}

.trans-failed-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: var(--el-color-danger, #f56c6c);
  padding: 1px 6px;
  border-radius: 3px;
  margin-bottom: 6px;
}

.trans-error-detail {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-color-danger, #f56c6c);
}

/* Dark / sepia overrides for translation view */
.reader-dark .trans-seg-source {
  background: rgba(255, 255, 255, 0.06);
  border-left-color: #555;
}

.reader-dark .trans-seg-target {
  color: #e6edf3;
}

.reader-sepia .trans-seg-source {
  background: rgba(180, 160, 120, 0.12);
  border-left-color: #c4b89c;
}

.reader-sepia .trans-seg-target {
  color: #2f2a24;
}
</style>
