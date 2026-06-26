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

  it('converts image links to single-line markdown', async () => {
    const entryId = await seedEntry()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `<!doctype html>
        <html>
          <head><title>Image Link Test</title></head>
          <body>
            <article>
              <h1>Image Link Test</h1>
              <a href="https://example.com/link">
                <div>
                  <picture>
                    <source srcset="image.webp">
                    <img src="https://example.com/image.jpeg" alt="Alt text">
                  </picture>
                </div>
              </a>
              <p>See <a href="https://example.com/ref">this reference</a> for more.</p>
            </article>
          </body>
        </html>`
    } as Response)

    const content = await contentService.getEntryContent(entryId)

    expect(content.markdown).toContain('[![Alt text](https://example.com/image.jpeg)](https://example.com/link)')
    expect(content.markdown).toContain('[this reference](https://example.com/ref)')
  }, 20_000)

  it('converts block-level text links to inline markdown', async () => {
    const entryId = await seedEntry()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `<!doctype html>
        <html>
          <head><title>Block Link Test</title></head>
          <body>
            <article>
              <h1>Block Link Test</h1>
              <p>This is the main article content with enough text to make Readability keep the page.</p>
              <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
              <h2>Related articles</h2>
              <a href="https://example.com/post1" rel="noopener"><p>Essays</p></a>
              <a href="https://example.com/post1" rel="noopener"><h2>Cassius Marcellus Clay brought cannons to a free press fight</h2></a>
              <a href="https://example.com/post2" rel="noopener"><p>Tech</p></a>
              <a href="https://example.com/post2" rel="noopener"><h2>How does the <em>First Amendment</em> apply to AI?</h2></a>
              <p>More body text here to ensure the article is considered valid content.</p>
            </article>
          </body>
        </html>`
    } as Response)

    const content = await contentService.getEntryContent(entryId)

    expect(content.markdown).toContain('[Essays](https://example.com/post1)')
    expect(content.markdown).toContain('## [Cassius Marcellus Clay brought cannons to a free press fight](https://example.com/post1)')
    expect(content.markdown).toContain('[Tech](https://example.com/post2)')
    expect(content.markdown).toContain('## [How does the _First Amendment_ apply to AI?](https://example.com/post2)')
  }, 20_000)

  it('wraps DigestPostEmbed essay cards with horizontal rules', async () => {
    const entryId = await seedEntry()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `<!doctype html>
        <html>
          <head><title>Digest Embed Test</title></head>
          <body>
            <article>
              <h1>Digest Embed Test</h1>
              <p>Article body before the related essay card.</p>
              <div data-component-name="DigestPostEmbed">
                <a href="https://example.com/post" rel="noopener"><p>Essays</p></a>
                <a href="https://example.com/post" rel="noopener"><h2>Cassius Marcellus Clay brought cannons to a free press fight</h2></a>
                <div><p>·</p><p>Jun 25</p></div>
                <div><p>Excerpt text for the essay card.</p></div>
              </div>
              <p>Article body after the related essay card.</p>
            </article>
          </body>
        </html>`
    } as Response)

    const content = await contentService.getEntryContent(entryId)

    expect(content.markdown).toContain('[Essays](https://example.com/post)')
    expect(content.markdown).toContain('## Cassius Marcellus Clay brought cannons to a free press fight')
    expect(content.markdown).not.toContain('## [Cassius Marcellus Clay brought cannons to a free press fight]')
    expect(content.markdown).toContain('Jun 25')
    expect(content.markdown).not.toContain('·')
    expect(content.markdown).toContain('[Read full story →](https://example.com/post)')
    expect(content.markdown).toContain('Excerpt text for the essay card.')
  }, 20_000)

  it('falls back to RSS summary when the article page blocks fetching', async () => {
    const entryId = await seedEntry()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden'
    } as Response)

    const content = await contentService.getEntryContent(entryId)
    const cached = await contentService.getEntryContent(entryId)

    expect(content.title).toBe('Clean Me')
    expect(content.html).toContain('Article fetch failed')
    expect(content.html).toContain('Summary from RSS')
    expect(content.markdown).toContain('# Clean Me')
    expect(content.markdown).toContain('Article fetch failed (403)')
    expect(content.markdown).toContain('Summary from RSS')
    expect(cached.markdown).toBe(content.markdown)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
