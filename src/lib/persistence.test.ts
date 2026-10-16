import { describe, expect, it } from 'vitest'
import { isSafari } from './persistence'

const APPLE = 'Apple Computer, Inc.'

describe('isSafari', () => {
  it('macOS ve iOS Safari', () => {
    expect(
      isSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15', APPLE, false),
    ).toBe(true)
    expect(
      isSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', APPLE, false),
    ).toBe(true)
  })

  it('iOS üzerindeki başka tarayıcılar ve masaüstü Chrome Safari sayılmaz', () => {
    const cases = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/130.2849.80 Mobile/15E148 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15',
    ]
    for (const ua of cases) expect(isSafari(ua, APPLE, false)).toBe(false)
    expect(
      isSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'Google Inc.', false),
    ).toBe(false)
  })

  it('ana ekrana eklenmiş web uygulaması 7 gün sayacından muaf', () => {
    expect(
      isSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', APPLE, true),
    ).toBe(false)
  })
})
