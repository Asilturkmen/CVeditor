# Durum (2026-11-19): yayına hazır, yalnız yapay zekâ kaldı

Yapay zekâ bağlantısı dışındaki her şey yapıldı: arayüz Apple'ın uygulama tasarım diline göre baştan kuruldu, şablon seti 14 şablonla yenilendi, tek tuşla PDF veren sunucu ve Docker paketi hazır.

Geriye tek iş kaldı: **yapay zekâyı bağlamak** → [`docs/YAPAY-ZEKA.md`](YAPAY-ZEKA.md). Yayına alma adımları → [`docs/YAYIN.md`](YAYIN.md).

## Bu turda yapılanlar (2026-11-19)

| Alan | Ne var |
| --- | --- |
| Tasarım dili | `DESIGN.md` baştan yazıldı: Apple'ın uygulama dili (Pages/Keynote/Ayarlar). Kök 16px, 4'lük ızgara; Apple cihazda SF, diğerlerinde Inter; soğuk nötr zeminler, tek vurgu (Petrol `#00786F`); kart yerine gruplu liste; yarı saydam malzeme yalnız dört yapışkan yüzeyde; CSS `linear()` yaylarıyla hareket. Bileşen vitrini (yalnız geliştirmede): `/_ui`. |
| Editör | Solda belge, sağda denetçi. İçerik anahat düzeninde: her kayıt tek satır, tıklanan yerinde açılır ("Tümünü aç" eski hep açık davranışı korur). Görünüm tek ekran (etiket solda, kontrol sağda). Şablonlar ve sayfa küçük resimleri tuvalin solundaki rayda (`Ctrl+\`). Tuvalin altında tek hap: sayfa gezinme, yakınlaştırma, Sığdır menüsü (sayfaya / genişliğe / %100). Prompt kutusu boşta tek satır; öneri farkı kaydın içinde okunur. |
| Diğer ekranlar | Galeri: 4 sütun, sütun ve fotoğraf süzgeci. Şablon sayfası + Yeni CV tek pencerede (renk takımı ve sütun burada seçilir). CV'lerim, İnceleme (önce düzeltilecekler, geçenler katlanır, iş ilanı hep açık), çeviri kontrolü (bölüm listesi + süzgeç), Ayarlar (macOS Ayarlar tarzı gruplu liste). Telefonda önizleme + PDF. |
| Şablonlar | 14 şablon (`docs/sablonlar/SET-14.md`): Yalın, Zarif, İkili, Panel, Teknik, Çizgi, Bant, Çizelge, İsviçre, Yönetici, Portre, Denge, Dergi, Blok. Çıkanlar (Manşet, Gece, Çift Ton, Afiş, Çerçeve) şema 3 göçüyle en yakın yenisine taşınır, içerik değişmez. Motor: tarih sütunu, sağda yan sütun, satır sonu ayırıcısı, ölçek çarpanları, yetim/dul satır kuralı, en az 12 mm kenar. Yeni yazı tipi Libre Franklin. |
| Tek tuşla PDF | Sunucu (`server/`, Hono + Playwright Chromium): `POST /api/pdf` CV verisini alır, aynı `src/render` paketiyle çizer, dış ağ isteklerini keser, gömülü yazı tipli A4 PDF döndürür. Sunucu yoksa (düz `npm run dev`) tarayıcının yazdır penceresine düşer. Dosya adı her iki yolda `Ad_Soyad_CV_tr.pdf`. |
| Yayın | `Dockerfile` (Node 24 + Chromium, root olmayan kullanıcı), `docker-compose.yml`, `deploy/Caddyfile` (cv.asilturkmen.com, otomatik TLS), güvenlik başlıkları ve CSP, IP başına hız sınırı. |
| Yapay zekâ | Korumalı uç iskeleti hazır: parola → imzalı HttpOnly çerez, Origin denetimi, istek sınırı, günlük tavan, istek/yanıt şeması doğrulaması. İstemci `src/ai/httpProvider.ts` (`VITE_AI_PROVIDER=http`). Uçlar şimdilik `503 not_configured`; doldurulacak tek fonksiyon `server/ai/provider.ts` `runAiTask`. |
| Gizlilik | Ad hiç gitmez; iletişim bilgileri yalnız prompt kutusundaki "İletişim bilgilerimi de gönder" seçiliyse gider. Serbest metinde e-posta, telefon (yaygın TR ve uluslararası biçimler), adres, doğum tarihi, TC no, kullanıcı adları, aksanlı adlar maskelenir. PDF içe aktarma ve inceleme aynı maskeyi kullanır; gerçek sağlayıcıda içe aktarma gönderimden önce onay ister. |
| Veri güvenliği | Aynı CV iki sekmede açıksa sessiz ezme yok (çakışma uyarısı). Kayıt başarısızsa editörden çıkış durdurulur, yedek indirme sunulur. Bozuk yedek onarılır, uygulamayı çökertmez. Fotoğraf yalnız gömülü JPEG/PNG/WebP. |

Testler: Vitest (uygulama + sunucu projeleri) ve Playwright. Komutlar için CLAUDE.md'ye bak.

## Bilerek sonraya bırakılanlar

- DOCX içe ve dışa aktarma.
- OCR (görsel PDF'ler).
- Hesap, kullanıcı başına token hakkı, BYOK, istatistik.
- Akademik şablon (sayfa üstünde ad ve sayfa numarası motorun bugün yapmadığı bir iş; şimdilik Zarif, Çizelge ve Teknik önerilir).
- Yeni şablon: `docs/sablonlar/SET-14.md` §5 kalite çıtası + `e2e/ats.spec.ts` ve `e2e/stress.spec.ts`'ten geçmeli.

## Önceki turlar

V1 (2026-10-16) için `docs/V1-NOTLAR.md`, 10 şablonlu eski set için `docs/sablonlar/PLAN.md` (eski).
