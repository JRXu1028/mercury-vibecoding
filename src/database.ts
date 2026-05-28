import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

export interface AppDatabaseOptions {
  path: string
}

export class AppDatabase {
  private readonly db: DatabaseSync

  constructor(options: AppDatabaseOptions) {
    mkdirSync(path.dirname(options.path), { recursive: true })
    this.db = new DatabaseSync(options.path)
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.migrate()
  }

  close(): void {
    this.db.close()
  }

  get connection(): DatabaseSync {
    return this.db
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        site_url TEXT,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_id INTEGER NOT NULL,
        guid TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        author TEXT,
        summary TEXT,
        content_html TEXT,
        content_md TEXT,
        content_fetched_at TEXT,
        published_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(feed_id, guid),
        FOREIGN KEY(feed_id) REFERENCES feeds(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_entries_feed_id ON entries(feed_id);
      CREATE INDEX IF NOT EXISTS idx_entries_published_at ON entries(published_at);
    `)
    this.addColumnIfMissing('entries', 'content_html', 'TEXT')
    this.addColumnIfMissing('entries', 'content_md', 'TEXT')
    this.addColumnIfMissing('entries', 'content_fetched_at', 'TEXT')
  }

  private addColumnIfMissing(tableName: string, columnName: string, definition: string): void {
    const rows = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
    if (rows.some((row) => row.name === columnName)) {
      return
    }
    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`)
  }
}
