import { afterEach, describe, expect, it, vi } from 'vitest'
import { whenPrintEnds } from './printEnd'

describe('baskı bitişi', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('afterprint ile bir kez biter', () => {
    const done = vi.fn()
    whenPrintEnds([window], done)
    window.dispatchEvent(new Event('afterprint'))
    window.dispatchEvent(new Event('afterprint'))
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('afterprint gelmezse yeniden odak ya da etkileşim bitirir; baskı başlarkenki odak sayılmaz', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    whenPrintEnds([window], done)
    window.dispatchEvent(new Event('focus'))
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    window.dispatchEvent(new Event('focus'))
    expect(done).toHaveBeenCalledTimes(1)

    const done2 = vi.fn()
    whenPrintEnds([window], done2)
    vi.advanceTimersByTime(1)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(done2).toHaveBeenCalledTimes(1)
  })

  it('elle durdurulunca hiç çağrılmaz', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    const stop = whenPrintEnds([window], done)
    stop()
    vi.advanceTimersByTime(1)
    window.dispatchEvent(new Event('afterprint'))
    window.dispatchEvent(new Event('focus'))
    expect(done).not.toHaveBeenCalled()
  })
})
