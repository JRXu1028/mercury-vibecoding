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
})
