import { httpProvider } from './httpProvider'
import { mockProvider } from './mockProvider'
import type { AiProvider } from './types'
import { checkRequest } from './validate'

/**
 * Etkin yapay zekâ sağlayıcısı. Derlemedeki `VITE_AI_PROVIDER` seçer:
 *   (yok) / mock → örnek sağlayıcı (istek atmaz; "Örnek" rozetleri görünür)
 *   http         → httpProvider: aynı kökteki sunucunun /api/ai/* uçları
 * Bu değişken gizli değildir (yalnız hangi sağlayıcının derleneceğini seçer);
 * API anahtarı ve parola yalnız sunucudadır (.env.example).
 *
 * Her iki sağlayıcı da `checkedProvider` ile sarılır: istek göndermeden önce
 * types.ts'teki istek şemasıyla ve boyut sınırıyla denetlenir (sınırı aşan
 * istek AiError('too_large') ile durur, hiçbir yere gitmez).
 */
export function checkedProvider(base: AiProvider): AiProvider {
  return {
    get id() {
      return base.id
    },
    get isDemo() {
      return base.isDemo
    },
    get requiresAuth() {
      return base.requiresAuth
    },
    authenticate: base.authenticate ? async (password, signal) => base.authenticate!(password, signal) : undefined,
    edit: async (payload, signal) => base.edit(checkRequest('edit', payload), signal),
    translate: async (request, signal) => base.translate(checkRequest('translate', request), signal),
    parseImport: async (request, signal) => base.parseImport(checkRequest('import', request), signal),
    review: async (request, signal) => base.review(checkRequest('review', request), signal),
    matchKeywords: async (request, signal) => base.matchKeywords(checkRequest('keywords', request), signal),
  }
}

/** Derlemede seçilen sağlayıcı kimliği */
export const AI_PROVIDER_ID: 'http' | 'mock' = import.meta.env.VITE_AI_PROVIDER === 'http' ? 'http' : 'mock'

const active = checkedProvider(AI_PROVIDER_ID === 'http' ? httpProvider : mockProvider)

export function getAiProvider(): AiProvider {
  return active
}
