# Team B Implementation (Content Cleaning & Reader)

## Scope

This implementation covers the Team B responsibilities from `mercury-vibecoding/README.md`:

- Article HTML fetching
- Main content extraction
- Cleaned HTML generation
- Markdown conversion and caching
- Reader detail view
- Reader theme, font size, line height, and Markdown preview controls

## Architecture

- Runtime: Node.js + TypeScript
- Storage: SQLite (`node:sqlite`)
- Article extraction: `@mozilla/readability` + `jsdom`
- HTML cleaning: `DOMPurify`
- Markdown conversion: `turndown`
- Reader UI: Vue 3 + Element Plus

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

- Cleaned HTML reader view
- Markdown view
- Manual content refresh
- Light, sepia, and dark themes
- Font size range: `12` to `18`
- Line height range: `1.4` to `2.2`

If article fetching or extraction fails, the pane falls back to the RSS summary and shows the error state.

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
- SQLite database parent directory creation

Run all tests:

```bash
npm test
```

## Note

This document follows the same structure as `TEAM_A.md` so each team has a comparable implementation note.
