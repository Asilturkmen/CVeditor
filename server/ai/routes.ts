import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import {
  AiError,
  EditResultSchema,
  ImportResultSchema,
  KeywordMatchResultSchema,
  ReviewResultSchema,
  TranslateResultSchema,
} from '@/ai/types'
import { checkRequest } from '@/ai/validate'
import type { ServerConfig } from '../config'
import { clientIp, RateLimiter, tooMany } from '../rateLimit'
import { originGuard } from '../security'
import { DailyBudget } from './budget'
import { runAiTask, type AiOutcome, type AiTask, type AiTaskKind } from './provider'
import { createSession, passwordMatches, SESSION_COOKIE, SESSION_PATH, verifySession } from './session'

const RESULT_SCHEMAS: Record<AiTaskKind, z.ZodType> = {
  edit: EditResultSchema,
  translate: TranslateResultSchema,
  import: ImportResultSchema,
  review: ReviewResultSchema,
  keywords: KeywordMatchResultSchema,
}

const AuthBodySchema = z.object({ password: z.string().min(1).max(500) })

type Env = { Variables: { sessionId: string } }

export interface AiRouteDeps {
  config: ServerConfig
  /** Testler için değiştirilebilir (varsayılan provider.ts'teki runAiTask) */
  run?: typeof runAiTask
  now?: () => number
}

/**
 * /api/ai/* — sözleşme `src/ai/httpProvider.ts` ve docs/DURUM.md'de.
 * Sıra: yapılandırma → Origin → gövde sınırı → (auth hariç) çerez → istek sınırı → günlük tavan →
 * şema → sağlayıcı (provider.ts) → yanıt şeması.
 * Parola, oturum sırrı ya da günlük tavan tanımlı değilse uçlar kapalıdır (503 not_configured).
 */
export function aiRoutes({ config, run = runAiTask, now = Date.now }: AiRouteDeps) {
  const app = new Hono<Env>()
  const { ai } = config
  const authLimiter = new RateLimiter(ai.authAttemptsPer15Min, 15 * 60_000, now)
  const requestLimiter = new RateLimiter(ai.ratePerMinute, 60_000, now)
  const budget = new DailyBudget(ai.dailyCostCapUsd ?? 0, now)
  const configured = !!(ai.password && ai.sessionSecret && ai.dailyCostCapUsd !== null)

  app.use('*', async (c, next) => {
    if (!configured) {
      c.header('Retry-After', '3600')
      return c.json({ error: 'not_configured' }, 503)
    }
    await next()
  })
  app.use('*', originGuard(config.publicOrigin, true))
  app.use('*', bodyLimit({ maxSize: ai.maxBodyBytes, onError: (c) => c.json({ error: 'too_large' }, 413) }))

  app.post('/auth', async (c) => {
    const ip = clientIp(c, config.trustProxy)
    const retry = authLimiter.hit(ip)
    if (retry !== null) return tooMany(c, retry)
    const body = AuthBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'bad_request' }, 400)
    if (!passwordMatches(body.data.password, ai.password!)) return c.json({ error: 'unauthorized' }, 401)
    authLimiter.reset(ip)
    const session = createSession(ai.sessionSecret!, ai.sessionTtlHours * 3_600_000, now())
    setCookie(c, SESSION_COOKIE, session.value, {
      path: SESSION_PATH,
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      expires: session.expires,
    })
    return c.body(null, 204)
  })

  const requireSession: MiddlewareHandler<Env> = async (c, next) => {
    const id = verifySession(getCookie(c, SESSION_COOKIE), ai.sessionSecret!, now())
    if (!id) return c.json({ error: 'unauthorized' }, 401)
    c.set('sessionId', id)
    await next()
  }

  const limits: MiddlewareHandler<Env> = async (c, next) => {
    // Oturum ve IP ayrı ayrı sayılır: tek oturum ya da tek adres sınırı aşamaz.
    const retry = requestLimiter.hit(`s:${c.get('sessionId')}`) ?? requestLimiter.hit(`ip:${clientIp(c, config.trustProxy)}`)
    if (retry !== null) return tooMany(c, retry)
    const wait = budget.exhausted()
    if (wait !== null) {
      c.header('Retry-After', String(wait))
      return c.json({ error: 'daily_limit' }, 503)
    }
    await next()
  }

  const handle = (kind: AiTaskKind) => async (c: Context<Env>) => {
    const raw: unknown = await c.req.json().catch(() => undefined)
    if (raw === undefined) return c.json({ error: 'bad_request' }, 400)
    let request: unknown
    try {
      request = checkRequest(kind, raw)
    } catch (error) {
      const tooLarge = error instanceof AiError && error.code === 'too_large'
      return c.json({ error: tooLarge ? 'too_large' : 'bad_request' }, tooLarge ? 413 : 400)
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('timeout')), ai.upstreamTimeoutMs)
    const onClose = () => controller.abort(new Error('client_closed'))
    c.req.raw.signal?.addEventListener('abort', onClose, { once: true })
    let outcome: AiOutcome
    try {
      outcome = await run({ kind, request } as AiTask, { signal: controller.signal })
    } catch (error) {
      outcome = controller.signal.aborted
        ? { ok: false, status: 504, error: 'timeout' }
        : { ok: false, status: 502, error: error instanceof Error ? 'upstream_error' : 'unknown' }
    } finally {
      clearTimeout(timer)
      c.req.raw.signal?.removeEventListener('abort', onClose)
    }
    if (!outcome.ok) {
      if (outcome.retryAfter) c.header('Retry-After', String(outcome.retryAfter))
      return c.json({ error: outcome.error }, outcome.status)
    }
    budget.record(outcome.costUsd)
    const checked = RESULT_SCHEMAS[kind].safeParse(outcome.result)
    if (!checked.success) return c.json({ error: 'invalid_response' }, 502)
    return c.json(outcome.result as object)
  }

  for (const kind of ['edit', 'translate', 'import', 'review', 'keywords'] as const) {
    app.post(`/${kind}`, requireSession, limits, handle(kind))
  }

  return app
}
