import type { DatabaseSync } from 'node:sqlite'
import type { AppDatabase } from './database.js'
import type { Note, NoteRow } from './models.js'
import { nowIso } from './utils.js'

function asNoteRow(row: unknown): NoteRow {
  return row as NoteRow
}

function asNoteRows(rows: unknown): NoteRow[] {
  return rows as NoteRow[]
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    entryId: row.entry_id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class NotesService {
  private readonly db: DatabaseSync

  constructor(database: AppDatabase) {
    this.db = database.connection
  }

  create(entryId: number, content: string, title?: string): Note {
    const timestamp = nowIso()
    this.db.prepare(`
      INSERT INTO notes (entry_id, title, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(entryId, title ?? null, content, timestamp, timestamp)

    const row = this.db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }
    const note = this.getById(row.id)
    if (!note) throw new Error(`Failed to retrieve newly created note (id=${row.id})`)
    return note
  }

  update(noteId: number, fields: { title?: string | null; content?: string }): Note {
    const sets: string[] = ['updated_at = ?']
    const params: Array<string | number | null> = [nowIso()]

    if (fields.title !== undefined) {
      sets.push('title = ?')
      params.push(fields.title)
    }
    if (fields.content !== undefined) {
      sets.push('content = ?')
      params.push(fields.content)
    }

    params.push(noteId)
    this.db.prepare(`
      UPDATE notes SET ${sets.join(', ')} WHERE id = ?
    `).run(...params)

    const note = this.getById(noteId)
    if (!note) throw new Error(`Note not found (id=${noteId})`)
    return note
  }

  delete(noteId: number): void {
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(noteId)
  }

  getById(noteId: number): Note | null {
    const row = this.db.prepare(`
      SELECT id, entry_id, title, content, created_at, updated_at
      FROM notes WHERE id = ?
    `).get(noteId)

    return row ? toNote(asNoteRow(row)) : null
  }

  listByEntry(entryId: number): Note[] {
    const rows = this.db.prepare(`
      SELECT id, entry_id, title, content, created_at, updated_at
      FROM notes WHERE entry_id = ?
      ORDER BY created_at DESC
    `).all(entryId)

    return asNoteRows(rows).map(toNote)
  }

  listAll(): Note[] {
    const rows = this.db.prepare(`
      SELECT id, entry_id, title, content, created_at, updated_at
      FROM notes ORDER BY created_at DESC
    `).all()

    return asNoteRows(rows).map(toNote)
  }
}
