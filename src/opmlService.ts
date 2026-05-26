import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import type { Feed } from './models.js'
import { FeedService } from './feedService.js'

interface OPMLImportResult {
  imported: number
  failed: Array<{ url: string; reason: string }>
}

function extractFeedUrls(node: unknown, bucket: string[]): void {
  if (!node || typeof node !== 'object') {
    return
  }

  const outline = node as Record<string, unknown>
  const xmlUrl = outline['@_xmlUrl']
  if (typeof xmlUrl === 'string' && xmlUrl.trim().length > 0) {
    bucket.push(xmlUrl.trim())
  }

  const children = outline.outline
  if (Array.isArray(children)) {
    children.forEach((child) => extractFeedUrls(child, bucket))
    return
  }
  if (children) {
    extractFeedUrls(children, bucket)
  }
}

export class OPMLService {
  constructor(private readonly feedService: FeedService) {}

  async importFromString(opmlText: string): Promise<OPMLImportResult> {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    })

    const parsed = parser.parse(opmlText) as {
      opml?: {
        body?: {
          outline?: unknown
        }
      }
    }

    const outlineRoot = parsed.opml?.body?.outline
    const urls: string[] = []

    if (Array.isArray(outlineRoot)) {
      outlineRoot.forEach((node) => extractFeedUrls(node, urls))
    } else {
      extractFeedUrls(outlineRoot, urls)
    }

    const uniqueUrls = Array.from(new Set(urls))
    let imported = 0
    const failed: Array<{ url: string; reason: string }> = []

    for (const url of uniqueUrls) {
      try {
        await this.feedService.addFeed(url)
        imported += 1
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error'
        failed.push({ url, reason })
      }
    }

    return { imported, failed }
  }

  exportToString(feeds: Feed[]): string {
    const outlines = feeds.map((feed) => ({
      '@_text': feed.title,
      '@_title': feed.title,
      '@_type': 'rss',
      '@_xmlUrl': feed.url,
      '@_htmlUrl': feed.siteUrl || ''
    }))

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      suppressEmptyNode: true
    })

    return builder.build({
      '?xml': {
        '@_version': '1.0',
        '@_encoding': 'UTF-8'
      },
      opml: {
        '@_version': '2.0',
        head: {
          title: 'Mercury Vibecoding Feeds'
        },
        body: {
          outline: outlines
        }
      }
    })
  }
}
