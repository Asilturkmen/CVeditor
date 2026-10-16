import { mockProvider } from './mockProvider'
import type { AiProvider } from './types'

/**
 * Etkin yapay zekâ sağlayıcısı. Şimdilik örnek sağlayıcı (istek atmaz).
 *
 * Gerçek bağlantı (V3) için yapılacak tek değişiklik: sunucudaki
 * `/api/ai/{edit,translate,import}` uçlarına istek atan bir `httpProvider`
 * yazıp burada döndürmek. API anahtarı tarayıcıya hiç gelmez; uçlar
 * parola + hız sınırıyla korunur. Yanıtlar types.ts'teki şemalarla
 * doğrulanır (bkz. validate.ts).
 */
export function getAiProvider(): AiProvider {
  return mockProvider
}
