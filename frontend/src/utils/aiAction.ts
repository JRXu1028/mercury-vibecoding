export type AiActionKind = 'summary' | 'translation'
export type AiAction = 'show-summary' | 'show-translation' | 'generate-summary' | 'generate-translation'

export function resolveAiAction(hasResult: boolean, kind: AiActionKind): AiAction {
  if (hasResult) {
    return kind === 'summary' ? 'show-summary' : 'show-translation'
  }

  return kind === 'summary' ? 'generate-summary' : 'generate-translation'
}
