import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppDatabase } from '../src/database.js'
import { FeedService } from '../src/feedService.js'
import { OPMLService } from '../src/opmlService.js'
import type { ParsedFeed } from '../src/models.js'

const parseFeedMock = vi.fn<[], Promise<ParsedFeed>>()

vi.mock('../src/feedParser.js', () => ({
  parseFeed: (url: string) => parseFeedMock(url)
}))

describe('Team A feed flow', () => {
  let tmpDir = ''
  let database: AppDatabase
  let feedService: FeedService

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mercury-vibecoding-'))
    database = new AppDatabase({ path: path.join(tmpDir, 'test.db') })
    feedService = new FeedService(database)
    parseFeedMock.mockReset()
  })

  afterEach(async () => {
    database.close()
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('adds feed and stores entries', async () => {
    parseFeedMock.mockResolvedValue({
      title: 'Example Feed',
      feedUrl: 'https://example.com/feed.xml',
      siteUrl: 'https://example.com',
      description: 'Test feed',
      entries: [
        {
          guid: 'entry-1',
          url: 'https://example.com/posts/1',
          title: 'Post 1',
          author: 'Alice',
          summary: 'Summary 1',
          publishedAt: '2026-05-26T00:00:00.000Z'
        },
        {
          guid: 'entry-2',
          url: 'https://example.com/posts/2',
          title: 'Post 2',
          author: 'Bob',
          summary: 'Summary 2',
          publishedAt: '2026-05-25T00:00:00.000Z'
        }
      ]
    })

    const result = await feedService.addFeed('https://example.com/feed.xml')

    expect(result.newEntryCount).toBe(2)
    expect(feedService.listFeeds()).toHaveLength(1)
    expect(feedService.listEntries({ feedId: result.feed.id }).map((entry) => entry.guid)).toEqual(['entry-1', 'entry-2'])
  })

  it('syncs feed incrementally', async () => {
    parseFeedMock
      .mockResolvedValueOnce({
        title: 'Example Feed',
        feedUrl: 'https://example.com/feed.xml',
        siteUrl: 'https://example.com',
        description: 'Test feed',
        entries: [
          {
            guid: 'entry-1',
            url: 'https://example.com/posts/1',
            title: 'Post 1',
            author: null,
            summary: null,
            publishedAt: '2026-05-26T00:00:00.000Z'
          }
        ]
      })
      .mockResolvedValueOnce({
        title: 'Example Feed Updated',
        feedUrl: 'https://example.com/feed.xml',
        siteUrl: 'https://example.com',
        description: 'Updated',
        entries: [
          {
            guid: 'entry-1',
            url: 'https://example.com/posts/1',
            title: 'Post 1 Updated',
            author: null,
            summary: null,
            publishedAt: '2026-05-26T00:00:00.000Z'
          },
          {
            guid: 'entry-2',
            url: 'https://example.com/posts/2',
            title: 'Post 2',
            author: null,
            summary: null,
            publishedAt: '2026-05-27T00:00:00.000Z'
          }
        ]
      })

    const added = await feedService.addFeed('https://example.com/feed.xml')
    const synced = await feedService.syncFeed(added.feed.id)

    expect(synced.newEntryCount).toBe(1)
    const entries = feedService.listEntries({ feedId: added.feed.id })
    expect(entries).toHaveLength(2)
    expect(entries.find((entry) => entry.guid === 'entry-1')?.title).toBe('Post 1 Updated')
  })

  it('imports and exports OPML', async () => {
    parseFeedMock.mockImplementation(async (url: string) => ({
      title: `Feed: ${url}`,
      feedUrl: url,
      siteUrl: url.replace('/feed.xml', ''),
      description: null,
      entries: []
    }))

    const opmlService = new OPMLService(feedService)
    const result = await opmlService.importFromString(`<?xml version="1.0" encoding="UTF-8"?>
      <opml version="2.0">
        <body>
          <outline text="A" xmlUrl="https://a.com/feed.xml" />
          <outline text="B" xmlUrl="https://b.com/feed.xml" />
          <outline text="A-dup" xmlUrl="https://a.com/feed.xml" />
        </body>
      </opml>`)

    expect(result.imported).toBe(2)
    expect(result.failed).toHaveLength(0)

    const opmlText = opmlService.exportToString(feedService.listFeeds())
    expect(opmlText).toContain('https://a.com/feed.xml')
    expect(opmlText).toContain('https://b.com/feed.xml')
  })
})
