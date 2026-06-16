import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AiResultService } from '../src/aiResultService.js'
import { AppDatabase } from '../src/database.js'
import type { SummaryResult, TranslationResult } from '../src/ai/types.js'

describe('AiResultService', () => {
  let tmpDir = ''
  let database: AppDatabase
  let service: AiResultService

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'mercury-ai-results-'))
    database = new AppDatabase({ path: path.join(tmpDir, 'test.db') })
    service = new AiResultService(database)
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

  it('saves and reads a summary result', () => {
    const result: SummaryResult = {
      articleId: 'ignored-source-id',
      summary: 'Short summary',
      language: 'zh-CN',
      length: 'short',
      providerId: 'deepseek',
      model: 'deepseek-chat',
      createdAt: '2026-01-02T00:00:00.000Z',
      usage: {
        promptTokens: 100,
        completionTokens: 40,
        totalTokens: 140
      }
    }

    service.saveSummary(1, result)

    expect(service.getLatestSummary(1)).toEqual({
      ...result,
      articleId: '1'
    })
  })

  it('overwrites an existing summary for the same entry', () => {
    service.saveSummary(1, {
      articleId: '1',
      summary: 'Old summary',
      language: 'en',
      length: 'short',
      providerId: 'deepseek',
      model: 'deepseek-chat',
      createdAt: '2026-01-02T00:00:00.000Z',
      usage: {
        promptTokens: 100,
        completionTokens: 40,
        totalTokens: 140
      }
    })

    const latest: SummaryResult = {
      articleId: '1',
      summary: 'Updated summary',
      language: 'zh-CN',
      length: 'long',
      providerId: 'openai-compatible',
      model: 'gpt-4.1-mini',
      createdAt: '2026-01-03T00:00:00.000Z',
      usage: {
        promptTokens: 120,
        completionTokens: 60,
        totalTokens: 180
      }
    }

    service.saveSummary(1, latest)

    expect(service.getLatestSummary(1)).toEqual(latest)
    const rows = database.connection.prepare('SELECT * FROM ai_summaries WHERE entry_id = 1').all()
    expect(rows).toHaveLength(1)
  })

  it('saves and reads a translation result with segments', () => {
    const result: TranslationResult = {
      articleId: 'ignored-source-id',
      targetLanguage: 'zh-CN',
      bilingual: true,
      segments: [
        { index: 0, source: 'Hello', translated: '你好', status: 'success' },
        { index: 1, source: 'World', translated: '世界', status: 'success' }
      ],
      providerId: 'deepseek',
      model: 'deepseek-chat',
      createdAt: '2026-01-04T00:00:00.000Z',
      usage: {
        promptTokens: 200,
        completionTokens: 80,
        totalTokens: 280
      }
    }

    service.saveTranslation(1, result, 'en')

    expect(service.getLatestTranslation(1)).toEqual({
      ...result,
      articleId: '1'
    })
  })

  it('returns null summary and translation for an entry with no saved AI results', () => {
    expect(service.getLatestResults(1)).toEqual({ summary: null, translation: null })
  })
})
