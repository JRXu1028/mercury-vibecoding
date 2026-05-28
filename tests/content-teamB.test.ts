import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppDatabase } from '../src/database.js'
import { FeedService } from '../src/feedService.js'
import { ContentService } from '../src/contentService.js'
import type { ParsedFeed } from '../src/models.js'

const parseFeedMock = vi.fn<[], Promise<ParsedFeed>>()

vi.mock('../src/feedParser.js', () => ({
  parseFeed: (url: string) => parseFeedMock(url)
}))

describe('Team B content cleaning flow', () => {
  let tmpDir = ''
  let database: AppDatabase
  let feedService: FeedService
  let contentService: ContentService

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mercury-vibecoding-'))
    database = new AppDatabase({ path: path.join(tmpDir, 'test.db') })
    feedService = new FeedService(database)
    contentService = new ContentService(database)
    parseFeedMock.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    database.close()
    await rm(tmpDir, { recursive: true, force: true })
  })

  async function seedEntry(): Promise<number> {
    parseFeedMock.mockResolvedValue({
      title: 'Example Feed',
      feedUrl: 'https://example.com/feed.xml',
      siteUrl: 'https://example.com',
      description: null,
      entries: [
        {
          guid: 'entry-1',
          url: 'https://example.com/posts/1',
          title: 'Clean Me',
          author: 'Alice',
          summary: 'Summary from RSS',
          publishedAt: '2026-05-26T00:00:00.000Z'
        }
      ]
    })

    const added = await feedService.addFeed('https://example.com/feed.xml')
    return feedService.listEntries({ feedId: added.feed.id })[0].id
  }

  it('extracts clean HTML and Markdown, then caches the cleaned content', async () => {
    const entryId = await seedEntry()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `<!doctype html>
        <html>
          <head><title>Original Page</title></head>
          <body>
            <article>
              <h1>Readable Title</h1>
              <p>This is the first paragraph worth reading.</p>
              <script>alert('bad')</script>
              <p><a href="https://example.com/ref">Useful reference</a></p>
            </article>
          </body>
        </html>`
    } as Response)

    const content = await contentService.getEntryContent(entryId)
    const cached = await contentService.getEntryContent(entryId)

    expect(content.entryId).toBe(entryId)
    expect(content.title).toBe('Readable Title')
    expect(content.html).toContain('<h1>Readable Title</h1>')
    expect(content.html).toContain('This is the first paragraph worth reading.')
    expect(content.html).not.toContain('<script')
    expect(content.markdown).toContain('# Readable Title')
    expect(content.markdown).toContain('[Useful reference](https://example.com/ref)')
    expect(content.fetchedAt).toBeTruthy()
    expect(cached.markdown).toBe(content.markdown)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  }, 20_000)
})
