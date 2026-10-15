# CVeditör — kodlama notları

Tarayıcıda çalışan, şablonlu CV editörü. Public repo, MIT. Arayüz dili Türkçe; kullanıcıya "sen" diye hitap edilir.

## Aşamalar
- **V1 (bitti): çalışan arayüz.** Sunucu yok; PDF tarayıcının yazdır penceresiyle; yapay zekâ ekranları örnek veriyle (`src/editor/mockSuggestions.ts`, `src/features/import/ImportPreview.tsx`).
- **V2: backend.** Hono sunucusu (Node 24), Playwright Chromium ile tek düğmeli PDF, şablonların ATS okuma sırası ve önizleme=PDF testleri, Docker. Sunucu CV verisini saklamaz; istemci HTML değil CV verisini gönderir, HTML'i sunucu `src/render` ile üretir.
- **V3: yapay zekâ.** AI SDK, sağlayıcıya bağlı kod tek katmanda; prompt ile düzenleme, çeviri, eski CV içe aktarma. Mevcut `Suggestion` biçimi ve kabul/ret arayüzü korunur.
- Bir aşamanın işini önceki aşamaya taşıma; kapsam dışı bir şeyi habersiz ekleme.

## Komutlar
`npm run dev` (port 5173, sabit) · `npm run typecheck` · `npm run lint` · `npm test` · `npm run e2e` · `npm run check` (hepsi)

## Mimari kurallar
- **İçerik ile görünüm ayrı.** CV verisi tek kaynak (`src/cv/schema.ts`); şablon onu çizer. Şema değişirse `CURRENT_SCHEMA_VERSION` artır ve `src/cv/migrate.ts`'e göç ekle; Dexie için yeni `version()` ekle, eskisini silme.
- Her kayıtta kalıcı `id` ve `translationGroupId` var; kopyalama/başka CV'ye eklemede çeviri bağı korunur.
- **Önizleme = PDF.** `src/render` tek çizim paketidir: `CvMarkup.tsx` (statik HTML) → `paginate.ts` (A4 sayfalara dağıtım) → `CvFrame.tsx` (iframe). V2'de sunucu aynı paketi kullanacak; bu klasöre tarayıcıya özgü durum (store, router) sokma.
- **Sayfalama kuralı:** kayıt sığıyorsa asla bölünmez; bölüm başlığı sayfa dibinde yalnız kalmaz; bir sayfadan uzun kayıt raporlanır (`oversized`) ve maddeler arasından bölünür; metin asla kesilip kaybolmaz.
- **ATS:** DOM sırası okuma sırasıdır; CSS `order`, `position:absolute`, `flex-direction: *-reverse` ile yer değiştirme yasak. Önemli metin `::before/::after` ile üretilmez. `<html lang>` CV dilinden gelir (Türkçe büyük İ).
- **Şablon = ayar + küçük CSS** (`src/render/templates.ts`, `src/render/styles/*.css`). Yeni şablon ayrı kod yığını değil.
- Bütün veri değişiklikleri `src/editor/actions.ts` üzerinden `useEditor.update` ile; her biri tek geri alma adımı. Yapay zekâ önerisinin toplu kabulü tek adım.
- Arayüz metinleri `messages/tr.json`'da (Paraglide, `m.anahtar()`); bileşene sabit Türkçe metin yazma. CV dilindeki metinler (bölüm başlıkları, aylar) ayrı: `src/cv/locale.ts`.
- Kısıtlı zengin metin: p, ul/li, strong, em, a. Çizimde her zaman `sanitizeRichText` ile temizlenir.

## Tasarım
- Sade ve nötr, tek sakin vurgu rengi; şık ve amaçlı animasyon (150-300 ms, kesilebilir, `prefers-reduced-motion`'a uyar). Renkler `src/styles/app.css` token'larında.
- Yasak (AI slop): mor-mavi gradyan, cam/bulanık efekt, ✨ ikonları ve "AI-powered" rozetleri, emoji ikon, anlamsız bento, kaydırınca beliren öğeler, uydurma sayı/yorum, her şeyi ortalamak, varsayılan shadcn görünümü.
- Arayüzü sunmadan önce ekran görüntüsü alıp hiza/boşluğu ölç; açık ve koyu temada, masaüstü ve 390px'te bak.

## Public repo
- Gerçek CV verisi asla repoya girmez; testlerde ve örneklerde uydurma kişi (`src/cv/sample.ts`).
- API anahtarı yok (V3'te yalnız git dışı ortam dosyasında, sunucu tarafında).
- Kişisel/yerel notlar `CLAUDE.local.md`'de (git dışı).
