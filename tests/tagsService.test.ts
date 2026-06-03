import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppDatabase } from '../src/database.js'
import { TagsService } from '../src/tagsService.js'

describe('TagsService', () => {
  let tmpDir = ''
  let database: AppDatabase
  let service: TagsService

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mercury-tags-'))
    database = new AppDatabase({ path: path.join(tmpDir, 'test.db') })
    service = new TagsService(database)
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

  it('creates and retrieves a tag', () => {
    const tag = service.createTag('important', '#ff0000')
    expect(tag.id).toBeGreaterThan(0)
    expect(tag.name).toBe('important')
    expect(tag.color).toBe('#ff0000')
  })

  it('lists tags with entry counts', () => {
    const tag = service.createTag('dev')
    service.addTagToEntry(1, tag.id)
    const tags = service.listTags()
    expect(tags).toHaveLength(1)
    expect(tags[0].entryCount).toBe(1)
  })

  it('updates a tag', () => {
    const tag = service.createTag('old')
    const updated = service.updateTag(tag.id, { name: 'new', color: '#000' })
    expect(updated.name).toBe('new')
    expect(updated.color).toBe('#000')
  })

  it('deletes a tag and cleans up entry_tags', () => {
    const tag = service.createTag('temp')
    service.addTagToEntry(1, tag.id)
    service.deleteTag(tag.id)
    expect(service.getById(tag.id)).toBeNull()
    expect(service.getTagsForEntry(1)).toHaveLength(0)
  })

  it('adds and removes tags from entries', () => {
    const tag = service.createTag('bookmark')
    service.addTagToEntry(1, tag.id)
    expect(service.getTagsForEntry(1)).toHaveLength(1)
    service.removeTagFromEntry(1, tag.id)
    expect(service.getTagsForEntry(1)).toHaveLength(0)
  })

  it('duplicate add is idempotent', () => {
    const tag = service.createTag('dup')
    service.addTagToEntry(1, tag.id)
    service.addTagToEntry(1, tag.id)
    expect(service.getTagsForEntry(1)).toHaveLength(1)
  })
})
