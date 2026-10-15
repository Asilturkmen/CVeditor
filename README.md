# CVeditör

Şablonlu, tarayıcıda çalışan CV editörü. CV'yi Canva'da kutu kaydırarak değil, yapılandırılmış veri olarak tutarsın: yeni bir staj = yeni bir kayıt. Şablon bu veriyi çizer; şablon değiştirmek içeriği kaybettirmez. Önizleme ne gösteriyorsa PDF de odur.

> Durum: **V1, çalışan arayüz.** Bütün ekranlar gerçekten çalışır. PDF şimdilik tarayıcının yazdır penceresiyle alınır. Yapay zekâ ekranları örnek veriyle çalışır, hiçbir yere istek atmaz. Tek tuşla PDF (sunucu) V2'de, yapay zekâ V3'te.

## Özellikler (V1)

- **Şablonlar:** Klasik (tek sütun) ve Modern (iki sütun). Hepsi aynı çizim motorunu kullanır; ATS'nin okuyabileceği düzendedir (seçilebilir metin, DOM sırası = okuma sırası).
- **Editör:** solda canlı CV, sağda **İçerik | Görünüm**. Bütün alanlar doğrudan düzenlenir; bölüm ve kayıtlar ⠿ tutamağıyla sürüklenir. CV'de bir kayda tıklamak paneli o kayda götürür.
- **Gerçek sayfalama:** A4, çok sayfa serbest. Bir kayıt iki sayfaya bölünmez. Bir sayfadan uzun kayıt varsa uyarı verilir; PDF için açık onay istenir ve kayıt maddeler arasından bölünür. Metin asla alttan kesilmez.
- **Sınırsız CV, her biri tek dil (TR/EN):** bölüm başlıkları ve tarihler CV diline göre. CV kopyalama, kaydı başka CV'ye ekleme (çeviri bağı korunur).
- **Görünüm:** şablon, vurgu rengi, yazı tipi (hepsi Türkçe karakterli, PDF'e gömülü), boyut, boşluk, tek/iki sütun, yan sütun bölümleri, fotoğraf (varsayılan kapalı).
- **Kayıt:** tarayıcıda (IndexedDB), otomatik kayıt, geri al/yinele, JSON yedek ve geri yükleme.
- **Yapay zekâ ekranları (örnek veri):** prompt kutusu + kapsam (Tüm CV / bölüm / kayıt), önerinin CV'de işaretlenmesi, tek tek ya da toplu kabul/ret, eski CV içe aktarma önizlemesi.
- Açık/koyu tema, klavye kısayolları, telefonda önizleme + PDF.

## Çalıştırma

Node 24 gerekir.

```bash
npm install
npm run dev        # http://localhost:5173
```

> Tarayıcı verisi adrese (port dahil) bağlıdır. Port 5173'e sabitlendi; farklı portta CV'ler görünmez. Başka bilgisayara taşımak için Ayarlar → Yedekle / Geri yükle.

PDF almak için editörde **PDF al** (Ctrl+P) → yazdır penceresinde "PDF olarak kaydet". Kenar boşlukları ve sayfa boyutu otomatik gelir; en iyi sonuç Chromium tabanlı tarayıcılarda (Chrome, Edge, Brave).

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (5173) |
| `npm run build` | Üretim derlemesi (`dist/`) |
| `npm run typecheck` | Çeviri dosyalarını derler + TypeScript denetimi |
| `npm run lint` | oxlint |
| `npm test` | Birim testleri (Vitest) |
| `npm run e2e` | Uçtan uca testler (Playwright, Chromium; ilk sefer `npx playwright install chromium`) |
| `npm run fonts` | CV yazı tiplerini `public/fonts`'a kopyalar |

## Yapı

```
src/
  cv/        CV veri modeli (Zod şeması), fabrika, tarih biçimi, yedek/göç, uydurma örnek CV
  db/        Dexie (IndexedDB) veritabanı
  render/    Çizim motoru: CV HTML'i, şablon CSS'leri, sayfalama, iframe önizleme
  editor/    Editör durumu (Immer patch'leriyle geri al/yinele), işlemler, örnek öneriler
  features/  Ekranlar: CV'lerim, Şablonlar, yeni CV, editör, içe aktarma, ayarlar
  components/ui/  Ortak arayüz bileşenleri (Radix tabanlı)
messages/    Arayüz metinleri (Paraglide; yeni dil = yeni JSON)
e2e/         Playwright testleri
```

## Gizlilik

Sunucu yok, hesap yok. CV'lerin yalnız tarayıcında durur. Repoya gerçek CV verisi girmez; örneklerdeki kişi uydurmadır.

## Lisans

MIT. Yazı tipleri SIL Open Font License 1.1 ile dağıtılır (`public/fonts`).
