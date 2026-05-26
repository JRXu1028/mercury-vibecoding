# Team A Implementation (Feed & Sync)

## Scope

This implementation covers the Team A responsibilities from `mercury-vibecoding/README.md`:

- Feed add/remove
- RSS/Atom parsing
- Feed sync (single, all, and timed auto-sync)
- OPML import/export
- Article list query

## Architecture

- Runtime: Node.js + TypeScript
- Storage: SQLite (`node:sqlite`)
- Feed parser: `rss-parser`
- OPML parser/builder: `fast-xml-parser`

## Data Model

Two tables are created automatically:

- `feeds`
- `entries`

`entries` enforces `UNIQUE(feed_id, guid)` to avoid duplicates during sync.

## Commands

Run from `mercury-vibecoding` directory:

```bash
npm install
npm run build
npm test
npm run dev
```

The CLI supports:

- `add <url>`
- `list-feeds`
- `list-entries [feedId]`
- `sync <feedId>`
- `sync-all`
- `remove <feedId>`
- `import-opml <file>`
- `export-opml <file>`
- `exit`

## Desktop App (Electron + Vue 3 + Element Plus)

The Team A UI now runs as an Electron desktop app.
The renderer frontend is in `frontend/`, with a 3-pane layout inspired by Mercury:

- Left: feed sidebar and OPML actions
- Middle: entry list and search
- Right: entry detail

Start desktop app in development:

```bash
npm install
npm run dev:desktop
```

If Electron binary download is slow in your network:

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

This launches:

- Electron main process (local backend + SQLite)
- Vite renderer dev server

Optional: configure backend timed sync interval:

```bash
TEAM_A_AUTO_SYNC_MINUTES=5 npm run dev:desktop
```

Build desktop artifacts:

```bash
npm run build:desktop
npm run start:desktop
```

The OPML import dialog supports:

- local file picker (desktop bridge)
- drag/drop upload
- direct XML paste

## Minimum Demo Flow

1. Start CLI: `npm run dev`
2. Add feed: `add https://example.com/feed.xml`
3. List entries: `list-entries`
4. Sync updates: `sync-all`
5. Export subscriptions: `export-opml ./feeds.opml`
6. Re-import subscriptions: `import-opml ./feeds.opml`

## Note

The original plan mentions `better-sqlite3`. In this environment (Node 25), native build for `better-sqlite3` failed due toolchain compatibility.
This implementation uses `node:sqlite` to keep SQLite-based local-first behavior and ensure reproducible execution.
