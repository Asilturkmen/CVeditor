# CVeditör — kodlama notları

Tarayıcıda çalışan, şablonlu CV editörü + kurala dayalı CV İnceleme. Public repo, MIT. Arayüz Türkçe (varsayılan) ve İngilizce; kullanıcıya "sen" diye hitap edilir. Tasarım kuralları: **DESIGN.md** (önce oku).

## Durum
- Yapay zekâ bağlantısı dışındaki her şey yapıldı (bkz. `docs/DURUM.md`). Kalan tek iş: **yapay zekâyı bağlamak** (`docs/YAPAY-ZEKA.md`: `server/ai/provider.ts` `runAiTask` + `VITE_AI_PROVIDER=http`). Yayına alma: `docs/YAYIN.md`.
- Yapay zekâ şimdilik örnek sağlayıcıyla çalışır (`src/ai/mockProvider.ts`, hiçbir yere istek atmaz; arayüz "Örnek" rozeti gösterir).
- PDF: sunucu varsa `POST /api/pdf` (Hono + Playwright Chromium, aynı `src/render` paketi) gerçek PDF indirir; sunucu yoksa tarayıcının yazdır penceresi (`src/lib/pdfExport.ts`).
- Git: commit/push yalnız Asil'in izniyle. Ajanlar git'e yazmaz.

## Komutlar
`npm run dev` (port 5173, sabit; sunucusuz) · `npm run dev:server` (5173 + `/api` sunucusu; tek tuşla PDF) · `npm run build` (istemci `dist/` + sunucu `dist-server/`) · `npm start` (üretim sunucusu) · `npm run typecheck` · `npm run lint` · `npm test` · `npm run e2e` · `npm run check` (hepsi) · `npm run scan` (push öncesi kişisel bilgi taraması) · `npm run fonts` (CV yazı tiplerini üretir). Docker: `docker compose up -d --build`.

## Sunucu (`server/`)
- Hono, Node 24. Statik `dist/` (CSP ve güvenlik başlıkları `security.ts`), `GET /api/health`, `POST /api/pdf` (`pdf/`: paylaşılan Chromium, kuyruk, süre sınırı, dış istekler kesik, uzun kayıtta `?allowSplit=1` yoksa 409), `/api/ai/*` (`ai/`: parola → imzalı çerez, Origin, hız sınırı, günlük tavan, Zod şemaları; model çağrısı `ai/provider.ts`'te).
- Sunucu `src/render` ve `src/cv`'yi `vite.server.config.ts` (SSR) ile derler; `?raw` CSS ve `@/` takma adı bu yüzden çalışır. Node'da DOMPurify için `configureSanitizer(jsdom.window)`.
- Hız sınırı ve günlük sayaç bellekte; asıl harcama güvencesi sağlayıcı panelindeki sınır.

## Mimari kurallar
- **İçerik ile görünüm ayrı.** CV verisi tek kaynak (`src/cv/schema.ts`); şablon onu çizer. Şema değişirse `CURRENT_SCHEMA_VERSION` artır ve `src/cv/migrate.ts`'e göç ekle; Dexie için yeni `version()` ekle, eskisini silme. Alan meta bilgisi (metin/zengin/çevrilir) `src/cv/fields.ts`'te.
- Her kayıtta kalıcı `id` ve `translationGroupId` var; kopyalama/çeviri/başka CV'ye eklemede çeviri bağı korunur.
- **Önizleme = PDF.** `src/render` tek çizim paketidir: `CvMarkup.tsx` (statik HTML) → `paginate.ts` (A4 sayfalara dağıtım) → `CvFrame.tsx` (sandbox'lı iframe; betik çalışmaz, zamanlayıcılar üst pencerede kurulur). Bu klasöre tarayıcıya özgü durum (store, router) sokma.
- **Önizleme = PDF (sunucuda):** "stil → yazı tiplerini bekle → HTML → paginate" sırası `drawDocument.ts`'te ortak; sunucu aynı yolu `pageScript.ts` ile Playwright sayfasında çalıştırır (`e2e/draw.spec.ts` iki yolun aynı sayfaları verdiğini denetler).
- **Sayfalama kuralı:** kayıt sığıyorsa asla bölünmez; bölüm başlığı sayfa dibinde yalnız kalmaz; bir sayfadan uzun kayıt raporlanır (`oversized`) ve maddeler arasından bölünür (her iki parçada en az 2 madde); ardışık beceri/dil satırlarında tek satır yetim/dul kalmaz; metin asla kesilip kaybolmaz. Kenar boşluğu her şablonda ve aralıkta ≥ 12 mm (`renderCv.ts` `MIN_PAGE_MARGIN_MM`).
- **ATS:** DOM sırası okuma sırasıdır; CSS `order`, `position:absolute`, `*-reverse` yasak. İletişim bilgisi her düzende başlıktadır (yan sütunda değil). Önemli metin `::before/::after` ile üretilmez. `<html lang>` CV dilinden gelir. Yazı tipleri statik ağırlık dosyaları (değişken yazı tipi PDF'e Type3 basılır); harf aralığı ≤ 0.05em (fazlası metni harf harf çıkarır). `e2e/ats.spec.ts` bunları PDF metni üzerinden denetler, `e2e/stress.spec.ts` uzun ad/iletişim/beceri satırıyla zorlar; yeni şablon bu testlerden geçmeden eklenmez.
- **Şablon = ayar + küçük CSS** (kayıt `src/render/templateMeta.ts`, bağlama `templates.ts`, görünüm `src/render/styles/<id>.css`). 14 şablon; şartname ve kalite çıtası `docs/sablonlar/SET-14.md` (§5). Şablon CSS'i yalnız `base.css` başındaki sözleşmedeki değişkenleri ve kancaları kullanır (tarih sütunu `datePosition`, sağda yan sütun `sidePosition`, ölçek `scale`, satır sonu ayırıcısı `eol`, `line-colon`). Metin taşıyan öğede `position` (relative dahil), opacity/transform/filter/z-index yasak: PDF okuma sırasını bozar. Fotoğraf yalnız `isSafePhoto` (`src/cv/photo.ts`: gömülü JPEG/PNG/WebP).
- Bütün CV değişiklikleri `src/editor/actions.ts` üzerinden `useEditor.update` ile; her biri tek geri alma adımı. Yapay zekâ önerilerinin toplu kabulü tek adım; öneriden sonra değişen alan ezilmez.
- **Yapay zekâ katmanı (`src/ai`)**: arayüz yalnız `types.ts` sözleşmesini (istek + yanıt Zod şemaları, `AI_LIMITS`) bilir; sağlayıcıyı `provider.ts` seçer (`VITE_AI_PROVIDER=http` → `httpProvider.ts`, yoksa örnek). Giden veri `payload.ts` (düzenleme: yalnız kapsam, ad hiç yok, iletişim YALNIZ kullanıcı "İletişim bilgilerimi de gönder"i seçtiyse, metindeki kişisel bilgi maskeli), `pdfMask.ts` (PDF içe aktarma ve incelemenin ortak maskesi) ve `translate.ts` (yalnız çevrilir alanlar) ile kurulur; maskeler `mask.ts`'te. Yanıt `validate.ts` ile Zod'dan geçer, `ops.ts` öneriye çevirir. Anahtar tarayıcıya asla gelmez; model çağrısı sunucuda `server/ai/provider.ts`.
- Arayüz metinleri `messages/tr.json` + `messages/en.json`'da (Paraglide, `m.anahtar()`; iki dosyada aynı anahtar ve parametreler — `src/test/messages.test.ts` denetler). Bileşene sabit metin yazma. CV dilindeki metinler (bölüm başlıkları, aylar) ayrı: `src/cv/locale.ts`.
- Kısıtlı zengin metin: p, ul/li, strong, em, a. Çizimde her zaman `sanitizeRichText` (öneri farkı `sanitizeDiffHtml`) ile temizlenir.

## Tasarım
- Ayrıntı DESIGN.md'de. Özet: Apple'ın uygulama tasarım dili (Pages/Keynote/Ayarlar). Kök 16px, 4'lük ızgara; yazı tipi Apple cihazda SF, diğerlerinde Inter Variable; soğuk nötr zeminler, tek sakin vurgu (Petrol `#00786F`); kart yerine gruplu liste; yarı saydam malzeme yalnız dört yapışkan yüzeyde (üst çubuk, denetçi başlığı, prompt çubuğu, tuval hapı); hareket CSS `linear()` yaylarıyla, kesilebilir, `prefers-reduced-motion`'a uyar. Token'lar `src/styles/app.css`'te, ortak bileşenler `src/components/ui/` (vitrin: geliştirmede `/_ui`).
- Editör düzeni: solda belge (tuval + altta hap + solda şablon/sayfa rayı), sağda denetçi (`Inspector.tsx`: İçerik anahat, Görünüm tek ekran, prompt çubuğu).
- Yasak (AI slop): mor-mavi gradyan, süs amaçlı cam/bulanık efekt, ✨ ikonları ve "AI-powered" rozetleri, emoji ikon, anlamsız bento, kaydırınca beliren öğeler, uydurma sayı/yorum/puan, her şeyi ortalamak, varsayılan shadcn görünümü. Metin "…" ile kesilmez.
- Arayüzü sunmadan önce ekran görüntüsü alıp hiza/boşluğu ölç; açık ve koyu temada, masaüstü ve 390px'te, Türkçe ve İngilizce bak.

## Testler
- Birim: `src/**/*.test.ts` (Vitest `app` projesi, jsdom) ve `server/**/*.test.ts` (Vitest `server` projesi, Node; gerçek Chromium ile PDF). Uçtan uca: `e2e/*.spec.ts` (Playwright, 5174 portu). Aynı anda birden fazla Playwright çalışacaksa `--output=<ayrı klasör>` ver.
- Paraglide'ı elle derlerken `--emit-ts-declarations` ver (yoksa `.d.ts` silinir, tsc düşer).

## Public repo
- Gerçek CV verisi asla repoya girmez; testlerde ve örneklerde uydurma kişi (`src/cv/sample.ts`).
- API anahtarı yok (yapay zekâ bağlanınca yalnız git dışı ortam dosyasında, sunucu tarafında).
- Kişisel/yerel notlar `CLAUDE.local.md`'de (git dışı).
- Push'tan önce `npm run scan` (`scripts/scan-personal.mjs`) temiz olmalı. Yanlış alarmı kontrolü gevşeterek değil izin listesiyle çöz. İsteyen `node scripts/install-hooks.mjs` ile pre-push kancası kurar; ajanlar kancayı kendiliğinden kurmaz.
- Ortam değişkenlerinin adları `.env.example`'da; gerçek `.env` git dışında, yalnız sunucu tarafında.
