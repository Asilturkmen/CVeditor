import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Sunucu ayarları: hepsi ortam değişkenlerinden okunur (adlar ve açıklamalar `.env.example`'da).
 * Alan adı kodda yazılmaz; gerekiyorsa `PUBLIC_ORIGIN` ile verilir.
 */
export interface ServerConfig {
  port: number
  host: string
  /** Derlenmiş istemci (`dist/`); null → yalnız API (geliştirmede istemciyi Vite sunar) */
  staticDir: string | null
  /** CV yazı tipleri (PDF bu dosyalarla çizilir; önizlemeyle aynı dosyalar) */
  fontsDir: string
  /** Önünde ters vekil (Caddy) var: istemci adresi X-Forwarded-For'un son öğesinden okunur */
  trustProxy: boolean
  /** Origin denetimi için sitenin dış adresi (ör. https://alan.adi); yoksa isteğin Host'u kullanılır */
  publicOrigin: string | null
  pdf: {
    /** Aynı anda basılan PDF sayısı (her biri bir Chromium sekmesi) */
    concurrency: number
    /** Sırada bekleyebilecek en çok istek; fazlası 503 */
    queueLimit: number
    /** Tek PDF'in süre sınırı (sırada bekleme dahil değil) */
    timeoutMs: number
    maxBodyBytes: number
    /** IP başına dakikada en çok PDF isteği */
    ratePerMinute: number
  }
  ai: {
    password: string | null
    sessionSecret: string | null
    sessionTtlHours: number
    ratePerMinute: number
    /** Günlük harcama tavanı (USD); null → yapay zekâ uçları kapalı (503 not_configured) */
    dailyCostCapUsd: number | null
    maxBodyBytes: number
    upstreamTimeoutMs: number
    /** IP başına 15 dakikada en çok parola denemesi */
    authAttemptsPer15Min: number
  }
}

/** Depo kökü: kaynakta `server/..`, derlenmiş pakette `dist-server/..` */
export const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url))

type Env = Record<string, string | undefined>

function num(env: Env, name: string, fallback: number, min = 0): number {
  const raw = env[name]?.trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min) throw new Error(`${name} geçersiz: "${raw}" (en az ${min} olan bir sayı olmalı)`)
  return value
}

const text = (env: Env, name: string) => env[name]?.trim() || null

/**
 * Ortamdan gelen göreli yollar çalışma klasörüne (cwd) göre çözülür; varsayılanlar depo köküne göre.
 */
export function loadConfig(env: Env = process.env, root = ROOT_DIR): ServerConfig {
  const serveStatic = env.SERVE_STATIC !== '0'
  const staticDir = serveStatic ? (env.STATIC_DIR?.trim() ? resolve(env.STATIC_DIR.trim()) : resolve(root, 'dist')) : null
  const builtFonts = staticDir ? resolve(staticDir, 'fonts') : null
  const fontsDir = env.FONTS_DIR?.trim()
    ? resolve(env.FONTS_DIR.trim())
    : builtFonts && existsSync(builtFonts)
      ? builtFonts
      : resolve(root, 'public/fonts')
  if (!existsSync(fontsDir)) throw new Error(`Yazı tipi klasörü yok: ${fontsDir} (FONTS_DIR ile ver)`)
  const secret = text(env, 'AI_SESSION_SECRET')
  if (secret && secret.length < 32) throw new Error('AI_SESSION_SECRET en az 32 karakter olmalı (ör. `openssl rand -base64 48`)')
  const cap = text(env, 'AI_DAILY_COST_CAP_USD')
  return {
    port: num(env, 'PORT', 8787, 1),
    host: text(env, 'HOST') ?? '0.0.0.0',
    staticDir,
    fontsDir,
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    publicOrigin: text(env, 'PUBLIC_ORIGIN')?.replace(/\/+$/, '') ?? null,
    pdf: {
      concurrency: num(env, 'PDF_CONCURRENCY', 2, 1),
      queueLimit: num(env, 'PDF_QUEUE_LIMIT', 8, 0),
      timeoutMs: num(env, 'PDF_TIMEOUT_MS', 30_000, 1000),
      maxBodyBytes: num(env, 'PDF_MAX_BODY_BYTES', 6 * 1024 * 1024, 1024),
      ratePerMinute: num(env, 'PDF_RATE_LIMIT_PER_MINUTE', 12, 1),
    },
    ai: {
      password: text(env, 'AI_ENDPOINT_PASSWORD'),
      sessionSecret: secret,
      sessionTtlHours: num(env, 'AI_SESSION_TTL_HOURS', 12, 0.01),
      ratePerMinute: num(env, 'AI_RATE_LIMIT_PER_MINUTE', 10, 1),
      dailyCostCapUsd: cap === null ? null : num(env, 'AI_DAILY_COST_CAP_USD', 0, 0),
      maxBodyBytes: num(env, 'AI_MAX_BODY_BYTES', 800_000, 1024),
      upstreamTimeoutMs: num(env, 'AI_UPSTREAM_TIMEOUT_MS', 90_000, 1000),
      authAttemptsPer15Min: num(env, 'AI_AUTH_ATTEMPTS_PER_15_MIN', 5, 1),
    },
  }
}
