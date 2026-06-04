import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

export interface AppDatabaseOptions {
  path: string
}

export class AppDatabase {
  private readonly db: DatabaseSync
  private closed = false

  constructor(options: AppDatabaseOptions) {
    mkdirSync(path.dirname(options.path), { recursive: true })
    this.db = new DatabaseSync(options.path)
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.migrate()
  }

  close(): void {
    if (this.closed) return
    this.closed = true
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

      CREATE TABLE IF NOT EXISTS llm_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        api_base_url TEXT,
        api_key_env_var TEXT,
        default_model TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS llm_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id TEXT NOT NULL,
        entry_id INTEGER NOT NULL,
        operation TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL,
        completion_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entry_tags (
        entry_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY(entry_id, tag_id),
        FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE,
        FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_entries_feed_id ON entries(feed_id);
      CREATE INDEX IF NOT EXISTS idx_entries_published_at ON entries(published_at);
      CREATE INDEX IF NOT EXISTS idx_llm_usage_entry_id ON llm_usage(entry_id);
      CREATE INDEX IF NOT EXISTS idx_llm_usage_provider ON llm_usage(provider_id);
      CREATE INDEX IF NOT EXISTS idx_notes_entry_id ON notes(entry_id);
      CREATE INDEX IF NOT EXISTS idx_entry_tags_tag_id ON entry_tags(tag_id);
    `)
    // Incremental migrations for databases created before these columns existed.
    // Must stay in sync with the CREATE TABLE definitions above.
    this.addColumnIfMissing('entries', 'content_html', 'TEXT')
    this.addColumnIfMissing('entries', 'content_md', 'TEXT')
    this.addColumnIfMissing('entries', 'content_fetched_at', 'TEXT')
    this.addColumnIfMissing('tags', 'updated_at', 'TEXT')
    this.addColumnIfMissing('llm_providers', 'api_key_encrypted', 'BLOB')
  }

  private addColumnIfMissing(tableName: string, columnName: string, definition: string): void {
    const rows = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
    if (rows.some((row) => row.name === columnName)) {
      return
    }
    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`)
  }
}
