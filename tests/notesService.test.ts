import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppDatabase } from '../src/database.js'
import { NotesService } from '../src/notesService.js'

describe('NotesService', () => {
  let tmpDir = ''
  let database: AppDatabase
  let service: NotesService

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mercury-notes-'))
    database = new AppDatabase({ path: path.join(tmpDir, 'test.db') })
    service = new NotesService(database)
    // Create a feed + entry so FK constraints pass
    database.connection.prepare(`
      INSERT INTO feeds (title, url, created_at, updated_at)
      VALUES ('test', 'https://example.com/feed.xml', '2026-01-01', '2026-01-01')
    `).run()
    database.connection.prepare(`
      INSERT INTO entries (feed_id, guid, url, title, created_at, updated_at)
      VALUES (1, 'g1', 'https://example.com/1', 'Entry 1', '2026-01-01', '2026-01-01')
    `).run()
  })

  afterEach(async () => {
    database.close()
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates and retrieves a note', () => {
    const note = service.create(1, 'hello world', 'My Note')
    expect(note.id).toBeGreaterThan(0)
    expect(note.entryId).toBe(1)
    expect(note.content).toBe('hello world')
    expect(note.title).toBe('My Note')
  })

  it('lists notes by entry', () => {
    service.create(1, 'first')
    service.create(1, 'second')
    const notes = service.listByEntry(1)
    expect(notes).toHaveLength(2)
  })

  it('updates a note', () => {
    const note = service.create(1, 'old content')
    const updated = service.update(note.id, { content: 'new content', title: 'T' })
    expect(updated.content).toBe('new content')
    expect(updated.title).toBe('T')
  })

  it('deletes a note', () => {
    const note = service.create(1, 'temp')
    service.delete(note.id)
    expect(service.getById(note.id)).toBeNull()
  })

  it('returns null for missing note', () => {
    expect(service.getById(999)).toBeNull()
  })
})
