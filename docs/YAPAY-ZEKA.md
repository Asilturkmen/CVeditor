# Yapay zekâyı bağlamak

Arayüz, gizlilik katmanı ve sunucu uçları hazır. Kalan tek iş: **`server/ai/provider.ts`'teki
`runAiTask` fonksiyonunu doldurmak** ve istemciyi `VITE_AI_PROVIDER=http` ile derlemek.
Şu an bütün yapay zekâ uçları `503 { error: 'not_configured' }` döner; arayüz örnek sağlayıcıyla çalışır.

## Hazır olanlar

| Katman | Nerede | Ne yapar |
| --- | --- | --- |
| Giden veri | `src/ai/payload.ts`, `translate.ts`, `importText.ts`, `review.ts` | Tarayıcıda kurulur; ad gitmez, iletişim yalnız açık seçimle, metindeki iletişim ⟦…⟧ ile maskeli. "Ne gönderilir?" penceresi tamamını gösterir. |
| İstemci | `src/ai/httpProvider.ts` | `/api/ai/*` çağrıları, HTTP durumu → hata iletisi, parola penceresi, iptal ve süre sınırı. |
| Sözleşme | `src/ai/types.ts` | İstek ve yanıt Zod şemaları, `AI_LIMITS`. Sunucu istekleri **aynı** şemalarla doğrular. |
| Uçlar | `server/ai/routes.ts` | `/api/ai/auth`, `edit`, `translate`, `import`, `review`, `keywords`. |
| Koruma | `server/ai/*` | Parola (sabit zamanlı) → imzalı HttpOnly + Secure + SameSite=Strict çerez (`Path=/api/ai`); Origin denetimi; IP başına parola deneme sınırı; oturum ve IP başına istek sınırı; günlük harcama tavanı; gövde boyutu sınırı; yanıt şeması denetimi (uymayan yanıt 502). |

Bir isteğin yolu: yapılandırma → Origin → gövde sınırı → çerez → istek sınırı → günlük tavan →
istek şeması → **`runAiTask`** → yanıt şeması → istemci (`validate.ts` ile bir kez daha).

## Adımlar

### 1. Sağlayıcıyı ve modeli seç

Seçim senin (vault'ta açık soru). Ölçütler: Türkçe kalitesi, yapılandırılmış (JSON şemalı) çıktı desteği,
fiyat, veri saklama politikası (CV kişisel veridir; eğitimde kullanılmayan, kısa saklamalı API seç).
Sağlayıcı panelinde **aylık harcama sınırı** koy: sunucudaki günlük tavan ikinci kilittir, asıl güvence odur.

### 2. Paketleri kur

```sh
npm install ai @ai-sdk/<sağlayıcı>      # ör. @ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/google
```

AI SDK sık değişir: kodu yazmadan önce kurulan sürümün `node_modules/ai/docs/` belgesine bak.

### 3. `server/ai/provider.ts`'i doldur

Fonksiyonun başındaki açıklamada örnek var. Özü:

```ts
import { generateText, Output } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { EditResultSchema, ImportResultSchema, KeywordMatchResultSchema, ReviewResultSchema, TranslateResultSchema } from '@/ai/types'

const model = createAnthropic({ apiKey: process.env.AI_API_KEY })(process.env.AI_MODEL!)
const SCHEMAS = { edit: EditResultSchema, translate: TranslateResultSchema, import: ImportResultSchema, review: ReviewResultSchema, keywords: KeywordMatchResultSchema }

export async function runAiTask(task: AiTask, context: AiTaskContext): Promise<AiOutcome> {
  try {
    const { output, usage } = await generateText({
      model,
      output: Output.object({ schema: SCHEMAS[task.kind] }),
      system: `${SYSTEM_RULES.common}\n${SYSTEM_RULES[task.kind]}`,
      prompt: JSON.stringify(task.request),
      abortSignal: context.signal,
    })
    return { ok: true, result: output, costUsd: priceOf(usage) }
  } catch (error) {
    if (context.signal.aborted) return { ok: false, status: 504, error: 'timeout' }
    return { ok: false, status: 503, error: 'upstream_unavailable', retryAfter: 60 }
  }
}
```

- `priceOf(usage)`: `usage.inputTokens` ve `usage.outputTokens` × sağlayıcının güncel token fiyatı (USD).
  Günlük sayaç bunu toplar; `AI_DAILY_COST_CAP_USD` dolunca uçlar ertesi güne (UTC) kadar 503 döner.
- Hata eşlemesi: zaman aşımı 504 · sağlayıcı kapalı/kota 503 (+ `retryAfter`) · içerik işlenemedi
  (ör. metin CV'ye benzemiyor) 422 · beklenmeyen yanıt 502. Arayüzde her birinin kendi iletisi var.
- `result` istemciye gitmeden yanıt şemasıyla denetlenir; `runAiTask` ayrıca doğrulamak zorunda değil.

### 4. Model talimatı kuralları

`SYSTEM_RULES` (`server/ai/provider.ts`) bunları içeriyor; değiştirirsen koru:

- Yalnız verilen kimliklere dokun. `add`/`set` yalnız bölümün `fields` listesindeki alan adlarını kullanır;
  `rich: true` alan kısıtlı HTML (p, ul/li, strong, em, a), `rich: false` alan düz, tek satır.
- ⟦EMAIL⟧ gibi ⟦…⟧ yer tutuculara dokunma, birebir koru (⟦RAW⟧ dahil); yeni yer tutucu uydurma.
- Çeviri: kişi adları, şirket adları ve bağlantılar çevrilmez; okul resmî adıyla yazılır; gelen anahtar kümesi korunur.
- İnceleme: puan, yüzde ya da not verme; yorumu istekteki `language` dilinde yaz; en çok 20 yorum.
- Düzenleme: en çok 40 işlem, isteğe bağlı kısa `message`. Boş isteğe bağlı alan atlanabilir ya da null.
- Girdide olmayan bilgi (sayı, işveren, tarih, başarı) uydurma.

### 5. Ortam değişkenleri (`.env`, yalnız sunucuda)

```sh
AI_API_KEY=...                 # sağlayıcı anahtarı
AI_MODEL=...                   # model kimliği (sağlayıcının güncel listesinden)
AI_ENDPOINT_PASSWORD=...       # arayüzün sorduğu parola
AI_SESSION_SECRET=...          # openssl rand -base64 48
AI_DAILY_COST_CAP_USD=2        # günlük tavan
VITE_AI_PROVIDER=http          # istemci derlemesi: gerçek uçlar (gizli değil)
```

Üçü (`AI_ENDPOINT_PASSWORD`, `AI_SESSION_SECRET`, `AI_DAILY_COST_CAP_USD`) verilmedikçe uçlar kapalı kalır.
Diğer sınırlar (`AI_RATE_LIMIT_PER_MINUTE`, `AI_MAX_BODY_BYTES`, `AI_UPSTREAM_TIMEOUT_MS`,
`AI_SESSION_TTL_HOURS`, `AI_AUTH_ATTEMPTS_PER_15_MIN`) varsayılanla çalışır; açıklamalar `.env.example`'da.

### 6. Derle ve yayınla

`VITE_AI_PROVIDER` istemci paketine derlemede gömülür, bu yüzden değişince yeniden derlenmeli:

```sh
docker compose up -d --build     # compose, .env'deki VITE_AI_PROVIDER'ı derlemeye geçirir
```

`isDemo: false` olunca "Örnek" rozetleri kendiliğinden kalkar; ilk yapay zekâ isteğinde parola sorulur.

## Test

- Sunucu: `npx vitest run server` (`server/app.test.ts` yapay zekâ uçlarını sahte `runAiTask` ile sınar:
  parola, çerez, Origin, sınırlar, günlük tavan, şemalar). Gerçek sağlayıcı için `runAiTask`'a küçük bir
  birim testi ekle (ağ çağrısını taklit ederek).
- Elle: `npm run dev:server` + `.env` ile yerelde aç; prompt kutusu, çeviri, içe aktarma, İnceleme →
  yapay zekâ yorumu ve anlamına göre karşılaştırma. Parola penceresi ve hata iletileri gerçek uçla görünür.
- Arayüzü sağlayıcısız denemek için örnek sağlayıcı: localStorage `cveditor:mockAi` (bkz. `docs/DURUM.md`).
