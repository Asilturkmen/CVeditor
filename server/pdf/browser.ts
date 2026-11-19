import { chromium, type Browser } from 'playwright-core'

/**
 * Bütün PDF isteklerinin paylaştığı tek Chromium. İlk istekte açılır (sunucu boşta bellek
 * harcamaz); çökerse ya da bağlantısı koparsa bir sonraki istekte yeniden açılır. Her istek
 * kendi bağlamını (çerez, önbellek, yönlendirme kuralı ayrı) açar ve kapatır.
 */
export class SharedBrowser {
  private browser: Promise<Browser> | null = null

  private readonly launch: () => Promise<Browser>

  constructor(launch: () => Promise<Browser> = launchChromium) {
    this.launch = launch
  }

  get(): Promise<Browser> {
    if (!this.browser) {
      const pending = this.launch().then(
        (browser) => {
          browser.on('disconnected', () => {
            if (this.browser === pending) this.browser = null
          })
          return browser
        },
        (error: unknown) => {
          if (this.browser === pending) this.browser = null
          throw error
        },
      )
      this.browser = pending
    }
    return this.browser
  }

  /** Çalışan tarayıcı bağlıysa true (sağlık denetimi için; tarayıcıyı açmaz) */
  async connected(): Promise<boolean | null> {
    if (!this.browser) return null
    return this.browser.then((b) => b.isConnected()).catch(() => false)
  }

  async close(): Promise<void> {
    const pending = this.browser
    this.browser = null
    if (pending) await pending.then((b) => b.close()).catch(() => {})
  }
}

export function launchChromium(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    // Kapsayıcıda /dev/shm küçüktür; Chromium paylaşımlı belleği /tmp'de tutar.
    args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-default-browser-check'],
  })
}
