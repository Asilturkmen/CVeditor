/** Sıra dolu: istek kabul edilmedi (503 + Retry-After). */
export class BusyError extends Error {
  constructor() {
    super('PDF sırası dolu')
  }
}

/** İş süre sınırını aştı (504); işin sinyali iptal edilir. */
export class JobTimeoutError extends Error {
  constructor(ms: number) {
    super(`PDF ${ms} ms içinde bitmedi`)
  }
}

/**
 * Eşzamanlılık sınırı + sınırlı bekleme sırası. Her iş kendi süre sınırıyla çalışır; süre dolunca
 * işe verilen sinyal iptal edilir (iş kaynaklarını kapatmalı) ve çağıran JobTimeoutError alır.
 */
export class JobQueue {
  private running = 0
  private readonly waiting: (() => void)[] = []

  private readonly concurrency: number
  private readonly queueLimit: number

  constructor(concurrency: number, queueLimit: number) {
    this.concurrency = concurrency
    this.queueLimit = queueLimit
  }

  get stats() {
    return { running: this.running, waiting: this.waiting.length }
  }

  async run<T>(job: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
    if (this.running >= this.concurrency) {
      if (this.waiting.length >= this.queueLimit) throw new BusyError()
      await new Promise<void>((resolve) => this.waiting.push(resolve))
    }
    this.running++
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        job(controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(new JobTimeoutError(timeoutMs))
          }, timeoutMs)
        }),
      ])
    } finally {
      clearTimeout(timer)
      this.running--
      this.waiting.shift()?.()
    }
  }
}
