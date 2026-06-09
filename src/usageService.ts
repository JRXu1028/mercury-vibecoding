import type { DatabaseSync } from 'node:sqlite'
import type { AppDatabase } from './database.js'
import { nowIso } from './utils.js'

export class UsageService {
  private readonly db: DatabaseSync

  constructor(database: AppDatabase) {
    this.db = database.connection
  }

  recordUsage(params: {
    providerId: string
    entryId: number
    operation: 'summarize' | 'translate'
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }): void {
    this.db.prepare(`
      INSERT INTO llm_usage (provider_id, entry_id, operation, model, prompt_tokens, completion_tokens, total_tokens, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.providerId,
      params.entryId,
      params.operation,
      params.model,
      params.promptTokens,
      params.completionTokens,
      params.totalTokens,
      nowIso()
    )
  }

  getProvider(providerId: string): { name: string; defaultModel: string | null; apiKeyEnvVar: string | null; hasStoredKey: boolean } | null {
    const row = this.db.prepare(
      'SELECT name, default_model, api_key_env_var, api_key_encrypted FROM llm_providers WHERE provider_id = ?'
    ).get(providerId) as { name: string; default_model: string | null; api_key_env_var: string | null; api_key_encrypted: Buffer | null } | undefined
    if (!row) return null
    return {
      name: row.name,
      defaultModel: row.default_model,
      apiKeyEnvVar: row.api_key_env_var,
      hasStoredKey: row.api_key_encrypted != null
    }
  }

  upsertProvider(params: {
    providerId: string
    name: string
    apiBaseUrl?: string
    apiKeyEnvVar?: string
    defaultModel?: string
  }): void {
    const timestamp = nowIso()
    this.db.prepare(`
      INSERT INTO llm_providers (provider_id, name, api_base_url, api_key_env_var, default_model, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_id) DO UPDATE SET
        name = excluded.name,
        api_base_url = COALESCE(excluded.api_base_url, llm_providers.api_base_url),
        api_key_env_var = COALESCE(excluded.api_key_env_var, llm_providers.api_key_env_var),
        default_model = COALESCE(excluded.default_model, llm_providers.default_model),
        updated_at = excluded.updated_at
    `).run(
      params.providerId,
      params.name,
      params.apiBaseUrl ?? null,
      params.apiKeyEnvVar ?? null,
      params.defaultModel ?? null,
      timestamp,
      timestamp
    )
  }

  saveApiKey(providerId: string, encryptedBuf: Buffer): void {
    this.db.prepare(
      'UPDATE llm_providers SET api_key_encrypted = ?, updated_at = ? WHERE provider_id = ?'
    ).run(encryptedBuf, nowIso(), providerId)
  }

  loadApiKey(providerId: string): Buffer | null {
    const row = this.db.prepare(
      'SELECT api_key_encrypted FROM llm_providers WHERE provider_id = ?'
    ).get(providerId) as { api_key_encrypted: Buffer | null } | undefined
    return row?.api_key_encrypted ?? null
  }

  getUsageSummary(): {
    totalTokens: number
    totalCalls: number
    byProvider: Array<{ providerId: string; callCount: number; totalTokens: number }>
    byOperation: Array<{ operation: string; callCount: number; totalTokens: number }>
    recentCalls: Array<{ providerId: string; operation: string; model: string; totalTokens: number; createdAt: string }>
  } {
    const totalRow = this.db.prepare(
      'SELECT COUNT(*) as calls, COALESCE(SUM(total_tokens), 0) as tokens FROM llm_usage'
    ).get() as { calls: number; tokens: number }
    const totalTokens = Number(totalRow.tokens) || 0
    const totalCalls = Number(totalRow.calls) || 0

    const byProvider = (this.db.prepare(
      'SELECT provider_id, COUNT(*) as call_count, COALESCE(SUM(total_tokens), 0) as total_tokens FROM llm_usage GROUP BY provider_id ORDER BY total_tokens DESC'
    ).all() as Array<{ provider_id: string; call_count: number; total_tokens: number }>).map((r) => ({
      providerId: r.provider_id,
      callCount: Number(r.call_count),
      totalTokens: Number(r.total_tokens)
    }))

    const byOperation = (this.db.prepare(
      'SELECT operation, COUNT(*) as call_count, COALESCE(SUM(total_tokens), 0) as total_tokens FROM llm_usage GROUP BY operation ORDER BY total_tokens DESC'
    ).all() as Array<{ operation: string; call_count: number; total_tokens: number }>).map((r) => ({
      operation: r.operation,
      callCount: Number(r.call_count),
      totalTokens: Number(r.total_tokens)
    }))

    const recentCalls = (this.db.prepare(
      'SELECT provider_id, operation, model, total_tokens, created_at FROM llm_usage ORDER BY created_at DESC LIMIT 20'
    ).all() as Array<{ provider_id: string; operation: string; model: string; total_tokens: number; created_at: string }>).map((r) => ({
      providerId: r.provider_id,
      operation: r.operation,
      model: r.model,
      totalTokens: Number(r.total_tokens),
      createdAt: r.created_at
    }))

    return { totalTokens, totalCalls, byProvider, byOperation, recentCalls }
  }
}
