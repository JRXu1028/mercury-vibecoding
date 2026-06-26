# Team B Implementation (Content Cleaning & Reader)

## Scope

This implementation covers the Team B responsibilities from `mercury-vibecoding/README.md`:

- Article HTML fetching
- Main content extraction
- Cleaned HTML generation
- Markdown conversion and caching
- Reader detail view
- Reader theme, font size, line height, and Markdown preview controls
- Reader Markdown-first rendering
- In-app link opening with browser-style navigation
- Blocked article fetch fallback behavior

## Architecture

- Runtime: Node.js + TypeScript
- Storage: SQLite (`node:sqlite`)
- Article extraction: `@mozilla/readability` + `jsdom`
- HTML cleaning: `DOMPurify`
- Markdown conversion: `turndown`
- Reader UI: Vue 3 + Element Plus
- In-app browser: Electron `<webview>` embedded in the reader UI

## Data Model

Team B extends the existing `entries` table with content cache fields:

- `content_html`
- `content_md`
- `content_fetched_at`

The cleaned article body is fetched lazily when an entry is opened. If cached content already exists, the reader reuses it unless the user refreshes the content.

## Backend Flow

The Team B content service performs this pipeline:

1. Load the selected entry by `entryId`.
2. Fetch the original article URL.
3. Parse the article HTML with `jsdom`.
4. Extract readable content with `Readability`.
5. Clean the extracted HTML with `DOMPurify`.
6. Convert cleaned HTML to Markdown with `turndown`.
7. Cache both cleaned HTML and Markdown in SQLite.
8. Return the cleaned content to the renderer.

The reader view renders from the cached Markdown instead of directly displaying cleaned HTML. This keeps the display path aligned with the Markdown cache used by AI summary and translation flows.

If the original article page blocks server-side fetching, for example with HTTP `403`, the content service no longer throws an error to the renderer. It builds a fallback article from:

- the RSS entry title
- the fetch failure reason
- the RSS summary
- the original article link

The fallback is sanitized, converted to Markdown, cached, and returned through the same `EntryContent` shape.

Main backend entry points:

- Electron IPC: `entry:content`
- Demo HTTP API: `GET /api/entries/:entryId/content`
- Force refresh: `GET /api/entries/:entryId/content?refresh=1`

Main implementation files:

- `src/contentService.ts`
- `src/electronMain.ts`
- `src/demoServer.ts`
- `frontend/src/api/client.ts`
- `frontend/src/components/EntryDetailPane.vue`
- `frontend/src/styles.css`

## Commands

Run from `mercury-vibecoding` directory:

```bash
npm install
npm test
npm run build
npm --prefix frontend run typecheck
```

If Electron binary download is slow in your network:

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

For webpage demo mode:

```bash
npm run dev:server
npm --prefix frontend run dev -- --host 127.0.0.1
```

For desktop development mode:

```bash
npm run dev:desktop
```

## Desktop App (Electron + Vue 3 + Element Plus)

Team B is integrated into the right detail pane of the 3-pane desktop layout:

- Left: feed sidebar
- Middle: entry list
- Right: cleaned article reader

When the user selects an entry, the reader automatically loads cleaned content through `getEntryContent(entryId)`.

The reader supports:

- Markdown-rendered reader view
- Markdown view
- Manual content refresh
- Light, sepia, and dark themes
- Classic, editorial, and technical style templates
- Font size range: `12` to `18`
- Line height range: `1.4` to `2.2`

If article fetching or extraction fails, the pane falls back to the RSS summary and shows the error state.

### Reader Link Opening

Reader links can be opened in two ways:

- `Open in Browser`: opens the URL in the system browser.
- `Open in App`: opens the URL inside the app.

The in-app browser is implemented as an embedded Electron `<webview>` panel, not a separate Electron `BrowserWindow`. It supports:

- Back
- Forward
- Reload
- Address bar navigation
- Open current page in the system browser
- Red close icon in the toolbar
- Resizing from all four edges and all four corners

The app validates supported in-app protocols through the main process and returns a normalized URL to the renderer. The renderer owns the embedded browser UI and history controls.

The embedded browser layout was adjusted so the web page fills the full area below the toolbar. A dedicated frame wraps the `<webview>`, and the webview is positioned to fill that frame to avoid partial rendering or large blank areas.

### App Naming

User-facing product text was changed from `Mercury Vibecoding` to `Vibe Reader` in the app title, package metadata, OPML export title, OPML export file name, and CLI banner.

## Minimum Demo Flow

1. Start demo backend: `npm run dev:server`
2. Start frontend: `npm --prefix frontend run dev -- --host 127.0.0.1`
3. Open `http://127.0.0.1:5173/`
4. Add a real RSS feed, for example: `https://hnrss.org/frontpage`
5. Select a feed in the left pane.
6. Select an article in the middle pane.
7. Confirm the right pane displays cleaned article content.
8. Switch between `Reader` and `Markdown`.
9. Adjust theme, font size, and line height.
10. Use the refresh button to force re-fetch and re-clean the article.
11. Click `Open Source` or a reader link.
12. Choose `Open in App`.
13. Confirm the in-app browser opens inside the app with back/forward controls and a resizable window.

## API Demo

After adding a feed and finding an `entryId`, request cleaned content directly:

```bash
curl "http://127.0.0.1:5811/api/entries/<entryId>/content?refresh=1"
```

Expected response fields:

- `entryId`
- `title`
- `url`
- `html`
- `markdown`
- `fetchedAt`

## Tests

Team B adds coverage for:

- Cleaning and Markdown conversion from a mocked article page
- Caching cleaned content to avoid repeated fetches
- Fallback Markdown generation when article fetching is blocked, including HTTP `403`
- SQLite database parent directory creation

Run all tests:

```bash
npm test
```

Recent verification commands used for Team B fixes:

```bash
npm test
npm run build
npm --prefix frontend run build
npm --prefix frontend run typecheck
```

## Recent Bug Fixes

### Markdown Image Link Rendering

Reader Markdown rendering could produce broken image links or malformed HTML when:

- CRLF line endings were present in the source Markdown.
- Image links used multi-line wrapper syntax (`[![alt](img-url)](link-url)` split across lines).
- Code blocks were processed a second time by inline rules.

Fixes in `frontend/src/utils/readerMarkdown.ts`:

- Normalize CRLF to LF before processing.
- Add a phase 0.5 pass to reassemble multi-line image link wrappers into a single line.
- Skip inline processing for content already inside `<pre>` blocks.

Tests added in `tests/readerMarkdown.test.ts` cover basic formatting, CRLF normalization, image links with different line breaks, title attributes, inline image links, and code block non-conversion.

### Cleaned Content Markdown Generation

When cleaning pages such as `https://expression.fire.org/p/the-papers-please-era-of-the-internet`, Turndown produced broken Markdown for two HTML patterns:

1. **Image-only links** (`<a>` wrapping `<div><picture><img>`) produced empty lines and broken link syntax.
   - Fixed by adding a custom `imageLink` rule in `src/contentService.ts` that outputs single-line `[![alt](img-url)](link-url)`.
2. **Block-level links** (`<a>` directly wrapping `<p>`, `<div>`, or `<h1>`-`<h6>`) produced extra newlines.
   - Fixed by adding a custom Turndown rule that converts them to clean Markdown such as `[Essays](url)` or `## [Title](url)`.

Tests added in `tests/content-teamB.test.ts` verify both fixes.

### Substack Digest Post Embed Formatting

Cleaned Substack related-article cards (`<div data-component-name="DigestPostEmbed">`) originally:

- Showed a leading dot separator (`<p>·</p>`) before the date.
- Hyperlinked the article title.

Fixes in `src/contentService.ts` (`normalizeDigestEmbeds`):

- Remove the leading dot separator paragraph.
- Replace the linked title with a plain heading.
- Append a `Read full story →` link at the bottom of the card.
- Wrap the entire card with `---` horizontal rules to separate it from surrounding content.

Tests added in `tests/content-teamB.test.ts` verify the date formatting and link structure.

### In-App Browser New-Window Popups

Clicking certain links inside the embedded `<webview>` opened new Electron windows instead of navigating within the existing in-app browser.

Initial fix:

- Add `event.preventDefault()` in `handleEmbeddedBrowserNewWindow` in `frontend/src/components/EntryDetailPane.vue`.
- Add a main-process `web-contents-created` listener in `src/electronMain.ts` that uses `setWindowOpenHandler` to deny webview popups and forward the URL to the renderer via `webview:new-window`.
- Expose `onWebviewNewWindow` in `electron/preload.cjs`.
- Add the renderer listener in `frontend/src/components/EntryDetailPane.vue` to update `embeddedBrowserUrl`.
- Update `frontend/src/types.ts` and `frontend/src/api/client.ts` with the new bridge method.

Further hardening for edge cases (iframes, delayed `window.open`, etc.):

- Remove the `allowpopups` attribute from the `<webview>` so it cannot create popup windows by default.
- Apply `setWindowOpenHandler` to **all** webcontents in the app, not only webviews; non-webview requests are denied outright.