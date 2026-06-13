import { describe, expect, it } from 'vitest'
import { waitForNextPaint, waitForVisibleReset } from '../frontend/src/utils/uiPaint.js'

describe('waitForNextPaint', () => {
  it('waits for the provided frame scheduler before resolving', async () => {
    let scheduled: (() => void) | null = null
    let resolved = false

    const promise = waitForNextPaint((callback) => {
      scheduled = callback
    }).then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)

    scheduled?.()
    await promise

    expect(resolved).toBe(true)
  })
})

describe('waitForVisibleReset', () => {
  it('waits for both a paint frame and a minimum visible duration', async () => {
    let frameCallback: (() => void) | null = null
    let timeoutCallback: (() => void) | null = null
    let timeoutMs = 0
    let resolved = false

    const promise = waitForVisibleReset({
      scheduleFrame: (callback) => {
        frameCallback = callback
      },
      scheduleTimeout: (callback, ms) => {
        timeoutCallback = callback
        timeoutMs = ms
      },
      minMs: 180,
    }).then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)
    expect(timeoutMs).toBe(180)

    frameCallback?.()
    await Promise.resolve()
    expect(resolved).toBe(false)

    timeoutCallback?.()
    await promise
    expect(resolved).toBe(true)
  })
})
