/**
 * Günlük istek ve harcama sayacı (UTC gününe göre; bellekte, sunucu yeniden başlayınca sıfırlanır).
 * Asıl güvence sağlayıcı panelindeki harcama sınırıdır; bu sayaç ondan önce devreye giren ikinci kilit.
 */
export class DailyBudget {
  private day = ''
  private requests = 0
  private costUsd = 0

  private readonly capUsd: number
  private readonly now: () => number

  constructor(capUsd: number, now: () => number = Date.now) {
    this.capUsd = capUsd
    this.now = now
  }

  private roll() {
    const today = new Date(this.now()).toISOString().slice(0, 10)
    if (today !== this.day) {
      this.day = today
      this.requests = 0
      this.costUsd = 0
    }
  }

  /** Tavan dolduysa yarına (UTC 00:00) kaç saniye kaldığı; dolmadıysa null */
  exhausted(): number | null {
    this.roll()
    if (this.costUsd < this.capUsd) return null
    const now = this.now()
    const tomorrow = new Date(now)
    tomorrow.setUTCHours(24, 0, 0, 0)
    return Math.max(1, Math.ceil((tomorrow.getTime() - now) / 1000))
  }

  record(costUsd: number) {
    this.roll()
    this.requests++
    if (Number.isFinite(costUsd) && costUsd > 0) this.costUsd += costUsd
  }

  get stats() {
    this.roll()
    return { day: this.day, requests: this.requests, costUsd: this.costUsd, capUsd: this.capUsd }
  }
}
