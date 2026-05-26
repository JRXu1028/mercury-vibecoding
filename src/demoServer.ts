import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL } from 'node:url'
import path from 'node:path'
import { AppDatabase } from './database.js'
import { FeedService } from './feedService.js'
import { OPMLService } from './opmlService.js'

const host = process.env.TEAM_A_HOST ?? '127.0.0.1'
const port = Number(process.env.TEAM_A_PORT ?? '5811')
const dbPath = path.resolve('data', 'mercury-vibecoding.db')
const autoSyncIntervalMinutes = Number(process.env.TEAM_A_AUTO_SYNC_MINUTES ?? '10')

const database = new AppDatabase({ path: dbPath })
const feedService = new FeedService(database)
const opmlService = new OPMLService(feedService)
let autoSyncTimer: NodeJS.Timeout | null = null

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
  })
  res.end(JSON.stringify(data))
}

function sendText(res: ServerResponse, status: number, data: string, contentType = 'text/plain; charset=utf-8'): void {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
  })
  res.end(data)
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) {
    return {}
  }
  return JSON.parse(raw) as Record<string, unknown>
}

function getEntryCountByFeed(): Map<number, number> {
  const counts = new Map<number, number>()
  const entries = feedService.listEntries()
  for (const entry of entries) {
    counts.set(entry.feedId, (counts.get(entry.feedId) ?? 0) + 1)
  }
  return counts
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: 'Invalid request' })
    return
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
    })
    res.end()
    return
  }

  const url = new URL(req.url, `http://${host}:${port}`)

  try {
    if (req.method === 'GET' && url.pathname === '/api/feeds') {
      const counts = getEntryCountByFeed()
      const feeds = feedService.listFeeds().map((feed) => ({
        ...feed,
        entryCount: counts.get(feed.id) ?? 0
      }))
      sendJson(res, 200, { feeds })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/feeds') {
      const body = await readJsonBody(req)
      const feedUrl = typeof body.url === 'string' ? body.url.trim() : ''
      if (!feedUrl) {
        sendJson(res, 400, { error: 'url is required' })
        return
      }
      const result = await feedService.addFeed(feedUrl)
      sendJson(res, 200, result)
      return
    }

    if (req.method === 'DELETE' && /^\/api\/feeds\/\d+$/.test(url.pathname)) {
      const feedId = Number(url.pathname.split('/').pop())
      feedService.removeFeed(feedId)
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'POST' && /^\/api\/feeds\/\d+\/sync$/.test(url.pathname)) {
      const parts = url.pathname.split('/')
      const feedId = Number(parts[3])
      const result = await feedService.syncFeed(feedId)
      sendJson(res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/sync-all') {
      const result = await feedService.syncAllFeeds()
      sendJson(res, 200, { items: result })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/entries') {
      const feedIdRaw = url.searchParams.get('feedId')
      const query = url.searchParams.get('q') ?? undefined
      const feedId = feedIdRaw ? Number(feedIdRaw) : undefined
      const entries = feedService.listEntries({
        feedId: feedId !== undefined && Number.isNaN(feedId) === false ? feedId : undefined,
        query
      })
      sendJson(res, 200, { entries })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/opml/import') {
      const body = await readJsonBody(req)
      const content = typeof body.content === 'string' ? body.content : ''
      if (!content) {
        sendJson(res, 400, { error: 'content is required' })
        return
      }
      const result = await opmlService.importFromString(content)
      sendJson(res, 200, result)
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/opml/export') {
      const opml = opmlService.exportToString(feedService.listFeeds())
      sendText(res, 200, opml, 'text/x-opml; charset=utf-8')
      return
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendJson(res, 500, { error: message })
  }
}

const server = createServer((req, res) => {
  void handle(req, res)
})

server.listen(port, host, () => {
  process.stdout.write(`Team A demo server running at http://${host}:${port}\n`)
  if (autoSyncIntervalMinutes > 0) {
    autoSyncTimer = setInterval(() => {
      void feedService.syncAllFeeds().catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        process.stderr.write(`Auto sync failed: ${message}\n`)
      })
    }, autoSyncIntervalMinutes * 60 * 1000)
    process.stdout.write(`Auto sync every ${autoSyncIntervalMinutes} minutes\n`)
  }
})

process.on('SIGINT', () => {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
  server.close(() => {
    database.close()
    process.exit(0)
  })
})
