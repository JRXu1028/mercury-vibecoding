import type { DatabaseSync } from 'node:sqlite'
import type { AppDatabase } from './database.js'
import type { LatestAiResults, SummaryLength, SummaryResult, TranslationResult, TranslationSegment } from './ai/types.js'
import { nowIso } from './utils.js'

interface SummaryRow {
  entry_id: number
  provider_id: string
  model: string
  language: string
  length: SummaryLength
  summary: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  created_at: string
}

interface TranslationRow {
  entry_id: number
  provider_id: string
  model: string
  target_language: string
  bilingual: number
  segments_json: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  created_at: string
}

export class AiResultService {
  private readonly db: DatabaseSync

  constructor(database: AppDatabase) {
    this.db = database.connection
  }

  saveSummary(entryId: number, result: SummaryResult): void {
    const timestamp = nowIso()
    this.db.prepare(`
      INSERT INTO ai_summaries (
        entry_id,
        provider_id,
        model,
        language,
        length,
        summary,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entry_id) DO UPDATE SET
        provider_id = excluded.provider_id,
        model = excluded.model,
        language = excluded.language,
        length = excluded.length,
        summary = excluded.summary,
        prompt_tokens = excluded.prompt_tokens,
        completion_tokens = excluded.completion_tokens,
        total_tokens = excluded.total_tokens,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `).run(
      entryId,
      result.providerId,
      result.model,
      result.language,
      result.length,
      result.summary,
      result.usage.promptTokens,
      result.usage.completionTokens,
      result.usage.totalTokens,
      result.createdAt,
      timestamp
    )
  }

  getLatestSummary(entryId: number): SummaryResult | null {
    const row = this.db.prepare(
      'SELECT * FROM ai_summaries WHERE entry_id = ?'
    ).get(entryId) as SummaryRow | undefined
    if (!row) return null

    return {
      articleId: String(row.entry_id),
      summary: row.summary,
      language: row.language,
      length: row.length,
      providerId: row.provider_id,
      model: row.model,
      createdAt: row.created_at,
      usage: {
        promptTokens: Number(row.prompt_tokens),
        completionTokens: Number(row.completion_tokens),
        totalTokens: Number(row.total_tokens)
      }
    }
  }

  saveTranslation(entryId: number, result: TranslationResult, sourceLanguage?: string): void {
    const timestamp = nowIso()
    this.db.prepare(`
      INSERT INTO ai_translations (
        entry_id,
        provider_id,
        model,
        source_language,
        target_language,
        bilingual,
        segments_json,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entry_id) DO UPDATE SET
        provider_id = excluded.provider_id,
        model = excluded.model,
        source_language = excluded.source_language,
        target_language = excluded.target_language,
        bilingual = excluded.bilingual,
        segments_json = excluded.segments_json,
        prompt_tokens = excluded.prompt_tokens,
        completion_tokens = excluded.completion_tokens,
        total_tokens = excluded.total_tokens,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `).run(
      entryId,
      result.providerId,
      result.model,
      sourceLanguage ?? null,
      result.targetLanguage,
      result.bilingual ? 1 : 0,
      JSON.stringify(result.segments),
      result.usage.promptTokens,
      result.usage.completionTokens,
      result.usage.totalTokens,
      result.createdAt,
      timestamp
    )
  }

  getLatestTranslation(entryId: number): TranslationResult | null {
    const row = this.db.prepare(
      'SELECT * FROM ai_translations WHERE entry_id = ?'
    ).get(entryId) as TranslationRow | undefined
    if (!row) return null

    return {
      articleId: String(row.entry_id),
      targetLanguage: row.target_language,
      bilingual: row.bilingual === 1,
      segments: JSON.parse(row.segments_json) as TranslationSegment[],
      providerId: row.provider_id,
      model: row.model,
      createdAt: row.created_at,
      usage: {
        promptTokens: Number(row.prompt_tokens),
        completionTokens: Number(row.completion_tokens),
        totalTokens: Number(row.total_tokens)
      }
    }
  }

  getLatestResults(entryId: number): LatestAiResults {
    return {
      summary: this.getLatestSummary(entryId),
      translation: this.getLatestTranslation(entryId)
    }
  }
}
