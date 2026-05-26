import { readFile, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import path from 'node:path'
import { AppDatabase } from './database.js'
import { FeedService } from './feedService.js'
import { OPMLService } from './opmlService.js'

const dbPath = path.resolve('data', 'mercury-vibecoding.db')

async function main(): Promise<void> {
  const db = new AppDatabase({ path: dbPath })
  const feedService = new FeedService(db)
  const opmlService = new OPMLService(feedService)
  const rl = createInterface({ input, output })

  output.write('Mercury Vibecoding Team A CLI\n')
  output.write('Commands: add <url>, list-feeds, list-entries [feedId], sync <feedId>, sync-all, remove <feedId>, import-opml <file>, export-opml <file>, exit\n')

  try {
    while (true) {
      let line = ''
      try {
        line = (await rl.question('> ')).trim()
      } catch {
        break
      }
      if (!line) {
        continue
      }

      const [command, ...args] = line.split(/\s+/)

      if (command === 'exit' || command === 'quit') {
        break
      }

      try {
        if (command === 'add') {
          const url = args[0]
          if (!url) {
            output.write('Usage: add <url>\n')
            continue
          }
          const result = await feedService.addFeed(url)
          output.write(`Added: ${result.feed.title} (new entries: ${result.newEntryCount})\n`)
          continue
        }

        if (command === 'list-feeds') {
          const feeds = feedService.listFeeds()
          if (feeds.length === 0) {
            output.write('No feeds\n')
            continue
          }
          feeds.forEach((feed) => {
            output.write(`#${feed.id} ${feed.title} | ${feed.url} | last synced: ${feed.lastSyncedAt ?? 'never'}\n`)
          })
          continue
        }

        if (command === 'list-entries') {
          const feedId = args[0] ? Number(args[0]) : undefined
          const entries = Number.isNaN(feedId) ? [] : feedService.listEntries({ feedId })
          if (entries.length === 0) {
            output.write('No entries\n')
            continue
          }
          entries.slice(0, 30).forEach((entry) => {
            output.write(`#${entry.id} [feed ${entry.feedId}] ${entry.title} | ${entry.url}\n`)
          })
          continue
        }

        if (command === 'sync') {
          const feedId = Number(args[0])
          if (Number.isNaN(feedId)) {
            output.write('Usage: sync <feedId>\n')
            continue
          }
          const result = await feedService.syncFeed(feedId)
          output.write(`Synced: ${result.feed.title} (new entries: ${result.newEntryCount})\n`)
          continue
        }

        if (command === 'sync-all') {
          const results = await feedService.syncAllFeeds()
          if (results.length === 0) {
            output.write('No feeds\n')
            continue
          }
          results.forEach((item) => {
            output.write(`Feed #${item.feedId} new entries: ${item.newEntryCount}\n`)
          })
          continue
        }

        if (command === 'remove') {
          const feedId = Number(args[0])
          if (Number.isNaN(feedId)) {
            output.write('Usage: remove <feedId>\n')
            continue
          }
          feedService.removeFeed(feedId)
          output.write(`Removed feed #${feedId}\n`)
          continue
        }

        if (command === 'import-opml') {
          const file = args[0]
          if (!file) {
            output.write('Usage: import-opml <file>\n')
            continue
          }
          const content = await readFile(path.resolve(file), 'utf8')
          const result = await opmlService.importFromString(content)
          output.write(`Imported: ${result.imported}, Failed: ${result.failed.length}\n`)
          result.failed.forEach((f) => output.write(`- ${f.url}: ${f.reason}\n`))
          continue
        }

        if (command === 'export-opml') {
          const file = args[0]
          if (!file) {
            output.write('Usage: export-opml <file>\n')
            continue
          }
          const feeds = feedService.listFeeds()
          const opml = opmlService.exportToString(feeds)
          await writeFile(path.resolve(file), opml, 'utf8')
          output.write(`Exported ${feeds.length} feeds to ${file}\n`)
          continue
        }

        output.write('Unknown command\n')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        output.write(`Error: ${message}\n`)
      }
    }
  } finally {
    rl.close()
    db.close()
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  output.write(`Fatal error: ${message}\n`)
  process.exitCode = 1
})
