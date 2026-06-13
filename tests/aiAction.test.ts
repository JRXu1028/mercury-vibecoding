import { describe, expect, it } from 'vitest'
import { resolveAiAction } from '../frontend/src/utils/aiAction.js'

describe('resolveAiAction', () => {
  it('shows an existing result instead of regenerating it', () => {
    expect(resolveAiAction(true, 'summary')).toBe('show-summary')
    expect(resolveAiAction(true, 'translation')).toBe('show-translation')
  })

  it('generates when no existing result is available', () => {
    expect(resolveAiAction(false, 'summary')).toBe('generate-summary')
    expect(resolveAiAction(false, 'translation')).toBe('generate-translation')
  })
})
