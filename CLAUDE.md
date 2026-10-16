# CVeditör — kodlama notları

Tarayıcıda çalışan, şablonlu CV editörü + kurala dayalı CV İnceleme. Public repo, MIT. Arayüz Türkçe (varsayılan) ve İngilizce; kullanıcıya "sen" diye hitap edilir. Tasarım kuralları: **DESIGN.md** (önce oku).

## Durum
- Sunucu ve gerçek yapay zekâ dışındaki her şey yapıldı (bkz. `docs/DURUM.md`). Geriye iki iş kaldı: **yapay zekâyı bağlamak** ve **canlıya almak**.
- Yapay zekâ şimdilik örnek sağlayıcıyla çalışır (`src/ai/mockProvider.ts`, hiçbir yere istek atmaz; arayüz "Örnek" rozeti gösterir).
- PDF şimdilik tarayıcının yazdır penceresiyle alınır; tek tuşla PDF sunucuyla gelecek (Hono + Playwright Chromium, aynı `src/render` paketi).
- Git: commit/push yalnız Asil'in izniyle. Ajanlar git'e yazmaz.

## Komutlar
`npm run dev` (port 5173, sabit) · `npm run typecheck` · `npm run lint` · `npm test` · `npm run e2e` · `npm run check` (hepsi) · `npm run scan` (push öncesi kişisel bilgi taraması) · `npm run fonts` (CV yazı tiplerini üretir)

## Mimari kurallar
- **İçerik ile görünüm ayrı.** CV verisi tek kaynak (`src/cv/schema.ts`); şablon onu çizer. Şema değişirse `CURRENT_SCHEMA_VERSION` artır ve `src/cv/migrate.ts`'e göç ekle; Dexie için yeni `version()` ekle, eskisini silme. Alan meta bilgisi (metin/zengin/çevrilir) `src/cv/fields.ts`'te.
- Her kayıtta kalıcı `id` ve `translationGroupId` var; kopyalama/çeviri/başka CV'ye eklemede çeviri bağı korunur.
- **Önizleme = PDF.** `src/render` tek çizim paketidir: `CvMarkup.tsx` (statik HTML) → `paginate.ts` (A4 sayfalara dağıtım) → `CvFrame.tsx` (sandbox'lı iframe; betik çalışmaz, zamanlayıcılar üst pencerede kurulur). Bu klasöre tarayıcıya özgü durum (store, router) sokma.
- **Sayfalama kuralı:** kayıt sığıyorsa asla bölünmez; bölüm başlığı sayfa dibinde yalnız kalmaz; bir sayfadan uzun kayıt raporlanır (`oversized`) ve maddeler arasından bölünür; metin asla kesilip kaybolmaz.
- **ATS:** DOM sırası okuma sırasıdır; CSS `order`, `position:absolute`, `*-reverse` yasak. İletişim bilgisi her düzende başlıktadır (yan sütunda değil). Önemli metin `::before/::after` ile üretilmez. `<html lang>` CV dilinden gelir. Yazı tipleri statik ağırlık dosyaları (değişken yazı tipi PDF'e Type3 basılır); harf aralığı ≤ 0.05em (fazlası metni harf harf çıkarır). `e2e/ats.spec.ts` bunları PDF metni üzerinden denetler; yeni şablon bu testten geçmeden eklenmez.
- **Şablon = ayar + küçük CSS** (`src/render/templates.ts`, `src/render/styles/*.css`).
- Bütün CV değişiklikleri `src/editor/actions.ts` üzerinden `useEditor.update` ile; her biri tek geri alma adımı. Yapay zekâ önerilerinin toplu kabulü tek adım; öneriden sonra değişen alan ezilmez.
- **Yapay zekâ katmanı (`src/ai`)**: arayüz yalnız `types.ts` sözleşmesini bilir; sağlayıcıyı `provider.ts` seçer. Giden veri `payload.ts` (düzenleme: yalnız kapsam, iletişim gerekmedikçe yok, ad hiç yok, metindeki iletişim maskeli), `importText.ts` (içe aktarma maskesi) ve `translate.ts` (yalnız çevrilir alanlar) ile kurulur; yanıt `validate.ts` ile Zod'dan geçer, `ops.ts` öneriye çevirir. **Gerçek bağlantı = `httpProvider` yazıp `getAiProvider()`'da döndürmek**; anahtar tarayıcıya asla gelmez.
- Arayüz metinleri `messages/tr.json` + `messages/en.json`'da (Paraglide, `m.anahtar()`; iki dosyada aynı anahtar ve parametreler — `src/test/messages.test.ts` denetler). Bileşene sabit metin yazma. CV dilindeki metinler (bölüm başlıkları, aylar) ayrı: `src/cv/locale.ts`.
- Kısıtlı zengin metin: p, ul/li, strong, em, a. Çizimde her zaman `sanitizeRichText` (öneri farkı `sanitizeDiffHtml`) ile temizlenir.

## Tasarım
- Ayrıntı DESIGN.md'de. Özet: sade ve nötr, tek sakin vurgu rengi (Petrol), Instrument Sans; şık ve amaçlı animasyon (150-300 ms, kesilebilir, `prefers-reduced-motion`'a uyar). Renkler `src/styles/app.css` token'larında.
- Yasak (AI slop): mor-mavi gradyan, cam/bulanık efekt, ✨ ikonları ve "AI-powered" rozetleri, emoji ikon, anlamsız bento, kaydırınca beliren öğeler, uydurma sayı/yorum/puan, her şeyi ortalamak, varsayılan shadcn görünümü.
- Arayüzü sunmadan önce ekran görüntüsü alıp hiza/boşluğu ölç; açık ve koyu temada, masaüstü ve 390px'te, Türkçe ve İngilizce bak.

## Testler
- Birim: `src/**/*.test.ts` (Vitest). Uçtan uca: `e2e/*.spec.ts` (Playwright, 5174 portu). Aynı anda birden fazla Playwright çalışacaksa `--output=<ayrı klasör>` ver.

## Public repo
- Gerçek CV verisi asla repoya girmez; testlerde ve örneklerde uydurma kişi (`src/cv/sample.ts`).
- API anahtarı yok (yapay zekâ bağlanınca yalnız git dışı ortam dosyasında, sunucu tarafında).
- Kişisel/yerel notlar `CLAUDE.local.md`'de (git dışı).
- Push'tan önce `npm run scan` (`scripts/scan-personal.mjs`) temiz olmalı. Yanlış alarmı kontrolü gevşeterek değil izin listesiyle çöz. İsteyen `node scripts/install-hooks.mjs` ile pre-push kancası kurar; ajanlar kancayı kendiliğinden kurmaz.
- Ortam değişkenlerinin adları `.env.example`'da; gerçek `.env` git dışında, yalnız sunucu tarafında.
