type FrameScheduler = (callback: () => void) => void
type TimeoutScheduler = (callback: () => void, ms: number) => void

export function waitForNextPaint(
  scheduleFrame: FrameScheduler = (callback) => requestAnimationFrame(() => callback()),
): Promise<void> {
  return new Promise((resolve) => {
    scheduleFrame(resolve)
  })
}

export function waitForVisibleReset({
  scheduleFrame = (callback) => requestAnimationFrame(() => callback()),
  scheduleTimeout = (callback, ms) => window.setTimeout(callback, ms),
  minMs = 180,
}: {
  scheduleFrame?: FrameScheduler
  scheduleTimeout?: TimeoutScheduler
  minMs?: number
} = {}): Promise<void> {
  return Promise.all([
    waitForNextPaint(scheduleFrame),
    new Promise<void>((resolve) => {
      scheduleTimeout(resolve, minMs)
    }),
  ]).then(() => undefined)
}
