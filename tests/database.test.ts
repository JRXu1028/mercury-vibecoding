import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AppDatabase } from '../src/database.js'

describe('AppDatabase', () => {
  let tmpDir = ''

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mercury-vibecoding-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates the parent directory for the SQLite file', () => {
    const database = new AppDatabase({ path: path.join(tmpDir, 'data', 'test.db') })

    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM feeds').get()).toEqual({ count: 0 })
    database.close()
  })

  it('has all expected tables after migration', () => {
    const database = new AppDatabase({ path: path.join(tmpDir, 'data', 'test.db') })

    const tables = database.connection.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).all() as Array<{ name: string }>

    const names = tables.map((t) => t.name)
    expect(names).toContain('feeds')
    expect(names).toContain('entries')
    expect(names).toContain('llm_providers')
    expect(names).toContain('llm_usage')
    expect(names).toContain('ai_summaries')
    expect(names).toContain('ai_translations')
    expect(names).toContain('notes')
    expect(names).toContain('tags')
    expect(names).toContain('entry_tags')
    database.close()
  })
})
