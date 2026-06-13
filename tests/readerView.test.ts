import { describe, expect, it } from 'vitest'
import { resetAiView } from '../frontend/src/utils/readerView.js'

describe('resetAiView', () => {
  it('returns reader when the current view is an AI-only view', () => {
    expect(resetAiView('summary')).toBe('reader')
    expect(resetAiView('translation')).toBe('reader')
  })

  it('keeps normal reading views unchanged', () => {
    expect(resetAiView('reader')).toBe('reader')
    expect(resetAiView('markdown')).toBe('markdown')
  })
})
