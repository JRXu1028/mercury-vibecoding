// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { renderMarkdownToHtml, simpleMarkdownToHtml } from '../frontend/src/utils/readerMarkdown'

describe('reader Markdown rendering', () => {
  it('renders Markdown to sanitized HTML for the reader view', () => {
    const html = renderMarkdownToHtml(`# Title

![Alt](https://example.com/image.png)

\`\`\`ts
const ok = true
\`\`\`

[Read more](https://example.com/post)

<script>alert('bad')</script>`)

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<img')
    expect(html).toContain('src="https://example.com/image.png"')
    expect(html).toContain('<code')
    expect(html).toContain('<a href="https://example.com/post"')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert')
  })
})

describe('simpleMarkdownToHtml translation view', () => {
  it('converts headings, lists and paragraphs', () => {
    const html = simpleMarkdownToHtml(`# Title

A paragraph with **bold** and *italic*.

- item one
- item two`)

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>item one</li>')
  })

  it('normalizes CRLF line endings', () => {
    const html = simpleMarkdownToHtml('line one\r\nline two')
    expect(html).not.toContain('\r')
    expect(html).toContain('<br>')
  })

  it('renders image wrapped in a link with LF line breaks', () => {
    const html = simpleMarkdownToHtml(`[
![Alt](https://example.com/image.png)
](https://example.com/link)`)

    expect(html).toContain('<a href="https://example.com/link"')
    expect(html).toContain('<img src="https://example.com/image.png"')
    expect(html).not.toContain('<br>')
  })

  it('renders image wrapped in a link with CRLF line breaks', () => {
    const html = simpleMarkdownToHtml(`[\r\n![Alt](https://example.com/image.png)\r\n](https://example.com/link)`)

    expect(html).toContain('<a href="https://example.com/link"')
    expect(html).toContain('<img src="https://example.com/image.png"')
    expect(html).not.toContain('\r')
    expect(html).not.toContain('<br>')
  })

  it('renders image wrapped in a link without line breaks', () => {
    const html = simpleMarkdownToHtml('[![Alt](https://example.com/image.png)](https://example.com/link)')

    expect(html).toContain('<a href="https://example.com/link"')
    expect(html).toContain('<img src="https://example.com/image.png"')
  })

  it('does not auto-link URLs inside generated Markdown link attributes', () => {
    const html = simpleMarkdownToHtml('德国物理学家[马克斯·普朗克](https://en.wikipedia.org/wiki/Max_Planck)发现了[量子](https://en.wikipedia.org/wiki/Quantum)。')

    expect(html).toContain('<a href="https://en.wikipedia.org/wiki/Max_Planck"')
    expect(html).toContain('>马克斯·普朗克</a>')
    expect(html).toContain('<a href="https://en.wikipedia.org/wiki/Quantum"')
    expect(html).not.toContain('target=&quot;_blank&quot;')
    expect(html).not.toContain('rel=&quot;noreferrer&quot;')
  })

  it('preserves titles on image links', () => {
    const html = simpleMarkdownToHtml(`[
![Alt](https://example.com/image.png "Image title")
](https://example.com/link "Link title")`)

    expect(html).toContain('title="Link title"')
    expect(html).toContain('title="Image title"')
  })

  it('does not convert image link syntax inside fenced code blocks', () => {
    const html = simpleMarkdownToHtml(`\`\`\`md
[
![Alt](https://example.com/image.png)
](https://example.com/link)
\`\`\``)

    expect(html).toContain('<pre><code')
    expect(html).not.toContain('<a href="https://example.com/link"')
    expect(html).not.toContain('<img src="https://example.com/image.png"')
  })
})
