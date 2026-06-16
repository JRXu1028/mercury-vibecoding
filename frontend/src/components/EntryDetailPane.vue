<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ChatLineRound, Close, DArrowLeft, DArrowRight, MagicStick, Refresh, RefreshRight, Setting, Upload } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { teamBApi, teamCApi } from '../api/client'
import type { EntryContent, EntryItem, SummaryResult, TranslationResult, TranslationSegmentEvent } from '../types'
import { renderMarkdownToHtml } from '../utils/readerMarkdown'
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
const activeView = ref<'reader' | 'markdown' | 'summary' | 'translation'>('reader')
const fontSize = ref(17)
const lineHeight = ref(1.7)
const isSummarizing = ref(false)
const isTranslating = ref(false)
const aiErrorMessage = ref('')
const summaryResult = ref<SummaryResult | null>(null)
const translationResult = ref<TranslationResult | null>(null)
const aiProviderId = ref('mock')
const providerPanelVisible = ref(false)
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
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString()
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
    const result = await teamCApi.summarizeEntry(props.entry.id, {
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

const translationProgress = ref({ done: 0, total: 0 })
let removeSegmentListener: (() => void) | null = null

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
  translationProgress.value = { done: 0, total: 0 }

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
      translationResult.value = {
        ...result,
        segments: translationResult.value?.segments.length === result.segments.length
          ? translationResult.value.segments  // keep progressively-built segments if same count
          : result.segments
      }
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
  translationProgress.value = { done: 0, total: 0 }
  if (removeSegmentListener) {
    removeSegmentListener()
    removeSegmentListener = null
  }
}

watch(
  () => props.entry?.id,
  () => {
    resetAiResults()
    void loadContent(false)
    void loadProviders()
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
            allowpopups
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

.embedded-browser-shell {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(15, 23, 42, 0.38);
}

.embedded-browser-surface {
  position: absolute;
  min-width: 640px;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.24);
}

.embedded-browser-toolbar {
  flex: 0 0 auto;
  min-height: 46px;
  display: grid;
  grid-template-columns: 36px 36px 36px minmax(180px, 1fr) 36px 36px;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--line);
  background: #ffffff;
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
  background: #ffffff;
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
  left: 12px;
  right: 12px;
  height: 10px;
  cursor: ns-resize;
}

.embedded-browser-resizer.is-n {
  top: 0;
}

.embedded-browser-resizer.is-s {
  bottom: 0;
}

.embedded-browser-resizer.is-e,
.embedded-browser-resizer.is-w {
  top: 12px;
  bottom: 12px;
  width: 10px;
  cursor: ew-resize;
}

.embedded-browser-resizer.is-e {
  right: 0;
}

.embedded-browser-resizer.is-w {
  left: 0;
}

.embedded-browser-resizer.is-ne,
.embedded-browser-resizer.is-nw,
.embedded-browser-resizer.is-se,
.embedded-browser-resizer.is-sw {
  width: 16px;
  height: 16px;
}

.embedded-browser-resizer.is-ne {
  top: 0;
  right: 0;
  cursor: nesw-resize;
}

.embedded-browser-resizer.is-nw {
  top: 0;
  left: 0;
  cursor: nwse-resize;
}

.embedded-browser-resizer.is-se {
  right: 0;
  bottom: 0;
  cursor: nwse-resize;
}

.embedded-browser-resizer.is-sw {
  bottom: 0;
  left: 0;
  cursor: nesw-resize;
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
