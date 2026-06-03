import type { DatabaseSync } from 'node:sqlite'
import type { AppDatabase } from './database.js'
import type { Tag, TagRow } from './models.js'
import { nowIso } from './utils.js'

function asTagRow(row: unknown): TagRow {
  return row as TagRow
}

function asTagRows(rows: unknown): TagRow[] {
  return rows as TagRow[]
}

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export interface TagWithCount extends Tag {
  entryCount: number
}

export class TagsService {
  private readonly db: DatabaseSync

  constructor(database: AppDatabase) {
    this.db = database.connection
  }

  createTag(name: string, color?: string): Tag {
    const timestamp = nowIso()
    this.db.prepare(`
      INSERT INTO tags (name, color, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(name, color ?? null, timestamp, timestamp)

    const row = this.db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }
    const tag = this.getById(row.id)
    if (!tag) throw new Error(`Failed to retrieve newly created tag (id=${row.id})`)
    return tag
  }

  updateTag(tagId: number, fields: { name?: string; color?: string | null }): Tag {
    const sets: string[] = ['updated_at = ?']
    const params: Array<string | number | null> = [nowIso()]

    if (fields.name !== undefined) {
      sets.push('name = ?')
      params.push(fields.name)
    }
    if (fields.color !== undefined) {
      sets.push('color = ?')
      params.push(fields.color)
    }

    this.db.prepare(`
      UPDATE tags SET ${sets.join(', ')} WHERE id = ?
    `).run(...params, tagId)

    const tag = this.getById(tagId)
    if (!tag) throw new Error(`Tag not found (id=${tagId})`)
    return tag
  }

  deleteTag(tagId: number): void {
    this.db.prepare('DELETE FROM entry_tags WHERE tag_id = ?').run(tagId)
    this.db.prepare('DELETE FROM tags WHERE id = ?').run(tagId)
  }

  getById(tagId: number): Tag | null {
    const row = this.db.prepare(`
      SELECT id, name, color, created_at, updated_at FROM tags WHERE id = ?
    `).get(tagId)

    return row ? toTag(asTagRow(row)) : null
  }

  listTags(): TagWithCount[] {
    const rows = this.db.prepare(`
      SELECT t.id, t.name, t.color, t.created_at, t.updated_at,
             COUNT(et.entry_id) AS entry_count
      FROM tags t
      LEFT JOIN entry_tags et ON et.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all() as unknown as Array<TagRow & { entry_count: number }>

    return rows.map((row) => ({
      ...toTag(row),
      entryCount: row.entry_count
    }))
  }

  addTagToEntry(entryId: number, tagId: number): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)
    `).run(entryId, tagId)
  }

  removeTagFromEntry(entryId: number, tagId: number): void {
    this.db.prepare(`
      DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?
    `).run(entryId, tagId)
  }

  getTagsForEntry(entryId: number): Tag[] {
    const rows = this.db.prepare(`
      SELECT t.id, t.name, t.color, t.created_at, t.updated_at
      FROM tags t
      JOIN entry_tags et ON et.tag_id = t.id
      WHERE et.entry_id = ?
      ORDER BY t.name ASC
    `).all(entryId)

    return asTagRows(rows).map(toTag)
  }

  getEntriesWithTag(tagId: number): Array<{ entryId: number; entryTitle: string }> {
    const rows = this.db.prepare(`
      SELECT e.id AS entry_id, e.title AS entry_title
      FROM entries e
      JOIN entry_tags et ON et.entry_id = e.id
      WHERE et.tag_id = ?
      ORDER BY e.title ASC
    `).all(tagId) as unknown as Array<{ entry_id: number; entry_title: string }>

    return rows.map((row) => ({
      entryId: row.entry_id,
      entryTitle: row.entry_title
    }))
  }
}
