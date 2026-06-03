import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppDatabase } from '../src/database.js'
import { UsageService } from '../src/usageService.js'

describe('UsageService', () => {
  let tmpDir = ''
  let database: AppDatabase
  let service: UsageService

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mercury-usage-'))
    database = new AppDatabase({ path: path.join(tmpDir, 'test.db') })
    service = new UsageService(database)
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

  it('records AI usage and persists to llm_usage table', () => {
    service.recordUsage({
      providerId: 'deepseek',
      entryId: 1,
      operation: 'summarize',
      model: 'deepseek-chat',
      promptTokens: 500,
      completionTokens: 200,
      totalTokens: 700
    })

    const rows = database.connection.prepare(
      'SELECT * FROM llm_usage WHERE entry_id = 1'
    ).all() as Array<Record<string, unknown>>

    expect(rows).toHaveLength(1)
    expect(rows[0].provider_id).toBe('deepseek')
    expect(rows[0].operation).toBe('summarize')
    expect(rows[0].total_tokens).toBe(700)
  })

  it('upserts provider info into llm_providers table', () => {
    service.upsertProvider({
      providerId: 'deepseek',
      name: 'DeepSeek',
      apiKeyEnvVar: 'DEEPSEEK_API_KEY'
    })

    const row = database.connection.prepare(
      "SELECT * FROM llm_providers WHERE provider_id = 'deepseek'"
    ).get() as Record<string, unknown>

    expect(row.name).toBe('DeepSeek')
    expect(row.api_key_env_var).toBe('DEEPSEEK_API_KEY')
  })

  it('upsert updates existing provider', () => {
    service.upsertProvider({
      providerId: 'deepseek',
      name: 'DeepSeek',
      defaultModel: 'deepseek-chat'
    })

    service.upsertProvider({
      providerId: 'deepseek',
      name: 'DeepSeek V3'
    })

    const row = database.connection.prepare(
      "SELECT * FROM llm_providers WHERE provider_id = 'deepseek'"
    ).get() as Record<string, unknown>

    expect(row.name).toBe('DeepSeek V3')
    expect(row.default_model).toBe('deepseek-chat')
  })
})
