import Parser from 'rss-parser'
import type { ParsedEntry, ParsedFeed } from './models.js'

const parser = new Parser<Record<string, unknown>, Record<string, unknown>>()

function toIsoDate(value: string | undefined): string | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

export async function parseFeed(feedUrl: string): Promise<ParsedFeed> {
  const raw = await parser.parseURL(feedUrl)
  const title = normalizeString(raw.title, feedUrl)
  const siteUrl = normalizeString(raw.link || raw.feedUrl, '') || null
  const description = normalizeString(raw.description, '') || null

  const entries: ParsedEntry[] = (raw.items || []).map((item, index) => {
    const guid = normalizeString(item.guid || item.id || item.link, `generated-${index}`)
    const url = normalizeString(item.link, feedUrl)
    const itemTitle = normalizeString(item.title, url)

    return {
      guid,
      url,
      title: itemTitle,
      author: normalizeString(item.creator || item.author, '') || null,
      summary: normalizeString(item.contentSnippet || item.summary || item.content, '') || null,
      publishedAt: toIsoDate(item.isoDate || item.pubDate)
    }
  })

  return {
    title,
    feedUrl,
    siteUrl,
    description,
    entries
  }
}
