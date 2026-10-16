# CVeditör

Şablonlu, tarayıcıda çalışan CV editörü. CV'yi Canva'da kutu kaydırarak değil, yapılandırılmış veri olarak tutarsın: yeni bir staj = yeni bir kayıt. Şablon bu veriyi çizer; şablon değiştirmek içeriği kaybettirmez. Önizleme ne gösteriyorsa PDF de odur.

> Durum: **yayın öncesi.** Sunucu ve gerçek yapay zekâ dışında her şey çalışır. PDF şimdilik tarayıcının yazdır penceresiyle alınır; yapay zekâ özellikleri örnek sağlayıcıyla çalışır ve hiçbir yere istek atmaz. Kalan iki iş (yapay zekâyı bağlamak, canlıya almak): `docs/DURUM.md`.

## Özellikler

- **Şablonlar:** Klasik ve Modern; ikisi de tek ya da iki sütun. Hepsi aynı çizim motorunu kullanır ve ATS'nin okuyabileceği düzendedir: seçilebilir metin, DOM sırası = okuma sırası, gömülü TrueType yazı tipleri. Bu, PDF metni üzerinden testle denetlenir.
- **Editör:** solda canlı CV (bir sayfa ekrana tam sığar), sağda **İçerik | Görünüm**. Bütün alanlar doğrudan düzenlenir; bölüm ve kayıtlar fareyle ya da klavyeyle sürüklenir. CV'de bir kayda tıklamak paneli o kayda götürür.
- **Gerçek sayfalama:** A4, çok sayfa serbest. Bir kayıt iki sayfaya bölünmez. Bir sayfadan uzun kayıt varsa uyarı verilir; PDF için açık onay istenir ve kayıt maddeler arasından bölünür. Metin asla alttan kesilmez.
- **Sınırsız CV, her biri tek dil (TR/EN):** bölüm başlıkları ve tarihler CV diline göre yazılır. CV kopyalanabilir, "diğer dile çevir" ile çevrilebilir. Kayıt başka bir CV'ye çevrilerek ya da olduğu gibi eklenebilir; çeviri bağı korunur.
- **Eski CV içe aktarma:** PDF metni tarayıcıda okunur (dosya gönderilmez), dil algılanır, kayıtlar ayrılır, sen onaylarsın. JSON Resume içe ve dışa aktarma da var.
- **CV İnceleme:** kurala dayalı ATS kontrolleri (kendi CV'lerin ya da yüklenen PDF), ATS'nin gördüğü metin, iş ilanıyla anahtar kelime karşılaştırması, yapay zekâ yorumu. Her sorunda "Düzenle" bağlantısı. Uydurma puan yok.
- **Görünüm:** şablon, CV vurgu rengi, yazı tipi (hepsi Türkçe karakterli, PDF'e gömülü), boyut, boşluk, tek/iki sütun, yan sütun bölümleri, fotoğraf (varsayılan kapalı).
- **Kayıt:** tarayıcıda (IndexedDB); otomatik kayıt, geri al/yinele, JSON yedek ve geri yükleme.
- **Yapay zekâ (örnek sağlayıcı):** prompt kutusu + kapsam (Tüm CV / bölüm / kayıt). Öneriler (alan değişikliği, kayıt ekleme/kaldırma) CV'de işaretlenir; tek tek ya da toplu kabul edilir. "Ne gönderilir?" penceresi giden veriyi gösterir: iletişim bilgileri gerekmedikçe gönderilmez, ad hiç gönderilmez.
- Türkçe ve İngilizce arayüz, açık/koyu tema, klavye kısayolları, telefonda önizleme + PDF.

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
| `npm run check` | Hepsi: typecheck + lint + birim + uçtan uca |
| `npm run fonts` | CV yazı tiplerini `public/fonts`'a kopyalar |
| `npm run scan` | Kişisel bilgi ve sır taraması (push öncesi) |

## Yapı

```
src/
  cv/        CV veri modeli (Zod şeması), fabrika, tarih biçimi, yedek/göç, uydurma örnek CV
  db/        Dexie (IndexedDB) veritabanı
  render/    Çizim motoru: CV HTML'i, şablon CSS'leri, sayfalama, iframe önizleme
  ai/        Yapay zekâ sözleşmesi, sağlayıcı seçimi, örnek sağlayıcı, gizlilik (maskeleme), içe aktarma ve çeviri yardımcıları
  review/    CV İnceleme kural motoru ve anahtar kelime eşleştirme
  editor/    Editör durumu (Immer patch'leriyle geri al/yinele), işlemler, örnek öneriler
  features/  Ekranlar: CV'lerim, Şablonlar, yeni CV, editör, içe aktarma, ayarlar
  components/ui/  Ortak arayüz bileşenleri (Radix tabanlı)
messages/    Arayüz metinleri (Paraglide; yeni dil = yeni JSON)
e2e/         Playwright testleri
```

## Gizlilik

Sunucu yok, hesap yok. CV'lerin yalnız tarayıcında durur. Repoya gerçek CV verisi girmez; örneklerdeki kişi uydurmadır.

## Public repo güvenliği

Repo herkese açık; içine gerçek CV verisi, kişisel bilgi ya da anahtar girmemeli. **Her push'tan önce** tarama çalıştır:

```bash
npm run scan
```

`scripts/scan-personal.mjs` git'in izlediği ve git dışı bırakılmamış bütün dosyalarda e-posta, telefon, TC kimlik no, IBAN, API anahtarı ve özel anahtar arar; gerçek CV dışa aktarımı gibi duran dosyaları (`*.cveditor.json`, `*.resume.json`, `cveditor-yedek-*.json`, `e2e/fixtures` dışındaki PDF'ler, fotoğraflar) işaretler. Bulgu varsa `dosya:satır` listesi verir ve hata koduyla çıkar. Uydurma örnek kişi (Deniz Aksoy), `example.com` adresleri ve yer tutucu numaralar (`+90 555 000 00 00`) geçer; yanlış alarm, kontrolü gevşetmeden betikteki izin listesiyle ya da satıra `scan-personal: izin` yorumuyla çözülür.

Taramayı her push'ta kendiliğinden çalıştırmak için git kancasını **bir kez elle** kur (otomatik kurulmaz):

```bash
node scripts/install-hooks.mjs           # pre-push kancası kurar
node scripts/install-hooks.mjs --remove  # kaldırır
```

Gizli değerler (V3'teki yapay zekâ anahtarı vb.) yalnız sunucu tarafında, git dışındaki `.env` dosyasında durur; adları `.env.example`'da belgeli. Tarayıcıya giden kodda (`VITE_` önekli değişkenler dahil) anahtar olmaz.

## Lisans

MIT. Yazı tipleri SIL Open Font License 1.1 ile dağıtılır (`public/fonts`).
