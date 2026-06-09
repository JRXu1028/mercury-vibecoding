import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({
  async: false,
  breaks: true,
  gfm: true
})

export function renderMarkdownToHtml(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false }) as string
  return DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel']
  })
}
