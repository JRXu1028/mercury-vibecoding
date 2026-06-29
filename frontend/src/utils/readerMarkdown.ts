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

/** Escape HTML special characters. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Process inline markdown: bold, italic, strikethrough, inline code,
 *  markdown links, images, and bare URLs. */
function processInline(text: string): string {
  let t = text
  const inlineHtml: string[] = []
  const stashInlineHtml = (html: string): string => {
    const index = inlineHtml.length
    inlineHtml.push(html)
    return `\x00INLINEHTML${index}\x00`
  }

  // Images ![alt](url) — must go before links
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, alt, url, title) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return stashInlineHtml(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${titleAttr}>`)
    })

  // Links [text](url "title")
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, label, url, title) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return stashInlineHtml(`<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"${titleAttr}>${label}</a>`)
    })

  // Bold **text** or __text__
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  // Italic *text* or _text_ (but not inside words for _)
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  t = t.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>')

  // Strikethrough ~~text~~
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>')

  // Inline code `text`
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Bare URLs (that aren't already inside an HTML tag attribute)
  t = t.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noreferrer">$1</a>'
  )

  return t.replace(/\x00INLINEHTML(\d+)\x00/g, (_m, idx) => inlineHtml[Number(idx)])
}

/**
 * Convert Markdown text into HTML for the bilingual translation view.
 * Handles: headings, bold, italic, inline code, fenced code blocks,
 * links, images, lists, blockquotes, horizontal rules, paragraphs, and line breaks.
 */
export function simpleMarkdownToHtml(text: string): string {
  // Normalize line endings so CRLF / lone CR do not break inline regexes
  // or leave stray control characters in the emitted HTML.
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // ---- phase 0: protect fenced code blocks ----
  const codeBlocks: string[] = []
  let phase0 = normalized.replace(/```(\S*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : ''
    codeBlocks.push(`<pre><code${langAttr}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`)
    return `\x00CODEBLOCK${idx}\x00`
  })

  // ---- phase 0.5: protect image links (image wrapped in a link, possibly multi-line) ----
  // Example:
  //   [
  //   ![alt](img-url)
  //   ](link-url)
  const imageLinks: string[] = []
  phase0 = phase0.replace(
    /\[\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, alt, imgUrl, imgTitle, linkUrl, linkTitle) => {
      const idx = imageLinks.length
      const imgTitleAttr = imgTitle ? ` title="${escapeHtml(imgTitle)}"` : ''
      const linkTitleAttr = linkTitle ? ` title="${escapeHtml(linkTitle)}"` : ''
      imageLinks.push(
        `<a href="${escapeHtml(linkUrl)}" target="_blank" rel="noreferrer"${linkTitleAttr}>` +
          `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(alt)}"${imgTitleAttr}></a>`
      )
      return `\x00IMGLINK${idx}\x00`
    }
  )

  // ---- phase 1: escape HTML in non-code parts ----
  const escaped = escapeHtml(phase0)

  // ---- phase 2: restore code blocks ----
  let phase2 = escaped.replace(/\x00CODEBLOCK(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)])

  // ---- phase 3: block-level elements ----

  // Horizontal rules
  phase2 = phase2.replace(/^(\s*[-*_]){3,}\s*$/gm, '<hr>')

  // Headings (must be at line start)
  phase2 = phase2.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
  phase2 = phase2.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
  phase2 = phase2.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
  phase2 = phase2.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
  phase2 = phase2.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
  phase2 = phase2.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')

  // Blockquotes — collect consecutive > lines
  phase2 = phase2.replace(/((?:^&gt;.+(:?\n|$))+)/gm, (block: string) => {
    const inner = block
      .split(/\n/)
      .map((l) => l.replace(/^&gt;\s?/, ''))
      .join('\n')
    return `<blockquote>${inner}</blockquote>`
  })

  // Unordered lists — collect consecutive - /* items
  phase2 = phase2.replace(/((?:^[-*]\s+.+(:?\n|$))+)/gm, (block: string) => {
    const items = block
      .split(/\n/)
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => `<li>${l.replace(/^[-*]\s+/, '')}</li>`)
      .join('')
    return `<ul>${items}</ul>`
  })

  // Ordered lists — collect consecutive 1. 2. items
  phase2 = phase2.replace(/((?:^\d+\.\s+.+(:?\n|$))+)/gm, (block: string) => {
    const items = block
      .split(/\n/)
      .filter((l) => /^\d+\.\s+/.test(l))
      .map((l) => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`)
      .join('')
    return `<ol>${items}</ol>`
  })

  // ---- phase 4: split into paragraphs (double newline) ----
  const paragraphs = phase2.split(/\n\s*\n/)

  const result = paragraphs.map((p) => {
    const trimmed = p.trim()
    if (!trimmed) return ''

    // Skip wrapping if already a block element
    if (/^<pre/.test(trimmed)) {
      return trimmed
    }
    if (/^<(h[1-6]|ul|ol|blockquote|hr|li)/.test(trimmed)) {
      return processInline(trimmed)
    }

    // Convert single newlines to <br>, then process inline
    const withBreaks = trimmed.split(/\n/).join('<br>')
    return `<p>${processInline(withBreaks)}</p>`
  })

  return result
    .filter(Boolean)
    .join('\n')
    .replace(/\x00IMGLINK(\d+)\x00/g, (_m, idx) => imageLinks[Number(idx)])
}
