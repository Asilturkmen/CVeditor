# Durum (2026-10-17): yayın öncesi

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
| Son tamamlama turu (2026-10-17) | Canlı CV varsayılan olarak bir sayfanın tamamı ekrana sığacak biçimde açılır (üstte/altta boşlukla; dizüstünden 27" ekrana). Görünüm'de bölüm sırası. Fotoğraf yükleme tek geri alma adımı. Tarayıcının kendi Yazdır menüsü de yalnız CV'yi basar; önizlemeye odaklıyken kısayollar çalışır. Safari'ye özgü 7 gün uyarısı. Bütün alanlarda örnek ipucu. CV İnceleme: kendi CV'lerin için de "ATS'nin gördüğü metin", sorunlu her bulguda "Düzenle"; yapay zekâ yorumu ve ilanla anlam eşleştirmesi örnek sağlayıcıyla çalışır. Ortak hata iletileri ve parola penceresi. Gizlilik: serbest metindeki adres ve referans adları da maskelenir. ATS testleri her şablon × sütun düzeninde. |
| Repo güvenliği | `npm run scan` (kişisel bilgi ve sır taraması), elle kurulan isteğe bağlı pre-push kancası, `.env.example`. |

Testler: Vitest birim testleri ve Playwright uçtan uca testleri. Komutlar için CLAUDE.md'ye bak.

## 1. Yapay zekâyı bağlamak

Arayüzün hiçbir yeri değişmez. Yapılacaklar:

1. **Sağlayıcıyı seç.** Vault'ta açık soru; önce sağlayıcıyı sen seçeceksin.
2. **Küçük sunucuyu kur** (Hono, Node 24). Uçların hepsi `POST`, gövde ve yanıt JSON; tipler ve Zod şemaları `src/ai/types.ts`'te:

   | Uç | İstek | Yanıt | Kullanan yer |
   | --- | --- | --- | --- |
   | `/api/ai/auth` | `{ password }` | 204 + HttpOnly çerez; yanlışsa 401 | Parola penceresi |
   | `/api/ai/edit` | `EditPayload` | `EditResult` | Editördeki prompt kutusu |
   | `/api/ai/translate` | `TranslateRequest` | `TranslateResult` | Diğer dile çevir, Başka CV'ye ekle |
   | `/api/ai/import` | `ImportRequest` | `ImportResult` | Eski CV'yi içe aktar |
   | `/api/ai/review` | `ReviewRequest` | `ReviewResult` (yorum listesi; puan ya da yüzde yok) | CV İnceleme → Yapay zekâ yorumu |
   | `/api/ai/keywords` | `KeywordMatchRequest` | `KeywordMatchResult` (eşleşen / eksik / başka adla) | CV İnceleme → Anlamına göre karşılaştır |

   - Hata durumları: 401 parola gerekli ya da çerez geçersiz, 429 istek sınırı, 503 günlük sınır ya da bakım.
   - AI SDK burada kullanılır; sağlayıcı değişikliği tek satırdır.
   - Model talimatında şu kurallar yer almalı:
     - yalnız verilen kimliklere dokun;
     - ⟦EMAIL⟧ gibi yer tutuculara dokunma;
     - çeviri kurallarına uy: adlar, şirketler ve bağlantılar çevrilmez; okul resmî adıyla yazılır;
     - incelemede puan, yüzde ya da not verme; yorumu `language` alanındaki dilde yaz.
3. **`src/ai/httpProvider.ts` yaz**, sonra `getAiProvider()` içinde onu döndür. Başka dosyaya dokunulmaz.
   - `AiProvider`'ın hepsini uygular: `id`, `isDemo: false`, `requiresAuth: true`, `authenticate`, `edit`, `translate`, `parseImport`, `review`, `matchKeywords`. Ayrıntı `src/ai/provider.ts`'in açıklamasında.
   - Her çağrı `fetch(..., { credentials: 'same-origin', signal })`. HTTP durumunu `AiError` koduna çevirir: 401 → `unauthorized`, 429 → `rate_limited`, 503 → `unavailable`, ağ hatası → `network`, iptal → `aborted`.
   - Arayüz hazır: yanıtlar `validate.ts` ile doğrulanır; her hata kodunun kendi iletisi var (`src/features/ai/aiErrorMessage.ts`); `unauthorized` gelince sayfa içi parola penceresi açılır, parola doğrulanınca istek bir kez yenilenir (`src/features/ai/aiAuth.ts`).
   - `isDemo: false` olunca "Örnek" rozetleri ve örnek notları kendiliğinden kalkar.
   - Örnek sağlayıcı parola istemez. Parola penceresini ve hata iletilerini denemek için localStorage'a `cveditor:mockAi` yaz: `{"password":"deneme"}` ya da `{"fail":"rate_limited"}`.
4. **Ucu koru.**
   - Önlemler: parola (HttpOnly çerez), istek sınırı, günlük maliyet tavanı, sağlayıcı tarafında harcama limiti. Turnstile isteğe bağlı.
   - Anahtar yalnız sunucuda durur; değişken adları `.env.example`'da.
5. **Gizlilik hazır.** Giden veri tarayıcıda kurulur: düzenleme `payload.ts`, çeviri `translate.ts`, içe aktarma `importText.ts`, inceleme ve ilan eşleşmesi `review.ts`. Ad ve iletişim bilgileri maskeli gider; her ekranda "Ne gönderilir?" gidecek verinin tamamını gösterir.

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
