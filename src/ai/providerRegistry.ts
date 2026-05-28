import type { LLMProvider } from './types.js'

export const DEFAULT_PROVIDER_ID = 'mock'

const providers = new Map<string, LLMProvider>()

export interface RegisterProviderOptions {
  overwrite?: boolean
}

export function registerProvider(
  provider: LLMProvider,
  options: RegisterProviderOptions = {},
): void {
  if (!provider.id.trim()) {
    throw new Error('Cannot register an AI provider with an empty id.')
  }

  const existingProvider = providers.get(provider.id)
  if (existingProvider && !options.overwrite) {
    throw new Error(
      `AI provider "${provider.id}" is already registered. Pass overwrite: true to replace it.`,
    )
  }

  providers.set(provider.id, provider)
}

export function getProvider(providerId = DEFAULT_PROVIDER_ID): LLMProvider {
  const provider = providers.get(providerId)

  if (!provider) {
    const knownProviders = listProviderIds()
    const knownProviderText =
      knownProviders.length > 0 ? knownProviders.join(', ') : 'none registered'

    throw new Error(
      `AI provider "${providerId}" is not registered. Known providers: ${knownProviderText}.`,
    )
  }

  return provider
}

export function hasProvider(providerId = DEFAULT_PROVIDER_ID): boolean {
  return providers.has(providerId)
}

export function listProviderIds(): string[] {
  return Array.from(providers.keys())
}

export function clearProviders(): void {
  providers.clear()
}
