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
  summary: string | null
  content_html: string | null
  content_md: string | null
  content_fetched_at: string | null
}

function hasImgDescendant(node: Node): boolean {
  if (node.nodeName === 'IMG') return true
  for (const child of node.childNodes) {
    if (hasImgDescendant(child)) return true
  }
  return false
}

function findFirstImg(node: Node): HTMLImageElement | null {
  if (node.nodeName === 'IMG') return node as HTMLImageElement
  for (const child of node.childNodes) {
    const found = findFirstImg(child)
    if (found) return found
  }
  return null
}

function textContentExcludingImageAlt(node: Node): string {
  let text = ''
  for (const child of node.childNodes) {
    if (child.nodeName === 'IMG') continue
    if (child.nodeType === 3) {
      text += child.textContent || ''
    } else {
      text += textContentExcludingImageAlt(child)
    }
  }
  return text
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
})

turndown.addRule('imageLink', {
  filter: (node) => {
    if (node.nodeName !== 'A') return false
    if (!hasImgDescendant(node)) return false
    const visibleText = textContentExcludingImageAlt(node)
    return visibleText.trim() === ''
  },
  replacement: (_content, node) => {
    const anchor = node as HTMLAnchorElement
    const img = findFirstImg(anchor)
    if (!img) return ''
    const href = anchor.getAttribute('href') || ''
    const src = img.getAttribute('src') || ''
    const alt = img.getAttribute('alt') || ''
    return `[![${alt}](${src})](${href})`
  }
})

const BLOCK_LINK_TAGS = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']

turndown.addRule('blockLink', {
  filter: (node) => {
    if (node.nodeName !== 'A') return false
    if (hasImgDescendant(node)) return false
    const elementChildren = Array.from(node.childNodes).filter(
      (child) => child.nodeType === 1
    )
    return (
      elementChildren.length === 1 &&
      BLOCK_LINK_TAGS.includes(elementChildren[0].nodeName)
    )
  },
  replacement: (content, node) => {
    const anchor = node as HTMLAnchorElement
    const href = anchor.getAttribute('href') || ''
    const child = anchor.firstElementChild
    if (!child) return content
    const trimmed = content.trim()
    const headingMatch = child.nodeName.match(/^H([1-6])$/)
    if (headingMatch) {
      const prefix = '#'.repeat(Number(headingMatch[1])) + ' '
      const text = trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed
      return `\n\n${prefix}[${text}](${href})\n\n`
    }
    return `\n\n[${trimmed}](${href})\n\n`
  }
})

turndown.addRule('digestPostEmbed', {
  filter: (node) => {
    return (
      node.nodeName === 'DIV' &&
      node.getAttribute('data-component-name') === 'DigestPostEmbed'
    )
  },
  replacement: (content) => {
    const trimmed = content.trim()
    if (!trimmed) return ''
    return `\n\n---\n\n${trimmed}\n\n---\n\n`
  }
})

import { nowIso } from './utils.js'

function ensureOkResponse(response: Response, url: string): void {
  if (!response.ok) {
    throw new Error(`Failed to fetch article (${response.status}): ${url}`)
  }
}

function fetchFailureReason(error: unknown): string {
  if (error instanceof Error) {
    const match = error.message.match(/\((\d{3})\)/)
    if (match) {
      return `Article fetch failed (${match[1]}).`
    }
    return `Article fetch failed: ${error.message}`
  }
  return `Article fetch failed: ${String(error)}`
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

function buildFallbackHtml(entry: EntryContentRow, reason: string): string {
  const summary = entry.summary?.trim() || 'No RSS summary is available for this article.'
  return sanitizeHtml(`
    <article>
      <h1>${entry.title}</h1>
      <p><strong>${reason}</strong></p>
      <p>${summary}</p>
      <p><a href="${entry.url}">Open original article</a></p>
    </article>
  `, entry.url)
}

function normalizeDigestEmbeds(html: string, baseUrl: string): string {
  const dom = new JSDOM(html, { url: baseUrl })
  const embeds = dom.window.document.querySelectorAll(
    '[data-component-name="DigestPostEmbed"]'
  )

  for (const embed of embeds) {
    const titleLink = embed.querySelector('a > h2')?.parentElement as HTMLAnchorElement | null
    if (!titleLink) continue

    const url = titleLink.getAttribute('href') || ''
    const titleHeading = titleLink.querySelector('h2')
    if (!titleHeading) continue

    const plainHeading = dom.window.document.createElement('h2')
    plainHeading.innerHTML = titleHeading.innerHTML
    titleLink.replaceWith(plainHeading)

    for (const p of embed.querySelectorAll('p')) {
      if ((p.textContent || '').trim() === '·') {
        p.remove()
      }
    }

    const readMore = dom.window.document.createElement('p')
    readMore.innerHTML = `<a href="${url}">Read full story →</a>`
    embed.appendChild(readMore)
  }

  const normalized = dom.window.document.body.innerHTML
  dom.window.close()
  return normalized
}

function contentFromHtml(entry: EntryContentRow, html: string, title: string, fetchedAt: string): EntryContent {
  const normalized = normalizeDigestEmbeds(html, entry.url)
  return {
    entryId: entry.id,
    title,
    url: entry.url,
    html: normalized,
    markdown: turndown.turndown(normalized).trim(),
    fetchedAt
  }
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

    let content: EntryContent
    const fetchedAt = nowIso()
    try {
      const response = await fetch(entry.url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'Upgrade-Insecure-Requests': '1',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) VibeReader/0.1 Safari/537.36'
        }
      })
      ensureOkResponse(response, entry.url)

      const rawHtml = await response.text()
      const readable = extractReadableContent(rawHtml, entry.url, entry.title)
      const html = sanitizeHtml(promotePrimaryHeading(readable.html, entry.url, readable.title), entry.url)
      content = contentFromHtml(entry, html, readable.title, fetchedAt)
    } catch (error) {
      const html = buildFallbackHtml(entry, fetchFailureReason(error))
      content = contentFromHtml(entry, html, entry.title, fetchedAt)
    }

    this.db.prepare(`
      UPDATE entries
      SET content_html = ?, content_md = ?, content_fetched_at = ?, updated_at = ?
      WHERE id = ?
    `).run(content.html, content.markdown, fetchedAt, fetchedAt, entry.id)

    return content
  }

  private getEntryRow(entryId: number): EntryContentRow | undefined {
    return this.db.prepare(`
      SELECT id, url, title, summary, content_html, content_md, content_fetched_at
      FROM entries
      WHERE id = ?
    `).get(entryId) as EntryContentRow | undefined
  }
}
