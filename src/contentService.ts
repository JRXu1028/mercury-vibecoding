import type { DatabaseSync } from 'node:sqlite'
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'
import { AppDatabase } from './database.js'
import type { EntryContent } from './models.js'

interface EntryContentRow {
  id: number
  url: string
  title: string
  content_html: string | null
  content_md: string | null
  content_fetched_at: string | null
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
})

function nowIso(): string {
  return new Date().toISOString()
}

function ensureOkResponse(response: Response, url: string): void {
  if (!response.ok) {
    throw new Error(`Failed to fetch article (${response.status}): ${url}`)
  }
}

function sanitizeHtml(html: string, baseUrl: string): string {
  const window = new JSDOM('', { url: baseUrl }).window
  const purifier = createDOMPurify(window)
  const sanitized = purifier.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick']
  })
  window.close()
  return sanitized
}

function extractReadableContent(rawHtml: string, url: string, fallbackTitle: string): { title: string; html: string } {
  const dom = new JSDOM(rawHtml, { url })
  const article = new Readability(dom.window.document).parse()
  const html = article?.content?.trim() || dom.window.document.body.innerHTML || fallbackTitle
  const contentDom = new JSDOM(html, { url })
  const heading =
    contentDom.window.document.querySelector('h1')?.textContent?.trim() ||
    dom.window.document.querySelector('article h1, main h1, h1')?.textContent?.trim()
  contentDom.window.close()
  const title = heading || article?.title?.trim() || fallbackTitle
  dom.window.close()
  return { title, html }
}

function promotePrimaryHeading(html: string, url: string, title: string): string {
  const dom = new JSDOM(html, { url })
  const heading = dom.window.document.querySelector('h1, h2, h3')
  if (heading && heading.tagName !== 'H1' && heading.textContent?.trim() === title) {
    const h1 = dom.window.document.createElement('h1')
    h1.innerHTML = heading.innerHTML
    heading.replaceWith(h1)
  }
  const normalized = dom.window.document.body.innerHTML
  dom.window.close()
  return normalized
}

export class ContentService {
  private readonly db: DatabaseSync

  constructor(database: AppDatabase) {
    this.db = database.connection
  }

  async getEntryContent(entryId: number, options?: { forceRefresh?: boolean }): Promise<EntryContent> {
    const entry = this.getEntryRow(entryId)
    if (!entry) {
      throw new Error(`Entry not found: ${entryId}`)
    }

    if (!options?.forceRefresh && entry.content_html && entry.content_md && entry.content_fetched_at) {
      return {
        entryId: entry.id,
        title: entry.title,
        url: entry.url,
        html: entry.content_html,
        markdown: entry.content_md,
        fetchedAt: entry.content_fetched_at
      }
    }

    const response = await fetch(entry.url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mercury Vibecoding/0.1 RSS Reader'
      }
    })
    ensureOkResponse(response, entry.url)

    const rawHtml = await response.text()
    const readable = extractReadableContent(rawHtml, entry.url, entry.title)
    const html = sanitizeHtml(promotePrimaryHeading(readable.html, entry.url, readable.title), entry.url)
    const markdown = turndown.turndown(html).trim()
    const fetchedAt = nowIso()

    this.db.prepare(`
      UPDATE entries
      SET content_html = ?, content_md = ?, content_fetched_at = ?, updated_at = ?
      WHERE id = ?
    `).run(html, markdown, fetchedAt, fetchedAt, entry.id)

    return {
      entryId: entry.id,
      title: readable.title,
      url: entry.url,
      html,
      markdown,
      fetchedAt
    }
  }

  private getEntryRow(entryId: number): EntryContentRow | undefined {
    return this.db.prepare(`
      SELECT id, url, title, content_html, content_md, content_fetched_at
      FROM entries
      WHERE id = ?
    `).get(entryId) as EntryContentRow | undefined
  }
}
