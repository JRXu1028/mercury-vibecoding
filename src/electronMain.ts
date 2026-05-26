import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppDatabase } from './database.js'
import { FeedService } from './feedService.js'
import { OPMLService } from './opmlService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.resolve(process.cwd(), 'data', 'mercury-vibecoding.db')
const preloadPath = path.resolve(process.cwd(), 'electron', 'preload.cjs')
const rendererDevURL = process.env.MERCURY_RENDERER_URL ?? 'http://127.0.0.1:5173'
const rendererProdIndex = path.resolve(__dirname, '..', 'frontend', 'dist', 'index.html')
const autoSyncIntervalMinutes = Number(process.env.TEAM_A_AUTO_SYNC_MINUTES ?? '10')
const useDevServer = Boolean(process.env.MERCURY_RENDERER_URL)

const database = new AppDatabase({ path: dbPath })
const feedService = new FeedService(database)
const opmlService = new OPMLService(feedService)

let mainWindow: BrowserWindow | null = null
let autoSyncTimer: NodeJS.Timeout | null = null

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

function createMainWindow(): BrowserWindow {
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
    process.stderr.write(`Renderer load failed (${errorCode}): ${errorDescription} - ${validatedURL}\n`)
  })

  if (useDevServer) {
    void window.loadURL(rendererDevURL)
  } else {
    void window.loadFile(rendererProdIndex)
  }

  return window
}

function registerIpcHandlers(): void {
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
      process.stderr.write(`Auto sync failed: ${message}\n`)
    })
  }, autoSyncIntervalMinutes * 60 * 1000)
}

function cleanupAndQuit(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
  database.close()
}

app.whenReady().then(() => {
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
