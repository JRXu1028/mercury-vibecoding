// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { renderMarkdownToHtml } from '../frontend/src/utils/readerMarkdown'

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
