# Durum (2026-10-16): yayın öncesi

Sunucu ve gerçek yapay zekâ dışındaki her şey yapıldı. Geriye iki iş kaldı:

1. **Yapay zekâyı bağlamak**
2. **Canlıya almak**

İlk sürümün ayrıntıları için `docs/V1-NOTLAR.md`'ye, tasarım kuralları için `DESIGN.md`'ye bak.

## Bu turda yapılanlar

| Alan | Ne var |
| --- | --- |
| Yapay zekâ katmanı | `src/ai`. Tek sözleşme (`types.ts`), sağlayıcı seçimi (`provider.ts`), örnek sağlayıcı. Giden veri kapsamla sınırlı, iletişim bilgileri gerekmedikçe gönderilmez, ad hiç gönderilmez, metinde geçen iletişim bilgileri maskelenir. Yanıtlar Zod ile doğrulanır. Öneri türleri: alan değişikliği, kayıt ekleme, kayıt kaldırma. Prompt kutusunda iptal ve "Ne gönderilir?" penceresi var. |
| Eski CV içe aktarma | PDF metni tarayıcıda okunur (pdfjs-dist); dosya hiçbir yere gönderilmez. Metin yoksa, PDF parolalıysa ya da dosya PDF değilse açık hata verilir. Dil algılanır ve uyuşmazlıkta uyarılır. İletişim bilgileri kuralla çıkarılır. Kayıtlar kurala dayalı ön ayrıştırmayla bulunur, sen kayıt kayıt onaylarsın. Okunan ham metin de gösterilir. |
| JSON Resume | İçe aktarma (yeni CV adımında) ve dışa aktarma (CV menüleri). |
| Çeviri | "Diğer dile çevir" yeni bir CV oluşturur; "Başka CV'ye ekle" kaydı çevirerek ekler. Her ikisinde de çeviri önce gösterilir, alan alan düzenlenebilir; bağlı kayıt güncellenebilir. Örnek çevirmen yalnız küçük bir sözlüğü çevirir. |
| CV İnceleme (`/inceleme`) | Kurala dayalı ATS kontrolleri hem kendi CV'lerinde hem yüklenen PDF'te çalışır. "ATS'nin gördüğü metin" paneli ve iş ilanıyla anahtar kelime karşılaştırması var. Puan ya da yüzde yok; her bulgunun "Düzenle" bağlantısı var. |
| PDF/ATS kalitesi | Yazı tipleri sabit ağırlıklı dosyalar, PDF'e gerçek TrueType olarak gömülüyor (önceden Type3'tü). Başlık harf aralığı düşürüldü (önceden harf harf okunuyordu). İletişim her düzende başlıkta (iki sütunda adresler bölünmüyor). `e2e/ats.spec.ts` PDF metni üzerinden okuma sırasını ve Türkçe karakterleri denetliyor. |
| Arayüz | İngilizce arayüz ve dil seçici (Ayarlar). DESIGN.md taslağı. Tasarım denetiminin bulguları düzeltildi: kontrast, koyu tema, hizalar, kesilen metinler, yakınlaştırma çubuğu, şablon geçiş animasyonu, odak vurgusu. Klavyeyle sürükleme çalışıyor. |
| Repo güvenliği | `npm run scan` (kişisel bilgi ve sır taraması), elle kurulan isteğe bağlı pre-push kancası, `.env.example`. |

Testler: Vitest birim testleri ve Playwright uçtan uca testleri. Komutlar için CLAUDE.md'ye bak.

## 1. Yapay zekâyı bağlamak

Arayüzün hiçbir yeri değişmez. Yapılacaklar:

1. **Sağlayıcıyı seç.** Vault'ta açık soru; önce sağlayıcıyı sen seçeceksin.
2. **Küçük sunucuyu kur** (Hono, Node 24). Uçlar: `/api/ai/edit`, `/api/ai/translate`, `/api/ai/import`.
   - Her biri `src/ai/types.ts`'teki istek tipini alır ve aynı dosyadaki Zod şemasına uyan JSON döndürür.
   - AI SDK burada kullanılır; sağlayıcı değişikliği tek satırdır.
   - Model talimatında şu kurallar yer almalı:
     - yalnız verilen kimliklere dokun;
     - ⟦EMAIL⟧ gibi yer tutuculara dokunma;
     - çeviri kurallarına uy: adlar, şirketler ve bağlantılar çevrilmez; okul resmî adıyla yazılır.
3. **`src/ai/httpProvider.ts` yaz** (fetch + AbortSignal + `validate.ts`), sonra `getAiProvider()` içinde onu döndür.
   - `isDemo: false` olunca "Örnek" rozetleri kendiliğinden kalkar.
4. **Ucu koru.**
   - Önlemler: parola (HttpOnly çerez), istek sınırı, günlük maliyet tavanı, sağlayıcı tarafında harcama limiti. Turnstile isteğe bağlı.
   - Anahtar yalnız sunucuda durur; değişken adları `.env.example`'da.
5. **İçe aktarma ve incelemeyi bağla.**
   - İçe aktarma hattı hazır (`src/features/import/runImport.ts`); sağlayıcı yalnız `ImportResult` döndürür.
   - CV İnceleme sayfasında yapay zekâ yorumu için yer tutucu kart hazır.

## 2. Canlıya almak

1. **Tek tuşla PDF.**
   - Aynı sunucuda `/api/pdf`: istemci CV verisini gönderir, HTML'i sunucu `src/render` ile üretir, Playwright Chromium PDF basar. Dış ağ istekleri kapalı.
   - Bu iş V2 planındaydı ve sunucu gerektiriyor.
2. **Docker imajı:** statik site + Hono + Chromium.
3. **Barındırma ve alan adı:**
   - Sunucu: kendi VDS'in. Chromium yaklaşık 1 GB boş bellek ister.
   - Adres: `cv.asilturkmen.com` (DNS, TLS).
4. **Veri taşıma:** localhost'taki CV'ler yayındaki adrese kendiliğinden geçmez; Ayarlar → Yedekle / Geri yükle ile taşınır.
5. **Yayından önce son kontroller:** `npm run check`, `npm run scan` ve gerçek PDF'lerle bir tur.

## Bilerek sonraya bırakılanlar

- DOCX içe ve dışa aktarma.
- OCR (görsel PDF'ler).
- Hesap, kullanıcı başına token hakkı, BYOK, istatistik.
- Yeni şablonlar: her şablon `e2e/ats.spec.ts`'ten geçmeli.
