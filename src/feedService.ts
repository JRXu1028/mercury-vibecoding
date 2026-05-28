import type { DatabaseSync } from 'node:sqlite'
import { AppDatabase } from './database.js'
import { parseFeed } from './feedParser.js'
import type { Entry, Feed, ParsedFeed } from './models.js'

interface FeedRow {
  id: number
  title: string
  url: string
  site_url: string | null
  description: string | null
  created_at: string
  updated_at: string
  last_synced_at: string | null
}

interface EntryRow {
  id: number
  feed_id: number
  guid: string
  url: string
  title: string
  author: string | null
  summary: string | null
  content_html: string | null
  content_md: string | null
  content_fetched_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function toFeed(row: FeedRow): Feed {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    siteUrl: row.site_url,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at
  }
}

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    feedId: row.feed_id,
    guid: row.guid,
    url: row.url,
    title: row.title,
    author: row.author,
    summary: row.summary,
    contentHtml: row.content_html,
    contentMd: row.content_md,
    contentFetchedAt: row.content_fetched_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function asFeedRows(rows: unknown): FeedRow[] {
  return rows as FeedRow[]
}

function asEntryRows(rows: unknown): EntryRow[] {
  return rows as EntryRow[]
}

function asFeedRow(row: unknown): FeedRow {
  return row as FeedRow
}

export class FeedService {
  private readonly db: DatabaseSync

  constructor(database: AppDatabase) {
    this.db = database.connection
  }

  listFeeds(): Feed[] {
    const rows = this.db.prepare(`
      SELECT id, title, url, site_url, description, created_at, updated_at, last_synced_at
      FROM feeds
      ORDER BY created_at ASC
    `).all()

    return asFeedRows(rows).map(toFeed)
  }

  removeFeed(feedId: number): void {
    this.db.prepare('DELETE FROM feeds WHERE id = ?').run(feedId)
  }

  listEntries(options?: { feedId?: number; query?: string }): Entry[] {
    const conditions: string[] = []
    const params: Array<string | number> = []

    if (options?.feedId !== undefined) {
      conditions.push('feed_id = ?')
      params.push(options.feedId)
    }
    if (options?.query && options.query.trim().length > 0) {
      conditions.push('(title LIKE ? OR summary LIKE ?)')
      const like = `%${options.query.trim()}%`
      params.push(like, like)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = this.db.prepare(`
      SELECT id, feed_id, guid, url, title, author, summary, content_html, content_md, content_fetched_at, published_at, created_at, updated_at
      FROM entries
      ${where}
      ORDER BY COALESCE(published_at, created_at) DESC
    `).all(...params)

    return asEntryRows(rows).map(toEntry)
  }

  async addFeed(feedUrl: string): Promise<{ feed: Feed; newEntryCount: number }> {
    const parsed = await parseFeed(feedUrl)
    return this.upsertFeedAndEntries(parsed)
  }

  async syncFeed(feedId: number): Promise<{ feed: Feed; newEntryCount: number }> {
    const feedRow = this.db.prepare('SELECT id, url FROM feeds WHERE id = ?').get(feedId) as { id: number; url: string } | undefined
    if (!feedRow) {
      throw new Error(`Feed not found: ${feedId}`)
    }
    const parsed = await parseFeed(feedRow.url)
    return this.upsertFeedAndEntries(parsed, feedId)
  }

  async syncAllFeeds(): Promise<Array<{ feedId: number; newEntryCount: number }>> {
    const feeds = this.db.prepare('SELECT id FROM feeds ORDER BY id ASC').all() as Array<{ id: number }>
    const results: Array<{ feedId: number; newEntryCount: number }> = []

    for (const feed of feeds) {
      const synced = await this.syncFeed(feed.id)
      results.push({
        feedId: synced.feed.id,
        newEntryCount: synced.newEntryCount
      })
    }

    return results
  }

  private upsertFeedAndEntries(parsed: ParsedFeed, existingFeedId?: number): { feed: Feed; newEntryCount: number } {
    const timestamp = nowIso()

    this.db.exec('BEGIN')
    try {
      let feedId = existingFeedId

      if (feedId === undefined) {
        this.db.prepare(`
          INSERT INTO feeds (title, url, site_url, description, created_at, updated_at, last_synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(url) DO UPDATE SET
            title = excluded.title,
            site_url = excluded.site_url,
            description = excluded.description,
            updated_at = excluded.updated_at,
            last_synced_at = excluded.last_synced_at
        `).run(
          parsed.title,
          parsed.feedUrl,
          parsed.siteUrl,
          parsed.description,
          timestamp,
          timestamp,
          timestamp
        )

        const inserted = this.db.prepare('SELECT id FROM feeds WHERE url = ?').get(parsed.feedUrl) as { id: number }
        feedId = inserted.id
      } else {
        this.db.prepare(`
          UPDATE feeds
          SET title = ?, site_url = ?, description = ?, updated_at = ?, last_synced_at = ?
          WHERE id = ?
        `).run(parsed.title, parsed.siteUrl, parsed.description, timestamp, timestamp, feedId)
      }

      let newEntryCount = 0
      const insertEntry = this.db.prepare(`
        INSERT INTO entries (feed_id, guid, url, title, author, summary, published_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(feed_id, guid) DO UPDATE SET
          url = excluded.url,
          title = excluded.title,
          author = excluded.author,
          summary = excluded.summary,
          published_at = excluded.published_at,
          updated_at = excluded.updated_at
      `)
      const hasEntry = this.db.prepare('SELECT 1 FROM entries WHERE feed_id = ? AND guid = ? LIMIT 1')

      for (const entry of parsed.entries) {
        const existed = Boolean(hasEntry.get(feedId, entry.guid))
        insertEntry.run(
          feedId,
          entry.guid,
          entry.url,
          entry.title,
          entry.author,
          entry.summary,
          entry.publishedAt,
          timestamp,
          timestamp
        )
        if (!existed) {
          newEntryCount += 1
        }
      }

      const feedRow = this.db.prepare(`
        SELECT id, title, url, site_url, description, created_at, updated_at, last_synced_at
        FROM feeds
        WHERE id = ?
      `).get(feedId)

      this.db.exec('COMMIT')

      return {
        feed: toFeed(asFeedRow(feedRow)),
        newEntryCount
      }
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
}
