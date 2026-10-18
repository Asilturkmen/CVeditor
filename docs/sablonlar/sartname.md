# CVeditör: 10 şablon, birbirinden gerçekten farklı (görsel araştırma)

Tüm yollar bu klasöre göre:
`C:\Users\turkm\AppData\Local\Temp\claude\C--Users-turkm-GitHub-CVeditor\26c0ee33-58f7-4c0d-8923-9bac36633104\scratchpad\visual\`

## 0. Yöntem ve kanıt

- Playwright ile 13 galeri tarandı. Her sitenin önizleme görselleri indirilip 15'li **kontak sayfalarına** (`sheet-<site>-N.png`, küçük resim boyutunda 280 px genişlik) dizildi, sonra tek tek bakıldı. Toplam yaklaşık **390 önizleme** tarandı: FlowCV 26, Enhancv 33, Kickresume 33, Novoresume 51, Resume.io 68, Canva 50, Reactive Resume 17, Overleaf 12, ResumeGenius 25, CVWizard 12, VisualCV 36, ResumeWorded 29; artı Behance ve Dribbble arama ekranları (`behance-0N.png`, `dribbble-0N.png`). Zety, LiveCareer ve MyPerfectResume HTTP/2 hatasıyla engelledi.
- Seçilen arketip örnekleri ayrıntı için büyütüldü: `detail-A.png` … `detail-E.png` (her biri 6 tasarım, 460 px).
- Önerilen 10 şablon, **bizim çizim DOM'umuzla** (`header.cv-header > img.cv-photo + .cv-identity(h1.cv-name, p.cv-headline, ul.cv-contact)`, `.page-body > .col-side + .col-main`, `h2.section-title`, `.entry > .entry-head(.entry-title,.entry-date) + .entry-sub + .entry-body`) uydurma kişiyle örnek olarak kuruldu: `docs/sablonlar/onizleme.html`. Çıktılar `docs/sablonlar/referanslar.local/onizleme/p-<id>.png` (fotoğraflı), `docs/sablonlar/referanslar.local/onizleme/p-<id>-nophoto.png` ve küçük resim sayfaları `docs/sablonlar/referanslar.local/onizleme/sheet-mock.png` ile `docs/sablonlar/referanslar.local/onizleme/sheet-mock-nophoto.png`. **Önce `docs/sablonlar/referanslar.local/onizleme/sheet-mock.png`'ye bakın**: 10 şablon 290 px'te bile birbirine benzemiyor.
- Kaynak kodundaki DOM sırası kurallarına uyuldu: `order`, `*-reverse` ya da metinde `position:absolute` yok. Fotoğrafı sağa almak için yalnız **görsel** (metinsiz `<img>`) `grid-column` ile yerleştirildi; okuma sırası değişmiyor. (`ats.spec.ts` `order` ve `reverse` kurallarını denetliyor, metinsiz görselin grid yerleşimini denetlemiyor. Yine de ekip bunu bilerek kabul etmeli.)

## 1. Görülen yapısal arketipler (kümeleme)

| # | Arketip | Küçük resimde tanınma | Örnek (kontak sayfası #sıra) |
|---|---|---|---|
| A | Tam boy koyu sol yan sütun + yuvarlak foto | Solda koyu dikey blok | flowcv-1 #1 #13, flowcv-2 #17, canva-1 #1 #2, canva-3 #41, canva-1 #11 (bordo, çapraz kesik), novoresume-2 #23, enhancv-1 #6 |
| B | Sağda dar koyu yan sütun | Sağda koyu şerit | enhancv-1 #3, enhancv-2 #16, resumeio-2 #17–21, novoresume-1 #10 |
| C | Tam genişlik renkli üst bant | Üstte renkli blok | flowcv-1 #15, enhancv-1 #9, kickresume-1 #6 #22, overleaf #7, novoresume-1 #8 (V kesikli alt kenar) |
| D | Bandın kenarına taşan büyük yuvarlak foto | Bant + bant sınırını kesen daire | canva-2 #22, novoresume-1 #6 #11, canva-1 #10 |
| E | Ortalanmış klasik serif, fildişi kâğıt | Ortada ad, krem zemin, ince çizgiler | enhancv-1 #4 #7, enhancv-2 #23, flowcv-1 #4, resumegenius #2 |
| F | Sol etiket sütunu (İsviçre/Europass) | Solda küçük başlıklar, sağda içerik, yatay ince çizgiler | overleaf #4, resumeio-3 #31–35, kickresume-1 #6, resumeio-4 #48 |
| G | Omurgada zaman çizelgesi | Dikey çizgi + noktalar | enhancv-1 #8, enhancv-2 #17 #19, canva-2 #23 #27, canva-1 #1 |
| H | Dev editoryal ad (display serif ya da grotesk) | Sayfanın üstte 1/6'sı kocaman ad | resumeio-3 #36, resumeio-4 #47, resumeio-2 #30, behance-02 (Mariana da Silva), behance-01 (Alan Querin) |
| I | Tam sayfa koyu/doygun renk | Bütün sayfa renkli | resumeio-3 #41–45, resumeio-4 #48–52, kickresume-1 #12, kickresume-2 #21 |
| J | İki tonlu dikey bölünme (iki sütun da renkli) | Açık ton + koyu ton, beyaz yok | flowcv-2 #20, canva-3 #45 |
| K | Tek renk, kalın siyah etiket/çubuk | Siyah şeritler alt alta | cvwizard #12, resumeio-3 #36, resumeio-2 #29 |
| L | Koyu dar ray + hizalı etiketler | Solda ince siyah ray | kickresume-1 #10 |
| M | Çerçeveli sayfa | Kenarda renkli çerçeve | flowcv-2 #16, novoresume-1 #7, kickresume-3 #33 |
| N | Foto + renkli karo başlık | Sol üstte kare foto ve yanında renkli karo | resumeio-1 #11–14, resumeio-2 #29 |
| O | Asimetrik şekiller ve damlalar | Köşelerde büyük daire ve lekeler | kickresume-1 #3 #4, resumeio-5 #62–66, resumeio-4 #54, cvwizard #1 |
| P | Çapraz kesikler | Eğik blok | canva-1 #11 #14, canva-1 #10, canva-3 #37 |
| Q | Yoğun tek sayfa ATS | Gri metin duvarı | enhancv-1 #1 #5, overleaf #12, resumeio-1 #5 |
| R | Numaralı bölümler ya da "Merhaba, ben…" girişi | Büyük selam cümlesi | resumeio-3 #37, resumeio-2 #30 |
| S | Daktilo/mono | Mono metin, krem zemin | behance-01 (Minori) |

Önceki turun 30 şablonunun hepsi aslında **Q, E ve A'nın açık tonlu hâli** sayılırdı. Bu yüzden birbirine benzediler.

## 2. Seçilen 10 şablon ve neden en farklı bunlar

Küçük resimde ayırt ettiren beş eksen: **renk kütlesinin yeri**, **sütun geometrisi**, **başlık işlemi**, **yazı tipi türü** ve **süsleme dili**.

| id | Ad | Renk kütlesi | Geometri | Başlık | Yazı tipi türü | Foto |
|---|---|---|---|---|---|---|
| zarif | Zarif | Yok (fildişi kâğıt) | 1 sütun, ortalı | Ortalı serif ad | Garalde serif | Yok |
| panel | Panel | Sol %34 koyu, tam boy | 2 sütun | Sağ hücrede ad, solda foto | Nötr grotesk | Daire, koyu zeminde |
| bant | Bant | Üstte tam genişlik bant (~%17) | 2 sütun, yan kart | Bandın içinde beyaz ad | Geometrik sans | Bandı kesen daire |
| manset | Manşet | Siyah dev ad + kalın çizgi | 2 sütun, editoryal | ~70 pt display serif, 2 satır | Display serif + grotesk | Gri tonlu dikdörtgen |
| gece | Gece | Bütün sayfa koyu | 1 sütun, ince çerçeve | Büyük harfli serif, altın etiket | Serif display + sans | Daire |
| isvicre | İsviçre | Neredeyse yok (kırmızı dikey çizgi) | Sol etiket sütunu %27 | Hafif (300) grotesk ad | Grotesk + mono | Yok |
| cizelge | Çizelge | İnce turuncu omurga | 1 sütun + omurga | Solda ad, sağda dikey iletişim | Yuvarlak geometrik | Yok |
| cift | Çift Ton | Bütün sayfa: açık sol, koyu sağ | 2 sütun, iki tonlu | Koyu hücrede beyaz ad, açık hücrede foto | Teknik grotesk | Büyük daire |
| afis | Afiş | Siyah etiketler + sarı fosforlu vurgu | 2 sütun | Kocaman büyük harf, fosforlu | Kalın grotesk (900) | Gri tonlu dikdörtgen |
| cerceve | Çerçeve | Sayfa kenarında 6,5 mm çerçeve | 2 sütun | Serif ad + italik unvan | Yumuşak serif + humanist sans | Köşesi yuvarlatılmış dikdörtgen |

Bilerek dışarıda bırakılanlar:
- **B (sağ sütun):** A'nın aynası, küçük resimde yeni bir yapı sayılmaz. Ayrıca bugünkü DOM'da `side` akışı `main`'den önce geliyor; sağa almak için ya `order`/`row-reverse` (yasak) ya da çizim motorunda şablon başına akış sırası seçeneği gerekir.
- **L (ray):** küçük resimde Panel'e çok benziyor. İsviçre'nin bir renk seçeneği olabilir (etiket sütununu koyu yapmak).
- **N (karo):** Bant'la aynı yerde renk kütlesi oluşturuyor.
- **O ve P (şekiller, çaprazlar):** üstteki 10 şablondan birine "süs seçeneği" olarak eklenebilir; tek başına yapı farkı yaratmıyor. Metinle çakışma riski de var.
- **Kartlar/bento:** proje kurallarındaki "anlamsız bento" yasağına yakın.
- **Q (kompakt):** şablon değil, yoğunluk ayarı. Mevcut `spacing: compact` bu işi görüyor.

## 3. Ortak teknikler (bütün şablonlar için)

1. **Tam boy renkli sütun.** `.tpl-X .page { background: linear-gradient(90deg, SIDE 0 34%, PAPER 34%) }`. Renk her sayfada baştan sona uzanır; paginate'in ürettiği 2. sayfada da çalışır, çünkü `#cv-pages` `tpl-X` sınıfını taşıyor. `--side-width` ile aynı yüzde kullanılmalı.
2. **Başlığı sütun çizgisine hizalamak.** `.cv-header { display:grid; grid-template-columns: 34% 1fr; padding:0 }`, `.cv-identity { grid-column:2 }`. Foto yoksa **sağ hücre yine 2. sütunda kalmalı**. Örnekte bu atlanınca ad koyu zemine düşüp okunmaz oldu; düzeltildi, `docs/sablonlar/referanslar.local/onizleme/p-panel-nophoto.png` ile karşılaştırın. Başlık DOM'da ilk sırada kalır; iletişim bilgisi başlığın içinde.
3. **Fotoyu sağa almak.** `.cv-header{display:grid;grid-template-columns:1fr auto}`, `.cv-identity{grid-column:1;grid-row:1}`, `.cv-photo{grid-column:2;grid-row:1}`. Yalnız görsel taşınır, metin sırası aynı kalır.
4. **Sol etiket sütunu (İsviçre).** `h2.section-title { width: var(--label); height:0; overflow:visible; padding-top:2.4mm; box-sizing:content-box; text-align:right }`. Diğer bloklar `margin-left: var(--label)` alır. Tam genişlik ince çizgiyi, metinsiz bir `::before` (width: sütun genişliği, `border-top`) ya da `border-top` çizer. `.section-title + * { min-height: 2lh }` iki satıra kırılan etiketin bir sonraki bölüme taşmasını önler. Absolute ya da float yok. y'ye göre sıralanmış PDF metninde etiket ile ilk kaydın başlığı aynı satıra düşer, etiket solda kalır; sıra korunur.
5. **Süsler.** Noktalar, çizgiler, çubuklar her zaman `content:''` olan sözde öğeler ya da `background`/`border` ile yapılır. Metin taşıyan öğe hiçbir zaman absolute olmaz.
6. **Beceri ve dil gösterimi** her şablonda yalnız metin: "Etiket: değerler" satırı, ` · ` ile ayrılmış satır içi liste ya da metin "çip"leri (kenarlıklı span). Çubuk, yıldız, nokta veya yüzde yok.
7. **Yazı tipleri.** Hepsinin `latin-ext` alt kümesi var (ğ ş İ ı); Google Fonts CSS'inde `U+0100-02BA` aralığı tek tek doğrulandı. **Statik ağırlık** dosyaları Fontsource'un değişken olmayan paketlerinden (`@fontsource/<ad>`) ya da `npm run fonts` betiğiyle alınmalı. Değişken dosya kullanılmamalı, PDF'e Type3 olarak basılıyor. Repoda zaten olanlar: Inter, IBM Plex Sans, Source Serif 4, Literata, Source Sans 3. Yeni gerekenler: EB Garamond, Poppins, DM Serif Display, Archivo, Playfair Display, IBM Plex Mono, Manrope, Space Grotesk, Fraunces.
8. **Harf aralığı** en fazla 0.05em. Büyük harfli küçük başlıklar tam 0.05em, dev adlar eksi değer alır.

Ölçüler: A4 210×297 mm, `--fs` gövde punto değeri, ad boyutu "× gövde" olarak verildi.

---

## 4. Şablon şartnameleri

### 1) Zarif (`zarif`): ortalı klasik serif, fildişi kâğıt
- **Tanınma:** krem sayfa, ortada zarif serif ad, bölüm başlıklarının iki yanında ince çizgiler, italik ortalı özet. Renk kütlesi yok, en "sessiz" şablon.
- **Geometri:** tek sütun, yan boşluk 18 mm, üst 13 mm.
- **Renkler:** kâğıt `#fbf8f1`, metin `#2b2621`, soluk metin `#756c60`, vurgu (bordo) `#7a2e2e`, çizgi `#d8cdb9`. Vurgu seçenekleri: lacivert `#1f3a5f`, orman yeşili `#2f5d50`.
- **Yazı tipi:** EB Garamond 400/500/600 + italik; gövde 10.6 pt, satır aralığı 1.32 (Garamond küçük görünür, bu yüzden punto yüksek). Yedek: Source Serif 4 (repoda).
- **Başlık:** ortalı. Ad 500 ağırlık, gövdenin 3.1 katı, +0.01em. Unvan büyük harf, 0.05em, 0.82×, vurgu renginde. İletişim tek satır, ` · ` ile ayrılmış, 0.9×, soluk. Başlığın altında tam genişlikte 0.3 mm `#d8cdb9` çizgi.
- **Bölüm başlığı:** büyük harf, 0.8×, 600 ağırlık, 0.05em, vurgu renginde, ortalı. Solda ve sağda `flex:1` ince çizgi (metinsiz `::before/::after`).
- **Kayıt:** başlık 600 solda, tarih italik sağda; alt satır (kurum · yer) italik soluk; maddeler.
- **Beceri ve dil:** ortalı satır içi liste, ` · ` ayraçlı.
- **Foto:** yok (isteğe bağlı açılırsa ortada adın üstünde 24 mm daire).
- **Yoğunluk:** orta.
- **Referans:** `detail-B.png` (enhancv#4, sağ alt), `sheet-enhancv-1.png` #4 #7, `sheet-enhancv-2.png` #23, `sheet-flowcv-1.png` #4.
- **Örnek:** `docs/sablonlar/referanslar.local/onizleme/p-zarif.png`.
- **ATS:** en güvenli şablon. Çizgiler metinsiz sözde öğe.

### 2) Panel (`panel`): tam boy koyu sol sütun + yuvarlak foto
- **Tanınma:** sayfanın sol üçte biri baştan sona lacivert; üstte halkalı yuvarlak foto; sağda beyaz alanda ad.
- **Geometri:** `--side-width:34%`; `.page` arka planı `linear-gradient(90deg,#1f2a37 0 34%,#fff 34%)`. Başlık 34% / 1fr ızgara (bkz. ortak teknik 2).
- **Renkler:** yan sütun `#1f2a37`, yan metin `#e6ebf1`, yan soluk `#9babbd`, ana metin `#1c2430`, soluk `#5d6b7c`, vurgu (deniz yeşili) `#2f8f7f`. Seçenekler: orman `#1e3a2f` + `#c9a45c`, bordo `#4a1f2a` + `#e0a96d`, kömür `#22252a` + `#5aa9e6`.
- **Yazı tipi:** Inter 400/500/600/700, gövde 8.8 pt.
- **Başlık:** foto 34 mm daire, sol hücrede ortalı, `outline:1.2mm solid rgba(255,255,255,.14); outline-offset:1.2mm`. Ad 700 ağırlık, 2.6×, −0.02em; unvan vurgu renginde 600, 1.1×. İletişim **iki sütunlu ızgara** (ayraçlar gizli), 0.92×, soluk.
- **Bölüm başlığı (yan):** beyaz, büyük harf, 0.86×, 700, 0.05em, altında 0.3 mm `rgba(255,255,255,.18)` çizgi.
- **Bölüm başlığı (ana):** büyük harf, 0.9×, 700, solunda 5×0.9 mm vurgu çubuğu (`::before`).
- **Kayıt:** ana sütunda başlık 600, kurum satırı vurgu renginde 500, tarih sağda soluk. Yan sütunda `line-label` blok (beyaz), değer alt satırda.
- **Beceri ve dil:** yan sütunda "Etiket" kalın beyaz, alt satırda değer metni.
- **Foto yoksa:** sol üst hücre boş kalır, koyu panel yine sürer ve tasarım bitmiş görünür (`docs/sablonlar/referanslar.local/onizleme/p-panel-nophoto.png`).
- **Çeşitleme:** üstte çapraz kesik (canva#11) `clip-path`'li metinsiz bir arka plan katmanıyla yapılabilir.
- **Referans:** `detail-B.png` (flowcv#1, alt orta), `detail-D.png` (canva#1, sol alt), `sheet-flowcv-1.png` #1 #13, `sheet-canva-1.png` #11.
- **Örnek:** `docs/sablonlar/referanslar.local/onizleme/p-panel.png`.
- **ATS:** iletişim başlıkta (yan sütunda değil). DOM sırası başlık → yan → ana; bugünkü test bunu bekliyor.

### 3) Bant (`bant`): tam genişlik renkli bant + bandı kesen foto
- **Tanınma:** üstte koyu mavi blok, içinde beyaz ad; sağda bandın alt kenarını kesen beyaz halkalı büyük daire foto; altta açık mavi yuvarlak köşeli yan kart.
- **Geometri:** başlık tam genişlikte, iç boşluk 13/14/11 mm, `margin-bottom` = taşma + 3 mm. Gövdede yan sütun %31; yan sütun bir kart: `#eef5f9`, köşe 2 mm, iç boşluk 5 mm, `align-self:flex-start`.
- **Renkler:** bant ve vurgu `#0f4c75`, metin `#1d2939`, soluk `#667085`, kart `#eef5f9` (soluk metin ≥ 4.5:1 için; ilk taslakta `#eef4f9` 4.49:1 idi). Seçenekler: zümrüt `#0b5d4b`, mürdüm `#5b2a4e`, grafit `#2b2f36`.
- **Yazı tipi:** başlık ve bölüm başlıkları Poppins 600/700, gövde Source Sans 3 400/600/700 (9.6 pt).
- **Başlık:** ad Poppins 700, 2.7×, beyaz; unvan Poppins 500, %88 opaklık; iletişim tek satır, beyaz %86. Foto 38 mm daire, 1.6 mm beyaz kenar, ızgaranın 2. sütununda, `align-self:end; margin-bottom:-12mm` ile banttan dışarı taşar. Taşma `margin-bottom` olduğundan absolute yok.
- **Bölüm başlığı:** Poppins 600, 1.12×, vurgu renginde; altında 8×0.9 mm kısa çubuk (`background` ile).
- **Kayıt:** başlık 700, kurum vurgu renginde, tarih sağda soluk.
- **Beceri ve dil:** kartın içinde "Etiket: değer" satırları.
- **Foto yoksa:** bant sade kalır, sağ taraf boşalır, yine bitmiş görünür (`docs/sablonlar/referanslar.local/onizleme/p-bant-nophoto.png`).
- **Çeşitleme:** bandın alt kenarı V/şerit kesikli (novoresume#8), metinsiz arka plan katmanında `clip-path` ile.
- **Referans:** `detail-D.png` (novoresume#6, sağ alt), `detail-C.png` (canva#22, sol alt; novoresume#8, üst orta), `sheet-flowcv-1.png` #15, `sheet-enhancv-1.png` #9.
- **Örnek:** `docs/sablonlar/referanslar.local/onizleme/p-bant.png`.
- **ATS:** beyaz metin koyu zeminde; PDF'te seçilebilir. Taşan foto metnin üstüne binmesin diye özet sütunu en az 3 mm aşağıdan başlar.

### 4) Manşet (`manset`): dev editoryal ad
- **Tanınma:** sayfanın üst 1/5'ini kaplayan iki satırlık siyah display serif ad; altında 0.7 mm siyah çizgi; özet büyük serif "giriş paragrafı" olarak.
- **Geometri:** başlık yatay boşluğu 14 mm; altında tam genişlikte 0.7 mm `#111` çizgi. Gövdede yan sütun %31, ana sütun kalan.
- **Renkler:** kâğıt `#fff`, metin `#111`, soluk `#666`, vurgu (yanık turuncu) `#c2410c` yalnız unvanda. Seçenekler: kırmızı `#b91c1c`, mavi `#1d4ed8`.
- **Yazı tipi:** ad ve özet DM Serif Display 400; etiketler ve gövde Archivo 400/700/800 (8.6 pt).
- **Başlık:** ad 8.4× (~72 pt), satır aralığı 0.88, −0.02em, `max-width:112mm` (ad ile soyad iki satıra düşer). Unvan büyük harf, 0.05em, 700, vurgu renginde. İletişim tek satır. Foto 36×46 mm, gri tonlu (`filter:grayscale(1)`), sağda (ortak teknik 3).
- **Bölüm başlığı:** Archivo 800, büyük harf, 0.85×, 0.05em, üstünde 0.25 mm siyah çizgi.
- **Özet:** DM Serif Display, 1.55×, satır aralığı 1.22.
- **Kayıt:** başlık 700, kurum soluk, tarih sağda.
- **Beceri ve dil:** yan sütunda "Etiket" (blok) + değer.
- **Foto yoksa:** ad tüm genişliğe yayılır, daha da güçlü durur.
- **Referans:** `detail-E.png` (resumeio#47, üst orta), `detail-A.png` (resumeio#36, sağ üst), `behance-02.png` (Mariana da Silva), `behance-01.png` (Alan Querin), `sheet-resumeio-2.png` #30.
- **Örnek:** `docs/sablonlar/referanslar.local/onizleme/p-manset.png`.
- **ATS:** ad tek `h1`, satıra kırılması doğal sarma. Uzun adlarda boyut `clamp` ya da şablon ayarıyla küçülür (örn. 24 karakterden sonra 6.4×).

### 5) Gece (`gece`): tam sayfa koyu, ince çerçeveli
- **Tanınma:** bütün sayfa gece mavisi; 7 mm içeride fildişi ince çerçeve; büyük harfli serif ad; altın renkli küçük etiketler.
- **Geometri:** `.page-inner { margin:7mm; border:.3mm solid rgba(236,230,217,.28) }`. Tek sütun, iç yatay boşluk 11 mm. Başlığın altında aynı ince çizgi tam genişlikte.
- **Renkler:** kâğıt `#14171f`, metin `#ece6d9`, soluk `#a39b8b`, vurgu (altın) `#d4a85a`, çizgi `rgba(236,230,217,.28)`. Seçenekler: zemin `#0f2a24` + `#e2b866`, zemin `#2a1420` + `#e8b4a0`. Açık renk isteyen kullanıcı için resumeio#48–52'deki doygun zeminler (`#2340c9`, `#f6e36b`) de olur; açık zeminde metin rengi `#111` yapılır.
- **Yazı tipi:** ad ve özet Playfair Display 400/700; gövde Inter 400/600 (8.7 pt).
- **Başlık:** foto 32 mm daire solda. Ad 700, büyük harf, 3.6×, satır aralığı 0.95, +0.01em. Unvan altın, büyük harf, 0.05em, 600. İletişim soluk tek satır.
- **Özet:** Playfair 400, 1.45×.
- **Bölüm başlığı:** altın, büyük harf, 0.82×, 600, 0.05em, üstünde ince çizgi (ilk bölümde çizgi yok, başlık çizgisiyle çift olmasın).
- **Kayıt:** başlık beyaz 600, madde imleri altın (`li::marker`).
- **Beceri ve dil:** satır içi, ` · ` ayraçlı.
- **Foto yoksa:** ad sola yaslanır (`docs/sablonlar/referanslar.local/onizleme/p-gece-nophoto.png`).
- **Referans:** `detail-A.png` (resumeio#41, sol üst; resumeio#48, üst orta), `detail-E.png` (kickresume#12, sol üst), `sheet-resumeio-3.png` #41–45, `sheet-resumeio-4.png` #48–52.
- **Örnek:** `docs/sablonlar/referanslar.local/onizleme/p-gece.png`.
- **ATS ve baskı:** metin rengi PDF'te seçilebilir, zemin `print-color-adjust:exact` ile basılır. Mürekkebi çok harcar; arayüzde "koyu zemin: yazıcı mürekkebi" uyarısı eklenebilir. Kontrast oranı 13:1'in üstünde.

### 6) İsviçre (`isvicre`): sol etiket sütunu, hafif grotesk
- **Tanınma:** solda sağa yaslı küçük büyük harfli etiketler, sağda içerik, her bölümde tam genişlik ince çizgi; adın solunda kırmızı dikey çizgi; bol beyaz alan.
- **Geometri:** `--label:27%` (ana sütun içinde). Etiketler sağa yaslı, sağ boşluk 6 mm; içerik `margin-left:27%`. Başlık da içerik sütununa hizalı (`padding-left` = yan boşluk + etiket genişliği). Üst boşluk 16 mm.
- **Renkler:** metin `#161616`, soluk `#6e6e6e`, vurgu (İsviçre kırmızısı) `#d62828`, çizgi `#d6d6d6`. Seçenekler: kobalt `#1f4fd1`, siyah `#161616`.
- **Yazı tipi:** IBM Plex Sans 300/500/600 (repoda), tarih ve iletişim IBM Plex Mono 400; gövde 8.8 pt.
- **Başlık:** `.cv-identity` için `border-left:1.1mm solid vurgu; padding-left:5mm`. Ad Plex Sans **300**, 3.2×, −0.02em. Unvan büyük harf, 0.05em, 500, soluk. İletişim mono, 0.86×.
- **Bölüm başlığı:** ortak teknik 4. Büyük harf, 0.8×, 600, 0.05em, sağa yaslı.
- **Kayıt:** başlık 600, kurum soluk, tarih sağda mono 0.82×.
- **Beceri ve dil:** "Etiket: değer" satırları, içerik sütununda.
- **Foto:** yok (açılırsa etiket sütununda adın hizasında 26 mm kare).
- **Çeşitleme:** "Ray" seçeneğinde (kickresume#10) etiket sütunu tam boy siyah (`.page` gradyanı) ve etiketler beyaz olur.
- **Referans:** `detail-C.png` (overleaf#4, sağ alt), `detail-B.png` (kickresume#6, sağ üst; kickresume#10, sol üst), `sheet-resumeio-3.png` #31–35.
- **Örnek:** `docs/sablonlar/referanslar.local/onizleme/p-isvicre.png`.
- **ATS:** float ya da absolute yok; etiket h2 olarak DOM'da kaydın önünde.

### 7) Çizelge (`cizelge`): omurgada zaman çizelgesi
- **Tanınma:** sol kenarda yukarıdan aşağı inen turuncu ince omurga; her bölümde dolu nokta, her kayıtta içi boş halka; tarihler turuncu hap içinde.
- **Geometri:** tek sütun. Ana sütunda `padding-left: yan boşluk + 9mm`; omurga `background: linear-gradient(vurgu,vurgu) no-repeat calc(yan boşluk + 2.2mm) 0 / .7mm 100%`, böylece sayfa boyunca kesintisiz.
- **Renkler:** metin `#1d2433`, soluk `#667085`, vurgu `#e0663a`, tarih hapı zemini `color-mix(vurgu 13%, #fff)`, hap metni `#9a3412`. Seçenekler: camgöbeği `#0f766e` / `#115e59`, indigo `#4f46e5` / `#3730a3`.
- **Yazı tipi:** Manrope 400/500/700/800, gövde 8.8 pt.
- **Başlık:** solda ad (800, 2.9×, −0.03em) ve unvan (vurgu, 700); sağda iletişim **dikey liste**, sağa yaslı. `.cv-identity` iki çocuklu flex `space-between`, DOM sırası ad → iletişim.
- **Bölüm başlığı:** 800, 1.15×; solunda 5 mm dolu vurgu dairesi (`::before`, metinsiz, absolute; başlık `position:relative`).
- **Kayıt:** `.entry{position:relative}`. `::before` 3.4 mm beyaz daire + 0.7 mm vurgu kenarı, omurganın üstünde. Başlık 700, tarih hap (köşe 2 mm, 700, 0.85×).
- **Beceri ve dil:** metin çipleri (0.3 mm `#d0d5dd` kenar, köşe 3 mm). Puan yok.
- **Foto:** yok (açılırsa ad solunda 22 mm daire).
- **Referans:** `detail-D.png` (enhancv#8, sol üst), `sheet-canva-2.png` #23 #27, `sheet-enhancv-2.png` #17 #19.
- **Örnek:** `docs/sablonlar/referanslar.local/onizleme/p-cizelge.png`.
- **ATS:** tarih DOM'da başlıktan sonra geldiği için **sağda** duruyor (soldaki tarih kolonu ters sıra gerektirirdi). Noktalar metinsiz sözde öğe.

### 8) Çift Ton (`cift`): iki tonlu dikey bölünme
- **Tanınma:** sayfada hiç beyaz yok. Sol %37 açık lavanta, sağ %63 koyu indigo; büyük beyaz kenarlı daire foto solda; ad sağda beyaz.
- **Geometri:** `.page` arka planı `linear-gradient(90deg,#e7e3f7 0 37%,#3d3a7a 37%)`; `--side-width:37%`. Başlık 37% / 1fr ızgarası; `.cv-identity{grid-column:2}` (foto yokken de).
- **Renkler:** sol zemin `#e7e3f7`, sol metin `#25224a`, sol soluk `#5d5893`; sağ zemin `#3d3a7a`, sağ metin `#f3f1ff`, sağ soluk `#c6c2ef`, vurgu `#ffcf70` (sağdaki başlıklar ve unvan). Seçenekler: adaçayı `#e3ece4` / `#2f4a3a` + `#f2c46d`; kum `#f1e7da` / `#7a3b2e` + `#ffd9a8`.
- **Yazı tipi:** Space Grotesk 400/500/700, gövde 8.8 pt.
- **Başlık:** foto 40 mm daire, 1.4 mm beyaz kenar, sol hücrede ortalı. Ad 700, 3×, satır aralığı 0.98, −0.02em, beyaz; unvan vurgu renginde; iletişim soluk.
- **Bölüm başlığı:** 700, 1.15×, −0.01em. Solda koyu metin, sağda vurgu.
- **Kayıt:** sağda başlık beyaz 600, kurum soluk; solda "Etiket" blok + değer.
- **Foto yoksa:** sol üst hücre boş lavanta, ad sağda kalır (`docs/sablonlar/referanslar.local/onizleme/p-cift-nophoto.png`).
- **Referans:** `detail-B.png` (flowcv#20, sol alt), `detail-C.png` (canva#45, alt orta), `sheet-flowcv-2.png` #20.
- **Örnek:** `docs/sablonlar/referanslar.local/onizleme/p-cift.png`.
- **ATS:** iletişim başlıkta; açık metin koyu zeminde PDF'te sorun çıkarmıyor. Not: yan sütun DOM'da ana sütundan önce gelir (mevcut kural).

### 9) Afiş (`afis`): tek renk, kalın siyah etiketler + fosforlu vurgu
- **Tanınma:** kocaman siyah büyük harfli ad; adın alt yarısında sarı fosforlu şerit; başlığın altında 2 mm siyah çizgi; bölüm başlıkları beyaz yazılı siyah etiket kutuları; iş unvanlarının altında sarı fosforlu vurgu.
- **Geometri:** başlık yatay boşluğu 14 mm; altında 2 mm `#0b0b0b` çizgi. Gövdede yan sütun %34.
- **Renkler:** metin `#0b0b0b`, soluk `#555`, vurgu `#ffd400`. Seçenekler: neon yeşil `#b6f36b`, mercan `#ff8a7a`, siyah-beyaz (vurgu yok).
- **Yazı tipi:** Archivo 400/700/800/900, gövde 8.8 pt (Archivo Black yerine Archivo 900 statik).
- **Başlık:** ad 900, büyük harf, 4.4×, satır aralığı 0.88, −0.02em, `display:inline` + `background: linear-gradient(transparent 62%, vurgu 62% 92%, transparent 92%)` + `box-decoration-break:clone`. Unvan 700, büyük harf, 0.04em. Foto 30×36 mm gri tonlu dikdörtgen, sağda.
- **Bölüm başlığı:** `align-self:flex-start; background:#0b0b0b; color:#fff`; 800, büyük harf, 0.86×, 0.04em; iç boşluk 0.9×2.4 mm.
- **Kayıt:** başlık 800; `strong` için `background: linear-gradient(transparent 55%, vurgu 55%)`. Tarih siyah 600, sağda.
- **Beceri ve dil:** "Etiket" blok + değer.
- **Foto yoksa:** ad tüm genişliğe yayılır.
- **Referans:** `detail-C.png` (cvwizard#12, sağ üst), `detail-A.png` (resumeio#36, sağ üst; resumeio#29, alt orta), `sheet-resumeio-2.png` #29.
- **Örnek:** `docs/sablonlar/referanslar.local/onizleme/p-afis.png`.
- **ATS:** vurgular `background` ile yapıldığından metin aynen kalır; büyük harf yalnız CSS'te (`text-transform`). Türkçe büyük harf dönüşümü için `<html lang="tr">` şart (i→İ; repo bunu CV dilinden zaten veriyor).

### 10) Çerçeve (`cerceve`): renkli çerçeveli sayfa, yumuşak serif
- **Tanınma:** sayfa kenarında 6.5 mm bordo çerçeve, 2.6 mm içeride ince ikinci çizgi; krem iç zemin; italik serif bölüm başlıkları.
- **Geometri:** `.tpl-cerceve .page { border:6.5mm solid vurgu }` (border-box, A4 sabit). `.page-inner { outline:.3mm solid color-mix(vurgu 55%, transparent); outline-offset:-2.6mm }`. Yatay boşluk 13 mm. 2 sütun, yan sütunla ana sütun arasında 0.3 mm `#e4d9cf` çizgi. Paginate sütun yüksekliğini düzenden okuduğu için (`clientHeight`) çerçeve kapasite hesabını bozmaz.
- **Renkler:** iç zemin `#fffdf8`, metin `#23262b`, soluk `#6b6f76`, vurgu `#8c2f39`, çizgi `#e4d9cf`. Seçenekler: orman `#2f5d50`, gece mavisi `#1f3a5f`, hardal `#b7791f`.
- **Yazı tipi:** ad, unvan ve bölüm başlıkları Fraunces 600 (+ italik 600); gövde Source Sans 3 400/600/700 (9.2 pt).
- **Başlık:** foto 28×32 mm, köşe 2 mm, solda. Ad Fraunces 600, 2.9×, −0.01em. Unvan Fraunces italik 600, vurgu renginde. İletişim üstünde 0.3 mm çizgi, tek satır.
- **Bölüm başlığı:** Fraunces **italik** 600, 1.32×, vurgu renginde. Büyük harf yok; şablonun sesi bu.
- **Kayıt:** başlık 700, kurum soluk, tarih sağda.
- **Beceri ve dil:** yan sütunda "Etiket" blok + değer.
- **Foto yoksa:** ad sola yaslanır (`docs/sablonlar/referanslar.local/onizleme/p-cerceve-nophoto.png`).
- **Referans:** `detail-E.png` (flowcv#16, sağ üst; kickresume#33, sağ alt), `detail-C.png` (novoresume#7, sol üst), `sheet-flowcv-2.png` #16.
- **Örnek:** `docs/sablonlar/referanslar.local/onizleme/p-cerceve.png`.
- **ATS:** çerçeve yalnız kenarlık, metin sırası etkilenmez.

---

## 5. Repodaki iki şablonla örtüşme

- **Klasik** (`klasik.css`: tek sütun, Source Serif 4, sola yaslı ad, vurgu renginde büyük harfli başlık + alt çizgi) → **Zarif**'le örtüşüyor (serif, tek sütun, renk kütlesi yok). İkisi birlikte kalırsa küçük resimde yine "aynı iskelet" sorunu doğar. Öneri: Klasik'i **Zarif'e dönüştür** (id `klasik` kalabilir, görünüm Zarif olur) ya da Klasik'i kaldır. Sola yaslı sade bir seçenek isteyen için İsviçre zaten var.
- **Modern** (`modern.css`: Inter, üstte ad + 0.8 mm vurgu alt çizgisi, %7 tonlu açık yan sütun, başlıkta küçük vurgu çubuğu) → **Panel**'in açık tonlu, zayıf hâli. Öneri: Modern'i **Panel'e yükselt** (tam boy koyu sütun, foto hücresi). Mevcut başlık çubuğu (`::before` 3.2×0.8 mm) Panel'in ana sütun başlıklarında aynen yaşıyor.
- Böylece 10 şablon = 2 dönüştürülmüş + 8 yeni.

## 6. Çizim motoruna küçük gereksinimler (kod değişikliği gerekirse)

1. Şablon tanımına **yazı tipi ikilisi** (başlık ve gövde ayrı aileler): Bant, Manşet, Gece, Çerçeve ve Afiş (ad) başlıkta farklı aile kullanıyor. Bugün `TemplateSettings.font` tek aile; şablon CSS'i başlık ailesini sabit verebilir, gövde kullanıcı seçimi olarak kalır.
2. `fonts` betiğine yeni statik aileler: EB Garamond, Poppins, DM Serif Display, Archivo, Playfair Display, IBM Plex Mono, Manrope, Space Grotesk, Fraunces (yalnız kullanılan ağırlıklar, latin + latin-ext).
3. Panel ve Çift Ton için `--side-width` ile `.page` gradyan yüzdesi aynı değişkenden gelmeli (`linear-gradient(90deg, var(--side-bg) 0 var(--side-width), var(--paper) 0)`).
4. `e2e/ats.spec.ts`'e her yeni şablon eklenmeli. Özellikle İsviçre (sıfır yükseklikli h2) ve Bant (taşan foto) için PDF metin sırası denetimi.
5. Koyu zeminli şablonlar (Gece, Çift Ton, Panel'in sol sütunu) için öneri farkı vurgularının (`sg-added`/`sg-removed`) renkleri koyu zeminde de okunur olmalı.

## 7. Dosyalar

- Galeri ekranları: `<site>-0N.png`. Önizleme görsel listeleri: `<site>-index.txt` (sıra numarası → görsel URL'si).
- Kontak sayfaları: `sheet-<site>-N.png`.
- Büyütülmüş referanslar: `detail-A.png` (resumeio #41 #48 #36 #7 #29 #30), `detail-B.png` (kickresume #10 #7 #6, flowcv #20 #1, enhancv #4), `detail-C.png` (novoresume #7 #8, cvwizard #12, canva #22 #45, overleaf #4), `detail-D.png` (enhancv #8 #17 #12, canva #1, visualcv #13, novoresume #6), `detail-E.png` (kickresume #12, resumeio #47, flowcv #16, canva #11, visualcv #6 yüklenmedi, kickresume #33).
- Örnekler: `docs/sablonlar/onizleme.html`, `docs/sablonlar/referanslar.local/onizleme/p-*.png`, `docs/sablonlar/referanslar.local/onizleme/sheet-mock.png`, `docs/sablonlar/referanslar.local/onizleme/sheet-mock-nophoto.png`.
- Telif: referans görseller yalnız araştırma için indirildi; repoya girmez. Şartnameler arketipi kendi sözlerimizle tarif ediyor, hiçbir ticari tasarımın kopyası değil.
