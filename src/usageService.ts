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
}
