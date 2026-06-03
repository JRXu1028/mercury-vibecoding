import type { BrowserWindow as ElectronBrowserWindow, IpcMainInvokeEvent } from 'electron'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppDatabase } from './database.js'
import { ContentService } from './contentService.js'
import { FeedService } from './feedService.js'
import { NotesService } from './notesService.js'
import { OPMLService } from './opmlService.js'
import { TagsService } from './tagsService.js'
import { UsageService } from './usageService.js'
import { logger } from './logger.js'
import { hasProvider, registerProvider } from './ai/providerRegistry.js'
import { deepSeekProvider } from './ai/providers/deepSeekProvider.js'
import { mockProvider } from './ai/providers/mockProvider.js'
import { openAICompatibleProvider } from './ai/providers/openAICompatibleProvider.js'
import { summarizeArticle } from './ai/summaryAgent.js'
import { translateArticle } from './ai/translationAgent.js'
import type { ArticleInput, SummaryOptions, TranslationOptions } from './ai/types.js'
import type { EntryContent } from './models.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const { app, BrowserWindow, dialog, ipcMain } = require('electron') as typeof import('electron')

const preloadPath = path.resolve(__dirname, '..', 'electron', 'preload.cjs')
const rendererDevURL = process.env.MERCURY_RENDERER_URL ?? 'http://127.0.0.1:5173'
const rendererProdIndex = path.resolve(__dirname, '..', 'frontend', 'dist', 'index.html')
const autoSyncIntervalMinutes = Number(process.env.TEAM_A_AUTO_SYNC_MINUTES ?? '10')
const useDevServer = Boolean(process.env.MERCURY_RENDERER_URL)
const defaultTranslationTargetLanguage = 'zh-CN'

let database: AppDatabase
let feedService: FeedService
let contentService: ContentService
let notesService: NotesService
let opmlService: OPMLService
let tagsService: TagsService
let usageService: UsageService
let mainWindow: ElectronBrowserWindow | null = null
let autoSyncTimer: NodeJS.Timeout | null = null

type AiEntryBasePayload = {
  entryId: number
  forceRefreshContent?: boolean
}

type AiSummarizeEntryPayload = AiEntryBasePayload & SummaryOptions
type AiTranslateEntryPayload = AiEntryBasePayload & Partial<TranslationOptions>

function registerAiProviders(): void {
  if (!hasProvider(mockProvider.id)) {
    registerProvider(mockProvider)
    usageService.upsertProvider({
      providerId: mockProvider.id,
      name: mockProvider.name
    })
  }

  if (!hasProvider(deepSeekProvider.id)) {
    registerProvider(deepSeekProvider)
    usageService.upsertProvider({
      providerId: deepSeekProvider.id,
      name: deepSeekProvider.name,
      apiKeyEnvVar: 'DEEPSEEK_API_KEY'
    })
  }

  if (!hasProvider(openAICompatibleProvider.id)) {
    registerProvider(openAICompatibleProvider)
    usageService.upsertProvider({
      providerId: openAICompatibleProvider.id,
      name: openAICompatibleProvider.name,
      apiKeyEnvVar: 'OPENAI_COMPATIBLE_API_KEY'
    })
  }
}

function toArticleInput(content: EntryContent): ArticleInput {
  const contentMarkdown = content.markdown.trim()

  if (!contentMarkdown) {
    throw new Error(`Entry ${content.entryId} has no cleaned markdown content for AI processing.`)
  }

  return {
    id: String(content.entryId),
    title: content.title,
    url: content.url,
    source: 'entry-content',
    language: 'unknown',
    contentMarkdown
  }
}

async function getArticleInputForEntry(payload: AiEntryBasePayload): Promise<ArticleInput> {
  const content = await contentService.getEntryContent(payload.entryId, {
    forceRefresh: payload.forceRefreshContent
  })

  return toArticleInput(content)
}

function getFeedsWithEntryCount(): Array<ReturnType<FeedService['listFeeds']>[number] & { entryCount: number }> {
  const counts = new Map<number, number>()
  for (const entry of feedService.listEntries()) {
    counts.set(entry.feedId, (counts.get(entry.feedId) ?? 0) + 1)
  }

  return feedService.listFeeds().map((feed) => ({
    ...feed,
    entryCount: counts.get(feed.id) ?? 0
  }))
}

function createMainWindow(): ElectronBrowserWindow {
  const window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1120,
    minHeight: 680,
    show: false,
    title: 'Mercury Vibecoding',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error(`Renderer load failed: ${errorDescription}`, { errorCode, validatedURL })
  })

  if (useDevServer) {
    void window.loadURL(rendererDevURL)
  } else {
    void window.loadFile(rendererProdIndex)
  }

  return window
}

function initServices(): void {
  const dbPath = path.resolve(app.getPath('userData'), 'mercury-vibecoding.db')
  database = new AppDatabase({ path: dbPath })
  feedService = new FeedService(database)
  contentService = new ContentService(database)
  notesService = new NotesService(database)
  opmlService = new OPMLService(feedService)
  tagsService = new TagsService(database)
  usageService = new UsageService(database)
}

function registerIpcHandlers(): void {
  registerAiProviders()

  ipcMain.handle('feed:list', async () => {
    return getFeedsWithEntryCount()
  })

  ipcMain.handle('feed:add', async (_event: IpcMainInvokeEvent, payload: { url: string }) => {
    return await feedService.addFeed(payload.url)
  })

  ipcMain.handle('feed:remove', async (_event: IpcMainInvokeEvent, payload: { feedId: number }) => {
    feedService.removeFeed(payload.feedId)
    return { ok: true }
  })

  ipcMain.handle('feed:sync', async (_event: IpcMainInvokeEvent, payload: { feedId: number }) => {
    return await feedService.syncFeed(payload.feedId)
  })

  ipcMain.handle('feed:syncAll', async () => {
    return await feedService.syncAllFeeds()
  })

  ipcMain.handle('entry:list', async (_event: IpcMainInvokeEvent, payload: { feedId?: number; q?: string }) => {
    return feedService.listEntries({
      feedId: payload.feedId,
      query: payload.q
    })
  })

  ipcMain.handle('entry:content', async (_event: IpcMainInvokeEvent, payload: { entryId: number; forceRefresh?: boolean }) => {
    return await contentService.getEntryContent(payload.entryId, {
      forceRefresh: payload.forceRefresh
    })
  })

  ipcMain.handle('ai:summarizeEntry', async (_event: IpcMainInvokeEvent, payload: AiSummarizeEntryPayload) => {
    const article = await getArticleInputForEntry(payload)

    const result = await summarizeArticle(article, {
      language: payload.language,
      length: payload.length,
      providerId: payload.providerId,
      model: payload.model
    })

    usageService.recordUsage({
      providerId: result.providerId,
      entryId: payload.entryId,
      operation: 'summarize',
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens
    })

    return result
  })

  ipcMain.handle('ai:translateEntry', async (_event: IpcMainInvokeEvent, payload: AiTranslateEntryPayload) => {
    const article = await getArticleInputForEntry(payload)

    const result = await translateArticle(article, {
      sourceLanguage: payload.sourceLanguage,
      targetLanguage: payload.targetLanguage ?? defaultTranslationTargetLanguage,
      bilingual: payload.bilingual,
      providerId: payload.providerId,
      model: payload.model
    })

    usageService.recordUsage({
      providerId: result.providerId,
      entryId: payload.entryId,
      operation: 'translate',
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens
    })

    return result
  })

  ipcMain.handle('notes:list', async (_event: IpcMainInvokeEvent, payload: { entryId?: number }) => {
    if (payload.entryId !== undefined) {
      return notesService.listByEntry(payload.entryId)
    }
    return notesService.listAll()
  })

  ipcMain.handle('notes:create', async (_event: IpcMainInvokeEvent, payload: { entryId: number; content: string; title?: string }) => {
    return notesService.create(payload.entryId, payload.content, payload.title)
  })

  ipcMain.handle('notes:update', async (_event: IpcMainInvokeEvent, payload: { noteId: number; title?: string | null; content?: string }) => {
    return notesService.update(payload.noteId, { title: payload.title, content: payload.content })
  })

  ipcMain.handle('notes:delete', async (_event: IpcMainInvokeEvent, payload: { noteId: number }) => {
    notesService.delete(payload.noteId)
    return { ok: true }
  })

  ipcMain.handle('tags:list', async () => {
    return tagsService.listTags()
  })

  ipcMain.handle('tags:create', async (_event: IpcMainInvokeEvent, payload: { name: string; color?: string }) => {
    return tagsService.createTag(payload.name, payload.color)
  })

  ipcMain.handle('tags:update', async (_event: IpcMainInvokeEvent, payload: { tagId: number; name?: string; color?: string | null }) => {
    return tagsService.updateTag(payload.tagId, { name: payload.name, color: payload.color })
  })

  ipcMain.handle('tags:delete', async (_event: IpcMainInvokeEvent, payload: { tagId: number }) => {
    tagsService.deleteTag(payload.tagId)
    return { ok: true }
  })

  ipcMain.handle('tags:addToEntry', async (_event: IpcMainInvokeEvent, payload: { entryId: number; tagId: number }) => {
    tagsService.addTagToEntry(payload.entryId, payload.tagId)
    return { ok: true }
  })

  ipcMain.handle('tags:removeFromEntry', async (_event: IpcMainInvokeEvent, payload: { entryId: number; tagId: number }) => {
    tagsService.removeTagFromEntry(payload.entryId, payload.tagId)
    return { ok: true }
  })

  ipcMain.handle('tags:getForEntry', async (_event: IpcMainInvokeEvent, payload: { entryId: number }) => {
    return tagsService.getTagsForEntry(payload.entryId)
  })

  ipcMain.handle('opml:import', async (_event: IpcMainInvokeEvent, payload: { content: string }) => {
    return await opmlService.importFromString(payload.content)
  })

  ipcMain.handle('opml:export', async () => {
    return opmlService.exportToString(feedService.listFeeds())
  })

  ipcMain.handle('opml:openFile', async () => {
    if (!mainWindow) {
      return null
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import OPML',
      properties: ['openFile'],
      filters: [
        { name: 'OPML', extensions: ['opml', 'xml'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const content = await readFile(result.filePaths[0], 'utf8')
    return {
      filePath: result.filePaths[0],
      content
    }
  })

  ipcMain.handle('opml:saveFile', async (_event: IpcMainInvokeEvent, payload: { content: string }) => {
    if (!mainWindow) {
      return null
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export OPML',
      defaultPath: `mercury-feeds-${Date.now()}.opml`,
      filters: [{ name: 'OPML', extensions: ['opml'] }]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    await writeFile(result.filePath, payload.content, 'utf8')
    return result.filePath
  })
}

function startAutoSync(): void {
  if (autoSyncIntervalMinutes <= 0) {
    return
  }

  autoSyncTimer = setInterval(() => {
    void feedService.syncAllFeeds().catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`Auto sync failed: ${message}`)
    })
  }, autoSyncIntervalMinutes * 60 * 1000)
}

const removeLogListener = logger.onLog((entry) => {
  try {
    mainWindow?.webContents.send('app:log', entry)
  } catch {
    // Window may already be destroyed.
  }
})

function cleanupAndQuit(): void {
  removeLogListener()
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
  logger.info('App shutting down')
  database.close()
}

app.whenReady().then(() => {
  initServices()
  registerIpcHandlers()
  startAutoSync()
  mainWindow = createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  cleanupAndQuit()
})
