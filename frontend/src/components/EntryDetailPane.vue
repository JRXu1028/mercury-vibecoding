<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  ArrowDown,
  Brush,
  ChatLineRound,
  Clock,
  Close,
  Collection,
  DArrowLeft,
  DArrowRight,
  Link,
  MagicStick,
  Memo,
  Moon,
  MoreFilled,
  Reading,
  Refresh,
  RefreshRight,
  Setting,
  Sunny,
  Upload,
  User
} from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { teamBApi, teamCApi } from '../api/client'
import type { EntryContent, EntryItem, SummaryResult, TranslationResult, TranslationSegmentEvent } from '../types'
import { renderMarkdownToHtml, simpleMarkdownToHtml } from '../utils/readerMarkdown'
import { resolveAiAction } from '../utils/aiAction'
import { resetAiView, type ReaderViewMode } from '../utils/readerView'
import { waitForVisibleReset } from '../utils/uiPaint'
import ProviderPanel from './ProviderPanel.vue'
import EntryTags from './EntryTags.vue'
import EntryNotes from './EntryNotes.vue'

const props = defineProps<{
  entry: EntryItem | null
  feedTitle: string | null
}>()

const content = ref<EntryContent | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const readerTheme = ref<'light' | 'sepia' | 'dark'>('light')
const readerTemplate = ref<'classic' | 'editorial' | 'technical'>('classic')
const activeView = ref<ReaderViewMode>('reader')
const fontSize = ref(17)
const lineHeight = ref(1.7)
const isSummarizing = ref(false)
const isTranslating = ref(false)
const aiErrorMessage = ref('')
const summaryResult = ref<SummaryResult | null>(null)
const translationResult = ref<TranslationResult | null>(null)
const aiProviderId = ref('mock')
const providerPanelVisible = ref(false)
const notesDrawerVisible = ref(false)
const noteCount = ref(0)
const availableProviders = ref<Array<{ providerId: string; name: string; available: boolean }>>([])
const embeddedBrowserVisible = ref(false)
const embeddedBrowserUrl = ref('')
const embeddedBrowserAddress = ref('')
const embeddedBrowserTitle = ref('App Browser')
const embeddedBrowserLoading = ref(false)
const embeddedBrowserCanGoBack = ref(false)
const embeddedBrowserCanGoForward = ref(false)
const embeddedBrowserError = ref('')
const embeddedBrowserView = ref<EmbeddedWebview | null>(null)
const embeddedBrowserRect = ref<EmbeddedBrowserRect>({
  left: 80,
  top: 64,
  width: 1120,
  height: 760
})
let loadVersion = 0
let aiVersion = 0

type EmbeddedBrowserRect = {
  left: number
  top: number
  width: number
  height: number
}

type EmbeddedBrowserResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

type EmbeddedWebview = HTMLElement & {
  src: string
  getURL(): string
  getTitle(): string
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  reload(): void
}

const minEmbeddedBrowserWidth = 640
const minEmbeddedBrowserHeight = 360
const embeddedBrowserMargin = 12
const embeddedBrowserResizeEdges: EmbeddedBrowserResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
let embeddedBrowserResizeState: {
  edge: EmbeddedBrowserResizeEdge
  startX: number
  startY: number
  startRect: EmbeddedBrowserRect
} | null = null

function formatTime(value: string | null): string {
  if (!value) {
    return 'Unknown date'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : date.toLocaleString([], {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
}

const readerStyle = computed(() => ({
  fontSize: `${fontSize.value}px`,
  lineHeight: String(lineHeight.value)
}))

const embeddedBrowserWindowStyle = computed(() => ({
  left: `${embeddedBrowserRect.value.left}px`,
  top: `${embeddedBrowserRect.value.top}px`,
  width: `${embeddedBrowserRect.value.width}px`,
  height: `${embeddedBrowserRect.value.height}px`
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
    { label: '阅读', value: 'reader' },
    { label: 'Markdown', value: 'markdown' }
  ]
  if (summaryResult.value) {
    options.push({ label: '摘要', value: 'summary' })
  }
  if (translationResult.value) {
    options.push({ label: '翻译', value: 'translation' })
  }
  return options
})

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
  const normalizedUrl = await teamBApi.openInApp(url)
  if (!normalizedUrl) {
    await openLinkInBrowser(url)
    return
  }
  await openEmbeddedBrowser(normalizedUrl)
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

function constrainEmbeddedBrowserRect(rect: EmbeddedBrowserRect): EmbeddedBrowserRect {
  const maxWidth = Math.max(minEmbeddedBrowserWidth, window.innerWidth - embeddedBrowserMargin * 2)
  const maxHeight = Math.max(minEmbeddedBrowserHeight, window.innerHeight - embeddedBrowserMargin * 2)
  const width = Math.min(Math.max(rect.width, minEmbeddedBrowserWidth), maxWidth)
  const height = Math.min(Math.max(rect.height, minEmbeddedBrowserHeight), maxHeight)
  const left = Math.min(
    Math.max(rect.left, embeddedBrowserMargin),
    Math.max(embeddedBrowserMargin, window.innerWidth - width - embeddedBrowserMargin)
  )
  const top = Math.min(
    Math.max(rect.top, embeddedBrowserMargin),
    Math.max(embeddedBrowserMargin, window.innerHeight - height - embeddedBrowserMargin)
  )

  return { left, top, width, height }
}

function centerEmbeddedBrowserWindow(): void {
  const width = Math.min(1120, Math.max(minEmbeddedBrowserWidth, window.innerWidth - embeddedBrowserMargin * 2))
  const height = Math.min(760, Math.max(minEmbeddedBrowserHeight, window.innerHeight - embeddedBrowserMargin * 2))
  embeddedBrowserRect.value = constrainEmbeddedBrowserRect({
    left: Math.round((window.innerWidth - width) / 2),
    top: Math.round((window.innerHeight - height) / 2),
    width,
    height
  })
}

async function openEmbeddedBrowser(url: string): Promise<void> {
  if (!embeddedBrowserVisible.value) {
    centerEmbeddedBrowserWindow()
  }
  embeddedBrowserVisible.value = true
  embeddedBrowserUrl.value = url
  embeddedBrowserAddress.value = url
  embeddedBrowserTitle.value = 'App Browser'
  embeddedBrowserError.value = ''
  await nextTick()
  updateEmbeddedBrowserState()
}

function updateEmbeddedBrowserState(): void {
  const view = embeddedBrowserView.value
  if (!view) {
    embeddedBrowserCanGoBack.value = false
    embeddedBrowserCanGoForward.value = false
    return
  }

  try {
    embeddedBrowserCanGoBack.value = view.canGoBack()
    embeddedBrowserCanGoForward.value = view.canGoForward()
    const currentUrl = view.getURL()
    if (currentUrl) {
      embeddedBrowserAddress.value = currentUrl
    }
    const title = view.getTitle()
    embeddedBrowserTitle.value = title || 'App Browser'
  } catch {
    embeddedBrowserCanGoBack.value = false
    embeddedBrowserCanGoForward.value = false
  }
}

function navigateEmbeddedBrowser(): void {
  const target = embeddedBrowserAddress.value.trim()
  if (!target) {
    return
  }
  embeddedBrowserUrl.value = /^[a-z][a-z0-9+.-]*:/i.test(target) ? target : `https://${target}`
  embeddedBrowserError.value = ''
}

function startEmbeddedBrowserResize(edge: EmbeddedBrowserResizeEdge, event: PointerEvent): void {
  event.preventDefault()
  event.stopPropagation()
  embeddedBrowserResizeState = {
    edge,
    startX: event.clientX,
    startY: event.clientY,
    startRect: { ...embeddedBrowserRect.value }
  }
  window.addEventListener('pointermove', handleEmbeddedBrowserResize)
  window.addEventListener('pointerup', stopEmbeddedBrowserResize, { once: true })
}

function handleEmbeddedBrowserResize(event: PointerEvent): void {
  if (!embeddedBrowserResizeState) {
    return
  }

  const { edge, startX, startY, startRect } = embeddedBrowserResizeState
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  const next = { ...startRect }

  if (edge.includes('e')) {
    next.width = startRect.width + dx
  }
  if (edge.includes('s')) {
    next.height = startRect.height + dy
  }
  if (edge.includes('w')) {
    const right = startRect.left + startRect.width
    next.width = startRect.width - dx
    next.left = right - Math.max(next.width, minEmbeddedBrowserWidth)
  }
  if (edge.includes('n')) {
    const bottom = startRect.top + startRect.height
    next.height = startRect.height - dy
    next.top = bottom - Math.max(next.height, minEmbeddedBrowserHeight)
  }

  embeddedBrowserRect.value = constrainEmbeddedBrowserRect(next)
}

function stopEmbeddedBrowserResize(): void {
  embeddedBrowserResizeState = null
  window.removeEventListener('pointermove', handleEmbeddedBrowserResize)
}

function goEmbeddedBrowserBack(): void {
  const view = embeddedBrowserView.value
  if (view?.canGoBack()) {
    view.goBack()
  }
}

function goEmbeddedBrowserForward(): void {
  const view = embeddedBrowserView.value
  if (view?.canGoForward()) {
    view.goForward()
  }
}

function reloadEmbeddedBrowser(): void {
  embeddedBrowserView.value?.reload()
}

async function openEmbeddedBrowserExternal(): Promise<void> {
  const currentUrl = embeddedBrowserView.value?.getURL() || embeddedBrowserUrl.value
  if (currentUrl) {
    await openLinkInBrowser(currentUrl)
  }
}

function handleEmbeddedBrowserNavigation(): void {
  embeddedBrowserLoading.value = true
  embeddedBrowserError.value = ''
  updateEmbeddedBrowserState()
}

function handleEmbeddedBrowserLoaded(): void {
  embeddedBrowserLoading.value = false
  updateEmbeddedBrowserState()
}

function handleEmbeddedBrowserFailed(event: Event): void {
  embeddedBrowserLoading.value = false
  const details = event as Event & {
    errorCode?: number
    errorDescription?: string
    validatedURL?: string
  }
  if (details.errorCode === -3) {
    updateEmbeddedBrowserState()
    return
  }
  embeddedBrowserError.value = details.errorDescription || 'This page failed to load in the app browser.'
  updateEmbeddedBrowserState()
}

function handleEmbeddedBrowserNewWindow(event: Event): void {
  event.preventDefault()
  const nextUrl = (event as Event & { url?: string }).url
  if (nextUrl) {
    embeddedBrowserUrl.value = nextUrl
    embeddedBrowserAddress.value = nextUrl
    embeddedBrowserError.value = ''
  }
}

function closeEmbeddedBrowser(): void {
  embeddedBrowserVisible.value = false
  embeddedBrowserUrl.value = ''
  embeddedBrowserAddress.value = ''
  embeddedBrowserTitle.value = 'App Browser'
  embeddedBrowserLoading.value = false
  embeddedBrowserCanGoBack.value = false
  embeddedBrowserCanGoForward.value = false
  embeddedBrowserError.value = ''
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

async function loadNoteCount(): Promise<void> {
  if (!props.entry) {
    noteCount.value = 0
    return
  }

  const entryId = props.entry.id
  try {
    const notes = await teamBApi.listNotes(entryId)
    if (props.entry?.id === entryId) {
      noteCount.value = notes.length
    }
  } catch {
    if (props.entry?.id === entryId) {
      noteCount.value = 0
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

function handleArticleCommand(command: string): void {
  if (!props.entry) {
    return
  }
  if (command === 'refresh') {
    void loadContent(true)
  } else if (command === 'provider') {
    providerPanelVisible.value = true
  }
}

function handleAiCommand(command: string): void {
  if (command === 'summary') {
    handleSummaryClick()
  } else if (command === 'translation') {
    handleTranslationClick()
  } else if (command === 'provider') {
    providerPanelVisible.value = true
  }
}

function updateNoteCount(value: number): void {
  noteCount.value = value
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
    void loadNoteCount()
  },
  { immediate: true }
)

watch(aiProviderId, () => {
  resetAiResults()
})

teamBApi.onWebviewNewWindow(({ url }) => {
  embeddedBrowserUrl.value = url
  embeddedBrowserAddress.value = url
  embeddedBrowserError.value = ''
})
</script>

<template>
  <section class="pane detail-pane">
    <template v-if="entry">
      <header class="detail-header">
        <h1>{{ entry.title }}</h1>
        <div class="detail-actions">
          <el-button link type="primary" :icon="Link" @click="chooseOpenLink(entry.url)">打开原文</el-button>
          <el-dropdown trigger="click" @command="handleArticleCommand">
            <el-button :icon="MoreFilled" circle size="small" title="更多文章操作" />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="refresh" :icon="Refresh">重新清洗正文</el-dropdown-item>
                <el-dropdown-item command="provider" :icon="Setting">AI Provider 设置</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <div class="detail-meta">
        <span><el-icon><Collection /></el-icon>{{ props.feedTitle || 'Unknown feed' }}</span>
        <span><el-icon><User /></el-icon>{{ entry.author || 'Unknown author' }}</span>
        <span><el-icon><Clock /></el-icon>{{ formatTime(entry.publishedAt || entry.createdAt) }}</span>
        <span v-if="content"><el-icon><Brush /></el-icon>已清洗</span>
      </div>

      <EntryTags :entry-id="entry.id" />

      <div class="reader-toolbar">
        <el-segmented
          v-model="activeView"
          :options="viewModeOptions"
        />
        <div class="theme-icon-group" aria-label="Reader theme">
          <button
            type="button"
            class="theme-icon-button"
            :class="{ selected: readerTheme === 'light' }"
            title="浅色"
            @click="readerTheme = 'light'"
          >
            <el-icon><Sunny /></el-icon>
          </button>
          <button
            type="button"
            class="theme-icon-button"
            :class="{ selected: readerTheme === 'sepia' }"
            title="护眼"
            @click="readerTheme = 'sepia'"
          >
            <el-icon><Reading /></el-icon>
          </button>
          <button
            type="button"
            class="theme-icon-button"
            :class="{ selected: readerTheme === 'dark' }"
            title="深色"
            @click="readerTheme = 'dark'"
          >
            <el-icon><Moon /></el-icon>
          </button>
        </div>
        <el-select v-model="readerTemplate" size="small" class="reader-template-select">
          <el-option value="classic" label="Classic" />
          <el-option value="editorial" label="Editorial" />
          <el-option value="technical" label="Technical" />
        </el-select>
        <span class="reader-control-label">字号</span>
        <el-input-number v-model="fontSize" :min="12" :max="18" size="small" controls-position="right" />
        <span class="reader-control-label">行距</span>
        <el-input-number v-model="lineHeight" :min="1.4" :max="2.2" :step="0.1" size="small" controls-position="right" />
        <el-dropdown trigger="click" @command="handleAiCommand">
          <el-button class="ai-menu-button" plain size="small" :loading="isSummarizing || isTranslating">
            AI <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="summary" :icon="MagicStick" :disabled="isTranslating || isAiActionDisabled">
                生成/查看摘要
              </el-dropdown-item>
              <el-dropdown-item command="translation" :icon="ChatLineRound" :disabled="isSummarizing || isAiActionDisabled">
                生成/查看翻译
              </el-dropdown-item>
              <el-dropdown-item divided command="provider" :icon="Setting">Provider 设置</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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

      <button class="notes-fab" type="button" @click="notesDrawerVisible = true">
        <el-icon><Memo /></el-icon>
        笔记<span v-if="noteCount > 0">{{ noteCount }}</span>
      </button>
    </template>

    <el-empty v-else description="Select an entry" :image-size="88" />
  </section>

  <div v-if="embeddedBrowserVisible" class="embedded-browser-shell">
    <div class="embedded-browser-surface" :style="embeddedBrowserWindowStyle">
      <form class="embedded-browser-toolbar" @submit.prevent="navigateEmbeddedBrowser">
        <el-button
          circle
          :icon="DArrowLeft"
          native-type="button"
          :disabled="!embeddedBrowserCanGoBack"
          title="Back"
          @click="goEmbeddedBrowserBack"
        />
        <el-button
          circle
          :icon="DArrowRight"
          native-type="button"
          :disabled="!embeddedBrowserCanGoForward"
          title="Forward"
          @click="goEmbeddedBrowserForward"
        />
        <el-button
          circle
          :icon="RefreshRight"
          native-type="button"
          :loading="embeddedBrowserLoading"
          title="Reload"
          @click="reloadEmbeddedBrowser"
        />
        <el-input
          v-model="embeddedBrowserAddress"
          class="embedded-browser-address"
          spellcheck="false"
        />
        <el-button
          circle
          :icon="Upload"
          native-type="button"
          title="Open in Browser"
          @click="openEmbeddedBrowserExternal"
        />
        <el-button
          circle
          class="embedded-browser-close"
          :icon="Close"
          native-type="button"
          title="Close"
          @click="closeEmbeddedBrowser"
        />
      </form>

      <div class="embedded-browser-content">
        <el-alert
          v-if="embeddedBrowserError"
          class="embedded-browser-error"
          type="warning"
          :title="embeddedBrowserError"
          show-icon
          :closable="false"
        />

        <div class="embedded-browser-frame">
          <webview
            v-if="embeddedBrowserUrl"
            ref="embeddedBrowserView"
            class="embedded-browser-view"
            :src="embeddedBrowserUrl"
            @did-start-loading="handleEmbeddedBrowserNavigation"
            @did-navigate="handleEmbeddedBrowserNavigation"
            @did-navigate-in-page="handleEmbeddedBrowserNavigation"
            @did-stop-loading="handleEmbeddedBrowserLoaded"
            @did-fail-load="handleEmbeddedBrowserFailed"
            @page-title-updated="handleEmbeddedBrowserLoaded"
            @new-window="handleEmbeddedBrowserNewWindow"
          />
        </div>
      </div>

      <div
        v-for="edge in embeddedBrowserResizeEdges"
        :key="edge"
        class="embedded-browser-resizer"
        :class="`is-${edge}`"
        @pointerdown="startEmbeddedBrowserResize(edge, $event)"
      />
    </div>
  </div>

  <el-dialog
    v-model="providerPanelVisible"
    title="AI Provider 设置"
    width="680"
    :destroy-on-close="true"
  >
    <ProviderPanel />
  </el-dialog>

  <el-drawer
    v-model="notesDrawerVisible"
    title="笔记"
    direction="rtl"
    size="380px"
    :destroy-on-close="false"
  >
    <EntryNotes v-if="entry" :entry-id="entry.id" @count-change="updateNoteCount" />
  </el-drawer>
</template>

<style scoped>
.ai-provider-hint {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
  max-width: 420px;
}

.notes-fab {
  position: absolute;
  right: 28px;
  bottom: 22px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 13px;
  border: 1px solid rgba(207, 196, 179, 0.86);
  border-radius: 999px;
  color: var(--muted);
  cursor: pointer;
  background: rgba(255, 253, 250, 0.88);
  box-shadow: 0 10px 24px rgba(75, 60, 39, 0.1);
}

.notes-fab:hover {
  color: var(--brand-strong);
  border-color: rgba(163, 90, 22, 0.36);
  background: var(--brand-soft);
}

.notes-fab span {
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  background: var(--brand);
}

.ai-error-area {
  border-top: 1px solid var(--line);
  padding: 12px 24px;
  background: rgba(255, 253, 250, 0.62);
}

.embedded-browser-shell {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(37, 35, 31, 0.5);
  backdrop-filter: blur(10px);
}

.embedded-browser-surface {
  position: absolute;
  min-width: 640px;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  overflow: visible;
  border: 1px solid rgba(222, 214, 200, 0.82);
  border-radius: 18px;
  background: var(--paper);
  box-shadow: 0 26px 70px rgba(37, 35, 31, 0.28);
}

.embedded-browser-toolbar {
  flex: 0 0 auto;
  min-height: 46px;
  display: grid;
  grid-template-columns: 36px 36px 36px minmax(180px, 1fr) 36px 36px;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  border-radius: 18px 18px 0 0;
  background: #fffdfa;
}

.embedded-browser-toolbar :deep(.el-button.is-circle) {
  width: 34px;
  height: 34px;
  margin-left: 0;
}

.embedded-browser-address {
  min-width: 0;
}

.embedded-browser-error {
  border-radius: 0;
}

.embedded-browser-content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0 0 8px 8px;
}

.embedded-browser-close {
  --el-button-bg-color: #fef2f2;
  --el-button-border-color: #fecaca;
  --el-button-hover-bg-color: #fee2e2;
  --el-button-hover-border-color: #f87171;
  --el-button-active-bg-color: #fecaca;
  color: #dc2626;
}

.embedded-browser-frame {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--reader-bg);
}

.embedded-browser-view {
  position: absolute;
  inset: 0;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  background: #ffffff;
}

.embedded-browser-resizer {
  position: absolute;
  z-index: 2;
}

.embedded-browser-resizer.is-n,
.embedded-browser-resizer.is-s {
  left: 18px;
  right: 18px;
  height: 12px;
  cursor: ns-resize;
}

.embedded-browser-resizer.is-n {
  top: -12px;
}

.embedded-browser-resizer.is-s {
  bottom: -12px;
}

.embedded-browser-resizer.is-e,
.embedded-browser-resizer.is-w {
  top: 18px;
  bottom: 18px;
  width: 12px;
  cursor: ew-resize;
}

.embedded-browser-resizer.is-e {
  right: -12px;
}

.embedded-browser-resizer.is-w {
  left: -12px;
}

.embedded-browser-resizer.is-ne,
.embedded-browser-resizer.is-nw,
.embedded-browser-resizer.is-se,
.embedded-browser-resizer.is-sw {
  width: 18px;
  height: 18px;
}

.embedded-browser-resizer.is-ne {
  top: -12px;
  right: -12px;
  cursor: nesw-resize;
}

.embedded-browser-resizer.is-nw {
  top: -12px;
  left: -12px;
  cursor: nwse-resize;
}

.embedded-browser-resizer.is-se {
  right: -12px;
  bottom: -12px;
  cursor: nwse-resize;
}

.embedded-browser-resizer.is-sw {
  bottom: -12px;
  left: -12px;
  cursor: nesw-resize;
}

/* ── Inline summary card (top of Reader / Markdown views) ── */
.summary-inline-card {
  max-width: 780px;
  margin: 0 auto 18px;
  padding: 16px 20px;
  border-radius: 16px;
  border: 1px solid rgba(207, 196, 179, 0.76);
  background: #fff8ef;
  box-shadow: 0 10px 24px rgba(75, 60, 39, 0.06);
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
  background: #29221c;
  border-color: rgba(255, 248, 239, 0.1);
}

.summary-inline-card.reader-dark .summary-inline-text {
  color: #e6edf3;
}

.summary-inline-card.reader-sepia {
  background: #f5ecd7;
  border-color: #d8cca8;
}

.summary-inline-card.reader-sepia .summary-inline-text {
  color: #2f2a24;
}

/* ── Dedicated Summary view ── */
.summary-dedicated-view {
  max-width: 780px;
  margin: 0 auto;
  padding: 30px 34px 42px;
  border: 1px solid rgba(222, 214, 200, 0.76);
  border-radius: 20px;
  background: var(--paper);
  box-shadow: var(--shadow-paper);
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
  padding: 30px 34px 42px;
  border: 1px solid rgba(222, 214, 200, 0.76);
  border-radius: 20px;
  background: var(--paper);
  box-shadow: var(--shadow-paper);
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
  padding: 10px 12px;
  background: rgba(117, 111, 102, 0.08);
  border-radius: 12px;
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

.summary-dedicated-view.reader-dark,
.translation-view.reader-dark {
  background: #151a1f;
  border-color: rgba(255, 255, 255, 0.08);
}

.reader-sepia .trans-seg-source {
  background: rgba(180, 160, 120, 0.12);
  border-left-color: #c4b89c;
}

.reader-sepia .trans-seg-target {
  color: #2f2a24;
}

.summary-dedicated-view.reader-sepia,
.translation-view.reader-sepia {
  background: #fbf3df;
}
</style>
