# 10 şablon planı

> **Durum: onay bekliyor (2026-10-17).** Asil planı gördü, uygulamayı sonraya bıraktı. Uygulamaya başlamadan önce aşağıdaki 5 kararı Asil'e bir kez daha onaylat. Onaylamadığı bir maddeyi uygulama.

## Bu plan nereden geldi

- İlk turda 30 şablon önerildi. Çizilince hepsi aynı iskeletin ufak varyasyonları çıktı: üstte ad, çizgili küçük başlıklar, tek ya da iki sütun. Asil reddetti.
- İkinci turda 13 şablon sitesinde yaklaşık 390 gerçek tasarımın ekran görüntüsü incelendi: FlowCV, Enhancv, Kickresume, Novoresume, Resume.io, Canva, Reactive Resume, Overleaf, ResumeGenius, CVWizard, VisualCV, ResumeWorded, Behance/Dribbble. Görülenler 19 yapısal tipe ayrıldı. Küçük resimde birbirine en az benzeyen 10 tip seçildi. Asil: "Genel olarak önceye göre çok güzeller."
- Asil'in ek isteği: **fotoğraflı şablonlara öncelik ver.** Gerekçesi: "resim istemeyen kişi zaten resmi kaldırır, otomatik resimsiz olur."

## Dosyalar

| Dosya | Ne |
| --- | --- |
| `docs/sablonlar/PLAN.md` | Bu plan |
| `docs/sablonlar/sartname.md` | 10 şablonun ayrıntılı tarifi: geometri, renkler (hex), yazı tipleri, başlık ve kayıt düzeni, fotoğraf yoksa ne olur, ATS notları. Şablonlar buna göre kodlanır. |
| `docs/sablonlar/onizleme.html` | 10 şablonun bağımsız HTML önizlemesi. Tarayıcıda aç; fotoğrafsız hâl için adresin sonuna `#nophoto` ekle. Gerçek şablonlar bu görünüme benzemeli. |
| `docs/sablonlar/referanslar.local/` | **Git dışında** (`*.local`), yalnız bu bilgisayarda. Ticari sitelerin ekran görüntüleri (`sheet-*.png`, `detail-A…E.png`), önizlemelerin PNG'leri (`onizleme/p-*.png`, `onizleme/sheet-mock*.png`). Telif yüzünden repoya girmez. Klasör yoksa `onizleme.html`'den PNG yeniden üretilebilir. |

## Seçilen 10 şablon

| id | Ad | Onu farklı kılan | Fotoğraf |
| --- | --- | --- | --- |
| `zarif` | Zarif | Ortalı klasik tırnaklı yazı (EB Garamond), fildişi kâğıt, başlıkların iki yanında ince çizgi; renk bloğu yok | Adın üstünde, ortada daire (eklenecek) |
| `panel` | Panel | Solda sayfa boyu koyu lacivert sütun (%34), ad beyaz zeminde (Inter) | Koyu sütunun üstünde halkalı daire |
| `bant` | Bant | Kenardan kenara renkli başlık bandı, ad bandın içinde beyaz (Poppins + Source Sans 3) | Bandın alt kenarını kesen büyük daire, sağda |
| `manset` | Manşet | İki satıra yayılan dev display serif ad (~72 pt, DM Serif Display + Archivo), kalın siyah çizgi | Gri tonlu dikdörtgen, sağda |
| `gece` | Gece | Bütün sayfa koyu, içinde ince fildişi çerçeve, büyük harfli Playfair ad, altın başlıklar | Daire, solda |
| `isvicre` | İsviçre | Başlıklar solda etiket sütununda (%27), çok ince ad, kırmızı dikey çizgi, eş aralıklı tarihler (IBM Plex Sans + Mono) | Etiket sütununda kare (eklenecek) |
| `cizelge` | Çizelge | Soldan aşağı inen turuncu zaman çizgisi, noktalar ve halkalar, renkli tarih etiketleri (Manrope) | Adın solunda daire (eklenecek) |
| `cift` | Çift Ton | Beyaz alan yok: açık lavanta sol (%37), koyu çivit sağ; koyu tarafta beyaz ad (Space Grotesk) | Açık tarafta büyük daire |
| `afis` | Afiş | Siyah-beyaz, 900 ağırlıklı büyük harfli ad, sarı fosforlu vurgu, siyah kutulu başlıklar (Archivo) | Gri tonlu dikdörtgen, sağda |
| `cerceve` | Çerçeve | Sayfa çevresinde 6,5 mm renkli çerçeve ve ince iç çizgi, krem zemin, italik Fraunces başlıklar | Köşesi yuvarlatılmış dikdörtgen, solda |

## Onay bekleyen 5 karar

1. **Fotoğraf önce.** 10 şablonun hepsinde tasarlanmış bir fotoğraf yeri olur. Zarif, İsviçre ve Çizelge'nin önizlemesinde fotoğraf yok; onlara `sartname.md`'deki "açılırsa" tarifine göre eklenir.
   - `showPhoto` varsayılanı `true` olur. Fotoğraf yüklenince görünür; kaldırılınca düzen kendiliğinden fotoğrafsız hâle geçer. Fotoğrafsız hâller önizlemede hazır.
   - Editörde fotoğraf yokken önizlemede kesik çizgili "Fotoğraf ekle" kutusu görünür. Bu kutu yalnız ekranda olur: PDF'e basılmaz, ATS metnine girmez (mevcut `.ph` yer tutucuları gibi baskıda gizli).
   - Galeri ve şablon küçük resimlerindeki örnek CV, fotoğraf yerinde çizilmiş bir silüet kullanır. Gerçek ya da yapay üretilmiş yüz kullanılmaz; `onizleme.html`'deki SVG silüet örnek alınabilir.
   - Bu, vault'taki "fotoğraf isteğe bağlı, varsayılan kapalı" kararını (2026-10-15) değiştirir. Onaylanınca `knowledge/concepts/cv-editor.md`'ye işle.
2. **Klasik → Zarif, Modern → Panel.** Ayrı kalırlarsa yine "aynı iskelet" sorunu doğar.
   - Şema göçüyle mevcut CV'ler yeni karşılıklarına geçer: `CURRENT_SCHEMA_VERSION` artar, `src/cv/migrate.ts`'e göç eklenir, Dexie'ye yeni `version()` eklenir ve eskisi silinmez.
   - İçerik değişmez, görünüm değişir.
3. **Şablon başına desteklenen sütun düzeni.**
   - Panel ve Çift Ton yalnız 2 sütun; Zarif, Gece, İsviçre ve Çizelge yalnız 1 sütun.
   - Bant, Manşet, Afiş ve Çerçeve'nin varsayılanı 2 sütun; tek sütun desteklenir mi, şartnameye ve ekran görüntüsüne göre karar ver.
   - Görünüm sekmesi tek düzenli şablonda sütun seçeneğini gizler. `DESIGN.md`'deki "her şablon tek ve iki sütun" kuralı buna göre güncellenir.
4. **Kategori yok.** 10 şablon tek ekrana sığar. Kartlarda küçük etiketler kullanılır: "İki sütun", "Koyu zemin".
5. **Fotoğraf sağda** (Bant, Manşet, Afiş).
   - Yalnız fotoğraf grid yerleşimiyle sağa taşınır (`sartname.md` §3, ortak teknik 3). Metin DOM sırası değişmez.
   - `order`, `*-reverse` ve metne `position:absolute` yine yasak.

## Kullanılacaklar

- **Mevcut çizim motoru** (`src/render`): `CvMarkup.tsx` → `paginate.ts` → `CvFrame.tsx`. Şablon = `templates.ts`'te ayar + `styles/<id>.css`. Önizleme = PDF garantisi korunur.
- **9 yeni yazı tipi:** EB Garamond, Poppins, DM Serif Display, Archivo, Playfair Display, IBM Plex Mono, Manrope, Space Grotesk, Fraunces.
  - Hepsi açık lisanslı ve latin-ext alt kümesiyle Türkçe karakterleri (ğ ş İ ı) destekler; bu araştırmada doğrulandı.
  - `scripts/copy-fonts.mjs` ile değişken olmayan `@fontsource/<ad>` paketlerinden **statik ağırlık** dosyaları alınır. Değişken dosyalar PDF'e Type3 olarak basılır.
  - Yalnız kullanılan ağırlıklar alınır. Her ailenin lisansı `public/fonts/LICENSE-<ad>.txt`'ye kopyalanır.
  - Başlık ailesi şablon CSS'inden gelir; gövde ailesi Görünüm'deki seçimdir. Yeni şema alanı açmadan çözmeyi dene.
- **Renk takımları:** her şablonun 3-4 uyumlu takımı olur (`sartname.md`'deki "Seçenekler"). Serbest renk seçimi kalır.
  - Türetilen token'lar: `--on-accent` (WCAG kontrastına göre beyaz ya da koyu), koyu ve açık tonlar.
  - Kontrast koruması: kullanıcı rengi metin için 4.5:1'in altında kalırsa metin rengi ayarlanır.
- **Tam boy renkli sütun ve zeminler** `.page` arka planıyla (gradyan) yapılır. Böylece paginate'in ürettiği her sayfada tekrar eder. `print-color-adjust: exact` ile PDF'e basılır.
- **Koyu zeminli şablonlar** (Gece, Çift Ton, Panel'in sol sütunu): yapay zekâ öneri vurguları (`sg-added`/`sg-removed`) koyu zeminde de okunur olmalı.
- **ATS testi** (`e2e/ats.spec.ts`): matris `TEMPLATE_LIST`'ten ve her şablonun desteklediği sütun düzenlerinden kurulur, fotoğraflı ve fotoğrafsız çalışır.
  - Denetlenenler: PDF metniyle okuma sırası, Türkçe karakterler, gömülü TrueType (Type3 yok), harf aralığı ≤ 0.05em, iletişimin başlıkta olması, önizleme = PDF sayfa sayfa.
  - Testten geçmeyen şablon eklenmez. Toplam e2e süresi makul tutulur; gerekirse matris bölünür.
- **JSON Resume kaldırılır** (Asil, 2026-10-17). Dokunulacak dosyalar:
  - `src/cv/jsonResume.ts`, `src/cv/jsonResume.test.ts`
  - `src/features/import/JsonResumeImport.tsx`
  - `src/features/templates/NewCvDialog.tsx` (başlangıç seçeneği)
  - `src/features/editor/EditorPage.tsx`, `src/features/cv-list/CvListPage.tsx`, `src/features/cv-actions.ts` (dışa aktarma menüleri)
  - `messages/*.json` (`imp_json*` anahtarları)
  - e2e: `import.spec.ts`'teki JSON Resume testleri
  - README, `docs/DURUM.md`
  - Ayarlar'daki **yedek dosyası kalır**.

## Çalışma sırası ve ajanlar

Bütün ajanlar için kurallar:
- git'e yazma yok.
- `CLAUDE.md` ve `DESIGN.md`'yi önce oku.
- Mesaj dosyalarında küçük, hedefli düzenleme yap; sonra Paraglide'ı derle.
- Playwright'ı kendi `--output=<ayrı klasör>`'üyle çalıştır.
- `playwright.config.ts`'i değiştirme.

### 1. aşama: altyapı (2 ajan, aynı anda)

**Altyapı ajanı.** Bundan sonraki her şey bunun üstüne kurulur.
1. `templates.ts`: 10 şablonun kaydı.
   - `TemplateDef`'e eklenecekler: ad ve açıklama mesaj anahtarı, desteklenen sütunlar, renk takımları, etiketler.
   - `TemplateId` kayıttan türetilir.
   - Her şablon için boş `styles/<id>.css` açılır. 2. aşamadaki ajanlar yalnız kendi CSS dosyalarına dokunur.
2. Klasik/Modern → Zarif/Panel şema göçü ve Dexie sürümü, testleriyle.
3. 9 yazı tipi: `copy-fonts.mjs`, `@font-face`, lisanslar.
4. Renk takımları, türetilen token'lar, kontrast koruması (`renderCv.ts`).
5. Fotoğraf: `showPhoto` varsayılanı, editördeki baskıda gizli "Fotoğraf ekle" kutusu, galeri silüeti.
6. Görünüm sekmesi: şablon başına sütun seçeneği, renk takımları, koyu zemin mürekkep notu.
7. Galeri (`TemplatesPage`): 10 kart, etiketler. Galeri düzenini `DESIGN.md`'ye göre güncelle.
8. Şablonların ortak ihtiyaç duyduğu küçük markup kancaları. Örnek: Afiş'in fosforlu adı için `.cv-name` içinde iç `span`, Çizelge için ad ve iletişimi saran öğe. Bunları 1. aşamada ekle ki 2. aşama yalnız CSS olsun.
9. Koyu zeminde öneri vurgu renkleri.

**Temizlik ajanı.** JSON Resume'yi kaldırır (yukarıdaki dosya listesi). Dokunduğu dosyalar altyapı ajanınınkilerden ayrı tutulur. `NewCvDialog` ikisinin ortak dosyası olabilir: hedefli düzenleme yap, değişmişse yeniden oku.

### 2. aşama: şablonlar (4 ajan, aynı anda; yalnız kendi CSS dosyaları)

| Ajan | Şablonlar | Ortak tekniği |
| --- | --- | --- |
| A | Zarif, Panel, Çift Ton | Tam boy renkli sütun, başlığı sütun çizgisine hizalama, ortalı klasik |
| B | Bant, Manşet, Afiş | Güçlü başlık, sağda fotoğraf, dev ad (uzun adda küçülme), fosforlu vurgu |
| C | Gece, Çerçeve | Sayfa zemini, iç çerçeve, kenarlığın sayfa kapasitesine etkisi |
| D | İsviçre, Çizelge | Sıfır yükseklikli etiket başlığı (absolute/float yok), omurga ve noktalar |

Her ajan, her şablonunda şunları yapar:
- `sartname.md`'deki tarifi uygular. Gerçek editörün ekran görüntüsünü `referanslar.local/onizleme/p-<id>.png` ile yan yana koyup karşılaştırır.
- Şu durumları dener:
  - fotoğraflı ve fotoğrafsız
  - 1, 2 ve 3 sayfalık CV
  - bir sayfadan uzun kayıt (maddeler arasından bölünme)
  - Türkçe ve İngilizce CV (büyük harfte İ/I)
  - uzun ad-soyad
  - boş CV
  - arayüzün açık ve koyu teması
  - masaüstü ve 390 px önizleme
- Kendi şablonlarının `ats.spec.ts` testlerini geçirmeden işi bitmiş saymaz.

### 3. aşama: birleştirme ve doğrulama (koordinatör + 1 inceleme ajanı)

1. Tam tur: `npm run check`, `npm run build`, `npm run scan`.
2. 10 şablonun gerçek çıktısını tek sayfada `onizleme.html` ile karşılaştır, Asil'e göster.
3. Bağımsız kod incelemesi yaptır. Öncelik: ATS, sayfalama, göç, gizlilik. Bulguları düzelt, tam turu yeniden çalıştır.
4. Belgeleri güncelle: `DESIGN.md` (şablon ve galeri kuralları), `CLAUDE.md`, `docs/DURUM.md`, README, vault notu ve receipt.
5. Commit ve push yalnız Asil isterse.

## Riskler

- **Sayfalama.** Üç şablon sayfa kapasitesini etkileyebilir:
  - Çerçeve'nin kenarlığı
  - Bant'ın banttan taşan fotoğrafı (`margin-bottom` ile)
  - İsviçre'nin sıfır yükseklikli etiketi
  - Her biri için 2-3 sayfalık test yazılır. "Kayıt sığıyorsa bölünmez, başlık sayfa dibinde yalnız kalmaz" kuralı korunur.
- **Mürekkep.** Gece ve Çift Ton sayfayı baştan sona renkle kaplar. Ekranda ve PDF'te sorun yok; kâğıda basınca çok mürekkep harcar. Görünüm'de kısa bir not olur.
- **Uzun adlar.** Manşet ve Afiş'in dev adı uzun ad-soyadda kendiliğinden küçülür, örneğin 24 karakterden sonra.
- **Serif bağ harfleri.** EB Garamond ve Fraunces'te "fi" gibi bağ harfleri PDF metninde bozuk çıkabilir; ATS testinde denetlenir.
- **Test süresi.** Matris büyür. Tam e2e turu 5 dakikanın altında kalmalı.
