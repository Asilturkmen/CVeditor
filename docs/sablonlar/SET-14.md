# CVeditör şablon seti: araştırma, mevcut 10'un değerlendirmesi, 14 şablonluk yeni şartname

Tarih: 2026-11-19. Bu belge uygulayıcı içindir. Motor kancaları (K1-K7) ve göç v3 uygulandı (T0); sınıf adları: src/render/styles/base.css başındaki sözleşme.

**Kısa sonuç**

- Mevcut 10 şablonun hiçbiri olduğu gibi kalmıyor: 4'ü düzeltilir (Zarif, Panel, Bant, İsviçre), 6'sı çıkar (Manşet, Gece, Çizelge, Çift Ton, Afiş, Çerçeve).
- Önceki turun hatası: seçim ölçütü "küçük resimde birbirine benzemesin" idi. Bu, gerçekte az seçilen uç tasarımları (tam sayfa koyu, dev ad, fosforlu, çerçeve, iki tonlu) sete soktu, en çok seçilen sade iskeletleri (ör. Resume.io Stockholm, Enhancv Double Column, Jake's Resume) dışarıda bıraktı.
- Yeni set 14 şablon: 12'si ciddi başvuru sınıfı, 2'si karakterli. Sıra: Yalın, Zarif, İkili, Panel, Teknik, Çizgi, Bant, Çizelge, İsviçre, Yönetici, Portre, Denge, Dergi, Blok.
- İki zorunlu motor kancası var: tarihin DOM'da başlıktan önce gelmesi (Çizelge) ve yan sütunun sağda, DOM'da ana sütundan sonra gelmesi (İkili). Gerisi yalnız CSS.

Ölçü dili: `--fs` orta boyda 9.75 pt, boşluk "normal" (`--block-gap` 3 mm, `--section-gap` 5.6 mm, `--pad-x` 16 mm, `--pad-y` 14 mm, `--lh` 1.4). Aşağıdaki bütün pt ve mm değerleri bu ayardaki hedeftir; "em" şablonun gövde boyuna göredir.

---

## 1. Araştırma özeti

### 1.1 Neye bakıldı

| Kaynak | Bu turda nasıl bakıldı |
|---|---|
| Resume.io | Şablon sayfası okundu; Stockholm, Toronto, London, Dublin, Vienna, New York, Santiago, Prague, Madrid görselleri 770 px'te indirilip incelendi. |
| FlowCV | Şablon sayfası okundu; "Popular" süzgecinin ilk 6'sı ve 5 ek şablon 960 px'te incelendi. |
| Enhancv | Şablon sayfası okundu; Double Column, Ivy League, Elegant, Crest, Ivy League with Photo 880 px'te incelendi. |
| Novoresume | Şablon sayfası okundu; Minimalist ve Basic incelendi. |
| Resume Genius | Şablon sayfası okundu; Chicago ve White House incelendi. |
| Açık kaynak | Jake's Resume, Deedy, Awesome-CV, Typst (basic-resume, modern-cv, imprecv), Reactive Resume (Onyx, Rhyhorn, Kakuna) görselleri incelendi. |
| Önceki turun yerel görselleri | `docs/sablonlar/referanslar.local/` içinden 12 kontak sayfası yeniden görüldü: resumeio-1/2, enhancv-1, flowcv-1, overleaf-1, resumegenius-1, novoresume-1, rxresume-1, kickresume-1, resumeworded-1, cvwizard-1, canva-1. |
| Doğrulanamayanlar | Zety sayfası zaman aşımına uğradı (yalnız arama özeti). MyPerfectResume, LiveCareer, Europass ve Kariyer.net için görsel ya da güvenilir "en çok seçilen" verisi bulunamadı. |

İndirilen görseller ve kontak sayfaları repoya alınmadı (telif; yalnız yerel inceleme).

### 1.2 Siteler neyi öne çıkarıyor

| Site | Öne çıkan | Görselde ne var |
|---|---|---|
| Resume.io | Stockholm (arama özetine göre sayfada "10.000.000+ kullanıcı"; Toronto 2,9 milyon+, London ondan yüksek, Dublin 87 bin+). Sayaçları sayfanın kendisinde göremedim, arama özetinden geliyor. | Stockholm: beyaz kâğıt, adın solunda küçük kare fotoğraf, 20 pt civarı ad, çizgisiz cümle düzeninde bölüm başlıkları, sağda zeminsiz dar sütun. London: ortalı tırnaklı ad, solda etiket sütunu, tam genişlik ince çizgiler. Dublin: koyu yeşil sol sütun, yuvarlak fotoğraf. |
| Enhancv | Sayfa "Double Column"u en popüler düzen diye sunuyor; Ivy League tek sütun klasik. | Double Column: büyük harfli kalın ad, mavi unvan, başlık altında kalın siyah çizgi, sağda %35 zeminsiz sütun. Ivy League: ortalı tırnaklı başlıklar, sağda tarih ve yer. Crest: fildişi, ortalı Garamond (bizim Zarif'in aynısı). |
| FlowCV | "Popular" ilk 6: Atlantic Blue, Mercury Flow, Steady Form, Classic Serif, Leaves, Executive. | Atlantic Blue: lacivert sol sütun. Mercury Flow ve Steady Form: bölüm başlığı açık gri şerit içinde, tarihler solda ayrı sütunda. Classic Serif, Executive, Editorial Rule: tırnaklı, büyük harfli başlık + alt çizgi. |
| Zety | Cascade, Concept, Crisp "Most popular" etiketli; Cascade için "1 milyon+ kullanıcı" iddiası (Zety'nin kendi yazısı). | Görsel doğrulanamadı. Tarif: Cascade açık tonlu yan sütun, Concept zaman çizgisi. |
| Novoresume | "Popular" etiketi: Minimalist, Combined, Basic, College. | Minimalist: sola yaslı ince ad, renkli unvan, ikonlu iki sütun iletişim, büyük harfli kalın başlık + çizgi. |
| Resume Genius | Sayaçlar: White House 13.119, Collonade 13.021, Social 12.148, Note 7.430 (sayfada sayının ne olduğu yazmıyor). | Chicago: ortalı tırnaklı ad, çift çizgi arasında iletişim. White House: solda renkli etiket sütunu. |
| Açık kaynak | Jake's Resume yazılımcı CV'lerinde fiilî standart (Overleaf + GitHub). | Jake's: tek sütun, yoğun, başlık altı tam çizgi, kayıt dört köşeli (kurum sol, yer sağ; unvan italik sol, tarih italik sağ). Awesome-CV: başlığın sağına uzanan çizgi, tek vurgu rengi. Reactive Resume Onyx/Rhyhorn: sade, sola yaslı, küçük fotoğraf. |
| Canva | (önceki turun kontak sayfası) | Koyu ya da açık tonlu yan sütun + yuvarlak fotoğraf; büyük harfli ad; ortalı başlık + iki sütun + dikey ince çizgi ("Harper Russo", "Emma Sanchez" tipi). |

### 1.3 Gerçekten seçilen şablonların ortak özellikleri

1. **Beyaz kâğıt.** Öne çıkarılan yaklaşık 30 şablonun 1'i fildişi (Enhancv Crest); tam sayfa renkli zemin yok.
2. **Ad 20-28 pt.** En büyük ad Resume.io Toronto'da (yaklaşık 36 pt). 70 pt'lik ad hiçbir popüler şablonda yok.
3. **Tek vurgu rengi ya da hiç renk.** Lacivert, mavi, koyu yeşil, bordo, gri. Renk başlıkta, unvanda ya da ince çizgide; gövde metni siyah.
4. **Bölüm başlığı gövdeden belirgin biçimde ayrılır.** En sık: büyük harf + kalın + tam genişlik alt çizgi (Jake's, FlowCV Classic Serif, Enhancv Double). Sonra: açık şerit (FlowCV), etiket sütunu (London, White House), çizgisiz iri cümle düzeni (Stockholm).
5. **Tarih sağda, aynı satırda** (çoğunluk) ya da **solda ayrı sütunda** (FlowCV Mercury/Steady/Executive, London, Alman Lebenslauf). Renkli hap yok.
6. **Yan sütun dar (%27-35) ve sakin:** ya koyu lacivert/yeşil ya zeminsiz. Zeminsiz olan çoğunlukla sağda (Stockholm, Enhancv Double, Resume.io Polished).
7. **Fotoğraf küçük ve köşede:** 20-34 mm, daire ya da hafif yuvarlak kare; adın solunda, sağ üstte ya da yan sütunun tepesinde. Yalnız Almanya tipinde büyük dikdörtgen (4,5 × 6,5 cm, sağ üst).
8. **Yoğunluk yüksek:** örnek CV'ler sayfanın %85-95'ini doldurur. Gövde 9-10,5 pt, satır aralığı 1,25-1,45.
9. **Hizalar kesin:** tek sol kenar, tarihler tek sağ kenarda, başlık çizgileri sayfa kenar boşluğuna oturur.

### 1.4 Kaçınılacaklar

| Kaçınılacak | Dayanak |
|---|---|
| Tam sayfa koyu ya da doygun zemin | Öne çıkarılan şablonlarda yok; baskıda mürekkep. Bizde Gece ve Çift Ton. |
| Dev ad (40 pt üstü), dev özet | Öne çıkarılanlarda yok; sayfanın %20'sini içeriksiz harcar. Bizde Manşet, Afiş. |
| Beceri çubuğu, yüzde, yıldız, nokta | Ayrıştırıcılar okuyamaz; işe alımcı yazıları en çok bunu eler. Popüler sitelerde hâlâ var; biz almıyoruz. |
| Fosforlu vurgu, hap, çip, omurga noktası | Web arayüzü dili; CV'de gürültü. Bizde Afiş, Çizelge. |
| Sayfa çerçevesi | Yazıcılar kenara kadar basamaz; çerçeve kırpılır. Bizde Çerçeve, Gece. |
| Köşesi yuvarlatılmış kart, bant | "Web kartı" görünümü. Bizde Bant. |
| Bölüm başlıklarında ikon kalabalığı | Yalnız iletişim satırında küçük ikon yaygın; bu sette ikon yok. |
| İkiden fazla yazı tipi sesi | Bizde Manşet (DM Serif + Archivo geniş kalın + Archivo). |

İşe alımcı verisi zayıf ve çelişkili, dürüst olmak gerekirse: Ladders'ın 2018 göz izleme çalışması (ilk bakış 7,4 sn; "sade düzen, belirgin bölüm ve unvan başlıkları" öne çıkıyor) yöntem açısından eleştiriliyor. Bir anket "%77 iki sütunu tercih ediyor, %73 siyah-beyazı tercih ediyor" diyor; başka kaynaklar iki sütunu ATS riski sayıyor. Bu yüzden karar anketlere değil, sitelerin öne çıkardığı gerçek tasarımlara dayandırıldı.

### 1.5 Kaynaklar

- https://resume.io/resume-templates
- https://flowcv.com/resume-templates
- https://enhancv.com/resume-templates/
- https://novoresume.com/resume-templates
- https://resumegenius.com/resume-templates
- https://zety.com/resume-templates (yalnız arama özeti)
- https://github.com/jakegut/resume , https://www.overleaf.com/latex/templates/jakes-resume/syzfjbzwjncs
- https://github.com/deedy/Deedy-Resume , https://github.com/posquit0/Awesome-CV , https://github.com/liantze/AltaCV
- https://github.com/AmruthPillai/Reactive-Resume (şablon görselleri), https://typst.app/universe (basic-resume, modern-cv, imprecv)
- https://careerservices.fas.harvard.edu/resources/bullet-point-resume-template/
- https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/ (Ladders 2018)
- https://www.ere.net/articles/is-the-6-second-resume-scan-a-myth (eleştirisi)
- https://news.yahoo.com/craft-perfect-resume-according-recruiters-110019114.html (anket; zayıf kaynak)
- https://www.profilebakery.com/en/know-how/career/application-photo-guide-2026 (Almanya fotoğraf ölçüsü)

---

## 2. Mevcut 10 şablon

### 2.1 Karar tablosu

| # | Şablon | Karar | Tek cümle |
|---|---|---|---|
| 1 | Zarif | DÜZELT | İskelet doğru (Enhancv Crest / Ivy League); kâğıt, hizalar ve ölçek düzelecek. |
| 2 | Panel | DÜZELT | En çok seçilen yan sütun tipi; oranlar, renk gürültüsü ve başlık hiyerarşisi düzelecek. |
| 3 | Bant | DÜZELT (baştan çizilir) | Bant fikri doğru (FlowCV Cobalt Edge); yuvarlak köşe, taşan fotoğraf ve kart atılacak. |
| 4 | Manşet | ÇIKAR | 72 pt ad ve 15 pt kalın özet sayfanın üçte birini yiyor. |
| 5 | Gece | ÇIKAR | Siyah sayfa iş başvurusuna gönderilmez, basılmaz. |
| 6 | İsviçre | DÜZELT | Etiket sütunu gerçek bir klasik (London, White House); oranlar ve yoğunluk düzelecek. |
| 7 | Çizelge | ÇIKAR (ad ve `id` yeni tasarıma devredilir) | Omurga, noktalar, haplar, çipler atılır; yerine tarih sütunlu düzen gelir. |
| 8 | Çift Ton | ÇIKAR | Beyaz alan yok; lavanta + çivit; kimse seçmez. |
| 9 | Afiş | ÇIKAR | Fosforlu kalem ve 900 ağırlıklı ad afiş dili, CV değil. |
| 10 | Çerçeve | ÇIKAR | Kalın çerçeve baskıda kırpılır, sertifika görünümü verir. |

Olduğu gibi kalan yok.

### 2.2 Bütün şablonlarda görülen ortak kusurlar

1. **İletişim satırı ayırıcıyla bitiyor:** satır sonunda asılı "·" (Zarif, Bant, Manşet, Gece, Afiş, Çerçeve). Çözüm: §3.0 K3.
2. **Bölüm başlığı gövdeden küçük** (0.8-0.92em): hiyerarşi başlıkta değil süste (çubuk, kutu, nokta) aranmış.
3. **Sayfa boş görünüyor:** tek sütunlu şablonlarda örnek CV sayfanın %55-60'ını dolduruyor; galeri kartı "yarım" duruyor. Örnek CV uzatılmalı (§4.3).
4. **Her şablonda ayrı bir gösteri öğesi var** (dev ad, halka, omurga, çerçeve, fosfor); sade bir seçenek yok.
5. **Beceri satırları ayrı blok aralığıyla diziliyor:** üç satırlık beceri listesi üç kayıt kadar yer tutuyor (İsviçre'de en belirgin).

### 2.3 Tek tek

**1. Zarif: DÜZELT**
- Fildişi zemin (`#fbf8f1`): ekranda sararmış kâğıt, baskıda gri ton. Varsayılan beyaz olacak; fildişi bir renk takımına inecek.
- Beceri satırları ortalı, kayıtlar sola yaslı: aynı sayfada iki hiza ekseni.
- Özet italik ve ortalı, soluk renkte: 2-3 satırlık en önemli paragraf en zor okunan yer olmuş.
- Ad 3.1em (33 pt), unvan 0.82em (8.7 pt): oran 3.8'e 1, unvan kayboluyor.
- Bölüm başlığı 0.8em (8.5 pt): iki yanındaki çizgiler başlıktan baskın.
- Tarih italik ve soluk; küçük puntoda Garamond italik rakamlar zor seçiliyor.
- Fotoğraf adın üstünde ayrı satırda: başlık 62 mm'ye çıkıyor.
- Düzelecek: §3 Şablon 2.

**2. Panel: DÜZELT**
- Yan sütun %34 (71 mm) ve içeriği kısa: alt %45'i boş koyu kütle.
- Ana sütun başlıkları 0.9em ve gövdeden küçük; önündeki 5 mm çubuk hiyerarşiyi taşıyamıyor.
- Kurum satırlarının hepsi vurgu renginde (5 satır yeşil): renk gürültüsü; unvan da aynı renk.
- Ad Inter 700, 2.6em: karaktersiz, "varsayılan web" görünümü.
- Fotoğrafın çevresinde boşluklu çift halka: süs.
- Yan sütunda "Diller:" etiketi iki noktayla bitip değer alt satıra iniyor.
- Satır aralığı gevşek, bölüm arası 9-10 mm: sayfa seyrek.
- Düzelecek: §3 Şablon 4.

**3. Bant: DÜZELT (baştan çizilir)**
- Bandın alt köşeleri yuvarlak: A4 kenarında web kartı gibi duruyor.
- 38 mm fotoğraf banttan dışarı taşıyor, çevresinde 1.6 mm beyaz halka: hem süs hem de ilk bölümün yanında 12 mm ölü boşluk.
- Yan sütun yuvarlak köşeli açık mavi kart: ikinci bir "web bileşeni".
- Ad Poppins 700, 2.7em: tombul, açılış sayfası başlığı gibi.
- Poppins başlık + Source Sans gövde + her başlığın altında kısa çubuk: üç ayrı ses.
- Kurum satırları vurgu renginde.
- Düzelecek: §3 Şablon 7.

**4. Manşet: ÇIKAR**
- Ad yaklaşık 72 pt, iki satır: sayfa yüksekliğinin %21'i.
- Özet 1.55em kalın Didone: ikinci bir manşet; adla yarışıyor.
- Kayıt başlıkları Archivo'nun geniş kalın kesiminde: gövdeyle aynı aileden görünmüyor.
- Başlık çizgisinin uçları yuvarlak; bölüm çizgileri farklı uzunlukta (yan ve ana).
- Fotoğraf kutusu adla hizasız, sağda asılı.
- Göç: `dergi`.

**5. Gece: ÇIKAR**
- Bütün sayfa koyu; boş ikinci sayfada bile çerçeve görünüyor.
- Büyük harfli Playfair ad; altın renkli 0.82em başlıklar.
- İşe alımcı çıktısı alırsa okunmaz ya da siyah blok basılır.
- Göç: `yonetici`.

**6. İsviçre: DÜZELT**
- Etiket sütunu %27 (48 mm) ve neredeyse boş: gövde 130 mm'ye sıkışıyor, sol tarafta "nehir".
- Ad 300 ağırlık, 3.2em: ince ve silik; baskıda kırılır.
- İletişim eş aralıklı (Plex Mono), 3 satır: terminal görünümü, başlık 30 mm.
- Tarihler eş aralıklı: gövdeden geniş, kayıt başlığına yapışıyor.
- Beceri ve dil satırlarının her biri ayrı blok: 5 satır 30 mm tutuyor.
- Her bölümün üstünde çizgi + 5.6 mm boşluk: 8 bölümde 45 mm kayıp; CV ikinci sayfaya taşıyor.
- Düzelecek: §3 Şablon 9.

**7. Çizelge: ÇIKAR (ad ve id devredilir)**
- Omurga içerik bittikten sonra sayfanın dibine ve boş ikinci sayfaya kadar iniyor.
- 5 mm dolu noktalar, halkalar, turuncu tarih hapları, kenarlıklı beceri çipleri: dört ayrı süs.
- İletişim sağda 6 satır, 0.8em: addan kopuk, okunmuyor.
- Zaman ekseni fikrinin sahiden seçilen hâli "tarih solda ayrı sütun"dur (FlowCV Mercury/Steady/Executive). Yeni Çizelge odur.
- Göç gerekmez (id aynı); eski takım renkleri yeni varsayılana çekilir.

**8. Çift Ton: ÇIKAR**
- Sayfada beyaz yok; lavanta + çivit + sarı.
- Space Grotesk'in italiği yok: zengin metindeki italik kayboluyor.
- Koyu zeminde 9 pt soluk mor metin.
- Göç: `panel`.

**9. Afiş: ÇIKAR**
- 900 ağırlıklı büyük harfli ad + sarı fosfor.
- Her kayıt başlığında fosfor: sayfada 8 sarı leke.
- 2 mm yuvarlak uçlu çizgi, siyah kutu başlıklar, kalın siyah tarihler: her şey bağırıyor.
- Göç: `blok`.

**10. Çerçeve: ÇIKAR**
- 6.5 mm renkli çerçeve + iç çizgi: yazıcı kenara kadar basamaz; çerçeve kesik çıkar.
- Krem zemin.
- İçerideki düzen (italik Fraunces başlık, dikey ince çizgi) iyiydi; Dergi'ye taşınıyor.
- Göç: `dergi`.

### 2.4 Göç eşlemesi

`CURRENT_SCHEMA_VERSION` 2 → 3; `src/cv/migrate.ts`'e göç, Dexie'ye yeni `version()`.

| Eski `templateId` | Yeni | Sütun | Not |
|---|---|---|---|
| `manset` | `dergi` | korunur (1 ve 2 destekli) | |
| `cerceve` | `dergi` | korunur | |
| `gece` | `yonetici` | 1 | `baseColor` = null |
| `cift` | `panel` | 2 | `baseColor` = null (Panel'in varsayılan zemini) |
| `afis` | `blok` | korunur (1 ve 2 destekli) | |
| `cizelge` | `cizelge` | 1 | Tasarım değişir |
| `zarif`, `panel`, `bant`, `isvicre` | aynı | Bant: korunur | Tasarım değişir |

Göç kuralları (hepsi için):
- **Renk:** eski şablonun hazır takımlarından biri seçiliyse yeni şablonun varsayılan vurgusu; özel renkse aynen kalır (`carriedAccent` mantığı). Bu kural `id` aynı kalan 5 şablonda da uygulanır, çünkü takım renkleri değişiyor; yoksa eski takım "özel renk" gibi kalır.
- **Yazı tipi:** eski şablonun varsayılanındaysa yeni varsayılan; değilse kalır.
- **Başlık hizası:** eski varsayılandaysa yeni varsayılan.
- **İçerik, fotoğraf, `sideSections`:** dokunulmaz.
- `DEFAULT_TEMPLATE_ID` `zarif` → `yalin`.

---

## 3. Yeni set: 14 şablon

### 3.0 Motor gereksinimleri (kancalar)

| Kod | Ne | Kim kullanır | Zorunlu mu |
|---|---|---|---|
| **K1** | **Tarih DOM'da başlıktan önce.** `templateMeta`'ya `datePosition?: 'start'`. `CvMarkup.EntryHead` bu şablonda `.entry-head.date-first > .entry-date + .entry-title` üretir. Tarihsiz kayıt değişmez. | Çizelge | Evet. Kancasız yapılırsa tarih ızgarayla sola taşınır, bu "metin yer değiştirmez" kuralını çiğner. |
| **K2** | **Yan sütun sağda ve DOM'da ana sütundan sonra.** `templateMeta`'ya `sidePosition?: 'end'`. `CvSource` `data-flow="main"`'i `side`'dan önce yazar; `paginate` `.col-main + .col-side` kurar; kök öğeye `side-end` sınıfı. `base.css`: `.cols-2.side-end .col-main { padding-left: var(--pad-x); padding-right: calc(var(--pad-x) * .6) }`, `.cols-2.side-end .col-side { padding-left: calc(var(--pad-x) * .6); padding-right: var(--pad-x) }`. | İkili | Evet. Yapılmazsa İkili sol sütunla çıkar ve Denge'ye fazla benzer. |
| **K3** | **Satır sonundaki iletişim ayırıcısı gizlenir.** `paginate` (ya da `CvFrame` ölçümü) başlık yerleştikten sonra, bir sonraki `li` ile aynı satırda olmayan `li`'ye `eol` sınıfı verir; `base.css`: `.cv-contact li.eol .sep { visibility: hidden }`. O ayırıcı PDF metnine girmez; satır sonu zaten ayırır. | Satır içi iletişimli bütün şablonlar | Kalite için güçlü öneri. |
| **K4** | **Şablon ölçek çarpanları.** `templateMeta`'ya `scale?: { fs?, lh?, gap?, padX?, padY? }`; `cvVariables` değişkenleri bunlarla çarpıp yazar. Gerekçe: `--pad-x: calc(var(--pad-x) * .8)` CSS'te döngüdür, şablon bugün her özelliği tek tek ezmek zorunda. | Hepsi | Öneri. Yapılmazsa aşağıdaki ölçüler özellik düzeyinde `calc()` ile verilir (Zarif'in bugünkü yolu). |
| **K5** | **Beceri etiketinin iki noktası ayrı öğe.** `strong.line-label` içinde `{ad}<span class="line-colon">: </span>`. Etiketi blok gösteren yan sütunlarda `.line-colon { display: none }`. | Panel, Denge, İkili, yan sütunlu hâller | Küçük öneri. |
| **K6** | **Yeni gövde ailesi `libre-franklin`** (SIL OFL, Google Fonts ve `@fontsource/libre-franklin`; latin-ext; statik 400, 500, 600, 700, 400i, 700i). `FONT_IDS`'e ve `copy-fonts.mjs`'e eklenir. Paketin latin-ext alt kümesini ve statik dosyalarını kurarken doğrula; bu turda paketi indirip bakmadım. | İkili | Evet (İkili için). Kabul edilmezse İkili'nin gövdesi `inter`. |
| **K7** | `TemplateTag` birleşimi, mesaj anahtarları (`template_<id>_name/_desc`, `tag_<id>`, `color_<id>`), `DEFAULT_TEMPLATE_ID`, göç v3. | Hepsi | Evet. |

İsteğe bağlı, bu sette kullanılmıyor: iletişim öğesine tür (`li[data-kind="email|phone|…"]`), ileride ikon ya da etiketli iletişim için.

Yazı tipi yüzleri (mevcut dosyalar yeter, K6 dışında ek aile yok):
- `source-serif-4`, `literata`, `manrope` başlık ailesi olarak da kullanılıyor (`FontKey` buna izin veriyor).
- `poppins`: 500 ve 600 kullanılıyor (700 artık gerekmiyor).
- `archivo`: 800 kullanılıyor (900 artık gerekmiyor).
- `ibm-plex-sans` 300, `ibm-plex-mono`, `dm-serif-display`, `playfair-display`, `space-grotesk`: şablonlarda kullanılmıyor. `space-grotesk` ve `manrope` gövde seçeneği olarak kalabilir; ikisinin de italiği yok, bu yüzden hiçbir şablonun varsayılan gövdesi değiller.

### 3.0.1 Ortak varsayılanlar (şablon ayrıca söylemedikçe geçerli)

| Öğe | Değer |
|---|---|
| Kâğıt | `#ffffff` |
| Kayıt başlığı (`.entry-title strong`) | 600, 1em, `--ink` |
| Tarih (`.entry-date`) | sağda, aynı taban çizgisinde, 0.92em, 400, `--muted`, `tabular-nums`, bölünmez; başlıkla arası en az 4 mm |
| Alt satır (`.entry-sub`) | 1em, 400, `--muted`; ilk `.part` 500 ve `--ink` |
| Kayıt gövdesi | alt satırdan 1.1 mm sonra |
| Madde | `disc`; `ul` sol iç boşluk 4 mm; `li::marker` 0.8em ve `--muted`; maddeler arası 0.6 mm |
| Beceri satırı | `Etiket:` 600 + değerler 400; ardışık beceri/dil satırları arası 1.2 mm (`.entry-skills + .entry-skills { margin-top: calc(1.2mm - var(--block-gap)) }`, dil için aynı) |
| Bölüm başlığından ilk kayda | 1.8 mm (`.section-title + * { margin-top: calc(1.8mm - var(--block-gap)) }`) |
| Bağlantı | renk miras; yalnız zengin metinde altı çizili |
| Fotoğraf | `object-fit: cover`; süs halkası yok |
| Harf aralığı | büyük harfli etikette 0.04-0.05em; adda 0 ile -0.015em arası |
| Ortalı başlık (`align-center`) | Her şablon destekler: fotoğraf adın üstüne, metin ortaya, iletişim ortalı |

### 3.0.2 Sette kim neyle ayrışıyor

| # | id | İskelet | Başlık | Bölüm başlığı | Tarih | Yazı |
|---|---|---|---|---|---|---|
| 1 | `yalin` | tek sütun | sol; kare foto solda | iri, cümle düzeni, çizgisiz | sağ | Inter |
| 2 | `zarif` | tek sütun | ortalı; daire foto üstte | ortalı, iki yanında çizgi | sağ, italik | EB Garamond |
| 3 | `ikili` | ana + sağda zeminsiz sütun | sol; daire foto sağda | büyük harf + kalın siyah alt çizgi | sağ | Libre Franklin |
| 4 | `panel` | koyu sol sütun | foto sütunda, ad beyazda | büyük harf + ince alt çizgi | sağ | Source Serif 4 + Source Sans 3 |
| 5 | `teknik` | tek sütun, yoğun | ad solda, iletişim sağda | büyük harf + siyah tam çizgi | sağ; yer de sağda | Source Serif 4 |
| 6 | `cizgi` | tek sütun, üstte vurgu şeridi | sol; daire foto sağda | renkli, sağına uzanan çizgi | sağ | Source Sans 3 |
| 7 | `bant` | tam genişlik koyu bant | bantta beyaz ad; foto bantta | tırnaklı + kısa kalın alt çizgi | sağ | Literata + Inter |
| 8 | `cizelge` | tarih sütunu solda | sol; ad + unvan aynı satır | açık şerit, ortalı | **solda sütun** | Archivo |
| 9 | `isvicre` | etiket sütunu solda | sol; ince vurgu çizgisi | solda etiket, üstte tam çizgi | sağ | IBM Plex Sans |
| 10 | `yonetici` | tek sütun, geniş boşluk | sol; iletişim iki çizgi arasında | **üstte** kalın çizgi, altında etiket | sağ | Literata |
| 11 | `portre` | tek sütun | büyük dikdörtgen foto sağda, iletişim iki sütun liste | solunda dikey vurgu çubuğu | sağ | Manrope + Inter |
| 12 | `denge` | sol zeminsiz sütun + dikey çizgi | ortalı, büyük harfli ad | büyük harf, ince alt çizgi | sağ | Poppins + Source Sans 3 |
| 13 | `dergi` | tek sütun (2 destekli) | iri tırnaklı ad, kalın çizgi | italik tırnaklı, çizgisiz | sağ, italik | Fraunces + Source Serif 4 |
| 14 | `blok` | tek sütun (2 destekli) | kenara dayalı foto + renk bloğu | siyah etiket kutusu | sağ, küçük büyük harf | Archivo |

---

### Şablon 1. Yalın (`yalin`)

- **Kimlik:** çizgisiz, süssüz, yalnız boşluk ve ağırlıkla kurulan sade tek sütun.
- **Hedef:** herkes; varsayılan şablon. Kurumsal, kamu, yeni mezun.
- **Referans:** Resume.io Stockholm (ad, kare foto, çizgisiz başlık); Reactive Resume Onyx; Resume.io Santiago.

```
┌──────────────────────────────────────────┐
│ ┌────┐  Deniz Aksoy                      │
│ │foto│  Frontend Geliştirici             │
│ └────┘  e-posta · telefon · şehir · web  │
│                                          │
│ Özet                                     │
│ ───── metin ─────────────────────────────│
│                                          │
│ Deneyim                                  │
│ Frontend Geliştirici        Şub 24 – Gün │
│ Lacivert Yazılım · İzmir                 │
│  • madde                                 │
│                                          │
│ Eğitim                                   │
│ Beceriler                                │
└──────────────────────────────────────────┘
```

```ts
{ id: 'yalin', columns: [1], tags: ['plain'], headerAlign: 'left',
  colorSets: [ { id: 'celik', accent: '#2f4a66' }, { id: 'siyah', accent: '#1f1f1f' },
               { id: 'petrol', accent: '#0f5c6e' }, { id: 'bordo', accent: '#7a2e2e' }, { id: 'orman', accent: '#2f5d50' } ],
  fonts: { body: 'inter', display: 'inter' },
  paper: '#ffffff', ink: '#1c2430', muted: '#5b6675', rule: '#d9dee5' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 0.92` = 9.0 pt; satır aralığı 1.45 |
| Kenar | yan 18 mm, üst/alt 16 mm |
| Blok / bölüm arası | 3 mm / 7 mm |

- **Başlık:** `grid-template-columns: auto minmax(0,1fr)`, aralık 5 mm, dikey ortalı; alt iç boşluk 6 mm; çizgi yok.
  - Fotoğraf: 22 × 22 mm, köşe 2 mm, solda.
  - Ad: 2.45em (22 pt), 600, satır 1.1, -0.015em, `--ink`. `--name-size: 2.45em; --name-room: 145mm; --name-char: 0.62`.
  - Unvan: 1.1em (9.9 pt), 400, `--muted`, üst 0.8 mm.
  - İletişim: 0.95em, `--muted`, üst 2.2 mm, satır içi, ayırıcı " ·".
- **Bölüm başlığı:** 1.28em (11.5 pt), 600, `--accent-ink`, `text-transform: none`, harf aralığı 0; çizgi yok.
- **Kayıt:** ortak varsayılan.
- **Madde:** ortak.
- **Fotoğrafsız:** ızgaranın `auto` sütunu kapanır; ad sola dayanır.
- **Yoğunluk:** 1 sayfa = 3 satır özet + 3 iş (9 madde) + 1 eğitim + 2 proje + 3 beceri satırı + 2 dil.
- **Kanca:** K3.

---

### Şablon 2. Zarif (`zarif`)

- **Kimlik:** ortalı klasik tırnaklı; başlıkların iki yanında ince çizgi.
- **Hedef:** hukuk, finans, akademi, danışmanlık, üst düzey.
- **Referans:** Enhancv Crest ve Ivy League; Resume Genius Chicago; Harvard madde işaretli şablon.

```
┌──────────────────────────────────────────┐
│                 ( foto )                 │
│               Deniz Aksoy                │
│           FRONTEND GELİŞTİRİCİ           │
│      e-posta · telefon · şehir · web     │
│ ──────────────────────────────────────── │
│ ─────────────── DENEYİM ──────────────── │
│ Frontend Geliştirici       Şub 24 – Gün  │
│ Lacivert Yazılım · İzmir (italik)        │
│  • madde                                 │
│ ─────────────── EĞİTİM ───────────────── │
│ ─────────────── BECERİLER ────────────── │
│ Diller: TypeScript, JavaScript …         │
└──────────────────────────────────────────┘
```

```ts
{ id: 'zarif', columns: [1], tags: ['serif'], headerAlign: 'center',
  colorSets: [ { id: 'bordo', accent: '#7a2e2e' }, { id: 'lacivert', accent: '#1f3a5f' }, { id: 'orman', accent: '#2f5d50' },
               { id: 'siyah', accent: '#26221d' },
               { id: 'fildisi', accent: '#6b3a2a', vars: { '--paper': '#fbf8f1', '--rule': '#d8cdb9' } } ],
  fonts: { body: 'eb-garamond', display: 'eb-garamond' },
  paper: '#ffffff', ink: '#26221d', muted: '#6b6359', rule: '#d9d2c5' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 1.087` = 10.6 pt; satır aralığı 1.33 |
| Kenar | yan 20 mm, üst/alt 15 mm |
| Blok / bölüm arası | 2.6 mm / 5.4 mm |

- **Başlık:** ortalı; altında 0.25 mm `--rule` çizgi, alt iç boşluk 4 mm.
  - Fotoğraf: 24 mm daire, adın üstünde, alt boşluk 3.5 mm (bugünkü 4 mm).
  - Ad: 2.55em (27 pt; bugün 3.1em), 500, satır 1, +0.01em. Uzun adda 2.2em.
  - Unvan: 0.86em, büyük harf, 0.05em, `--accent-ink`, üst 1.8 mm.
  - İletişim: 0.92em, `--muted`, üst 2 mm.
- **Bölüm başlığı:** ortalı; 0.86em (9.1 pt; bugün 0.8em), 600, büyük harf, 0.05em, `--accent-ink`; iki yanında `flex: 1` 0.25 mm `--rule` çizgi, aralık 3 mm.
- **Kayıt:** başlık 600. Tarih 0.95em italik `--muted`. Alt satır italik `--muted` (ilk parça da italik, 400).
- **Özet:** ortalı, **düz** (italik değil), `--ink`, yan iç boşluk 10 mm.
- **Beceri ve dil:** **sola yaslı** (bugün ortalı).
- **Madde:** `disc`, işaret 0.75em.
- **Sola yaslı hâl:** başlık solda, foto adın solunda; bölüm çizgisi yalnız sağda (bugünkü davranış kalır).
- **Fotoğrafsız:** ad en üstte.
- **Yoğunluk:** 1 sayfa = Yalın ile aynı içerik.
- **Kanca:** K3 (ortalı satırda asılı "·" en çok burada görünüyor).

---

### Şablon 3. İkili (`ikili`)

- **Kimlik:** ana sütun solda, yetkinlikler sağda zeminsiz dar sütunda; başlıkların altında kalın siyah çizgi.
- **Hedef:** deneyimi çok olan, tek sayfaya çok şey sığdırmak isteyen; ürün, pazarlama, yazılım.
- **Referans:** Enhancv Double Column (sitenin "en popüler" dediği); Resume.io Stockholm ve Polished (sağ sütun).

```
┌──────────────────────────────────────────┐
│ DENİZ AKSOY                      ( foto )│
│ Frontend Geliştirici (vurgu)             │
│ e-posta · telefon · şehir · web          │
│                                          │
│ ÖZET                    │ BECERİLER      │
│ ━━━━━━━━━━━━━━━━━━━━━━  │ ━━━━━━━━━━━━━  │
│ metin                   │ Diller         │
│ DENEYİM                 │ TypeScript, …  │
│ ━━━━━━━━━━━━━━━━━━━━━━  │ DİLLER         │
│ Unvan        Şub 24–Gün │ ━━━━━━━━━━━━━  │
│ Kurum (vurgu) · Şehir   │ Türkçe         │
│  • madde                │ SERTİFİKALAR   │
└──────────────────────────────────────────┘
   (dikey çizgi yok; aradaki boşluk 7 mm)
```

```ts
{ id: 'ikili', columns: [2], sidePosition: 'end', tags: ['side_right'], headerAlign: 'left',
  colorSets: [ { id: 'mavi', accent: '#1f5fbf' }, { id: 'siyah', accent: '#1c1c1c' }, { id: 'zumrut', accent: '#0b6e4f' },
               { id: 'bordo', accent: '#8c2f39' }, { id: 'turuncu', accent: '#b4532a' } ],
  fonts: { body: 'libre-franklin', display: 'libre-franklin' },
  paper: '#ffffff', ink: '#161616', muted: '#5f5f5f', rule: '#d4d4d4' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 0.9` = 8.8 pt; satır aralığı 1.38 |
| Kenar | yan 13 mm, üst/alt 12 mm |
| Sütun | `--side-width: 35%`; sütunlar arası toplam 7 mm (ana sağ iç 3.5, yan sol iç 3.5) |
| Blok / bölüm arası | 2.4 mm / 4.6 mm |

- **Başlık:** `grid-template-columns: minmax(0,1fr) auto`; foto 2. sütunda (yalnız görsel); alt iç boşluk 4.5 mm.
  - Fotoğraf: 24 mm daire, sağ üstte.
  - Ad: 2.5em (22 pt), 700, **büyük harf**, 0.01em, satır 1.05. `--name-room: 150mm; --name-char: 0.70`.
  - Unvan: 1.15em, 600, `--accent-ink`, üst 1 mm.
  - İletişim: 0.95em, `--muted`, üst 2 mm, satır içi.
- **Bölüm başlığı (iki sütunda aynı):** 1em, 700, büyük harf, 0.04em, `--ink`; alt iç boşluk 0.8 mm; `border-bottom: 0.6mm solid var(--ink)`.
- **Kayıt (ana):** başlık 600, 1.04em. Tarih sağda. Alt satır: ilk parça 600 ve `--accent-ink`, kalanı `--muted`.
- **Yan sütun:** `.entry-head` dikey (base.css'te var). Beceri etiketi blok, 600; değer alt satırda; iki nokta K5 ile gizli. Dil: ad 600, seviye alt satırda `--muted`.
- **Madde:** `disc`; maddeler arası 0.4 mm.
- **Fotoğrafsız:** başlık tek sütun.
- **Yoğunluk:** en yoğun iki sütunlu. 1 sayfa = 3 satır özet + 4 iş (14 madde) + 2 eğitim + 2 proje; yanda 4 beceri grubu + diller + 3 sertifika.
- **Kanca:** K2 (zorunlu), K6, K5, K3.

---

### Şablon 4. Panel (`panel`)

- **Kimlik:** solda sayfa boyu koyu sütun, tepesinde yuvarlak fotoğraf; ad beyaz alanda tırnaklı.
- **Hedef:** fotoğraflı CV isteyen; satış, yönetim, hizmet. Türkiye'de en tanıdık "modern CV".
- **Referans:** Resume.io Dublin; FlowCV Atlantic Blue (FlowCV "Popular" 1. sıra); Canva koyu yan sütunlular.

```
┌──────────────┬───────────────────────────┐
│██████████████│ Deniz Aksoy (tırnaklı)    │
│███( foto )███│ Frontend Geliştirici      │
│██████████████│ e-posta      telefon      │
│██████████████│ şehir        web          │
│█BECERİLER████│                           │
│█────────█████│ ÖZET                      │
│█Diller███████│ ───────────────────────── │
│█TypeScript,██│ metin                     │
│█DİLLER███████│ DENEYİM                   │
│█────────█████│ ───────────────────────── │
│█Türkçe███████│ Unvan         Şub 24–Gün  │
│██████████████│ Kurum · Şehir             │
└──────────────┴───────────────────────────┘
```

```ts
{ id: 'panel', columns: [2], tags: ['dark_side'], headerAlign: 'left',
  colorSets: [ { id: 'lacivert', accent: '#1f4e79', base: '#1c2b3f' }, { id: 'orman', accent: '#256b52', base: '#1d3a30' },
               { id: 'komur', accent: '#3d4651', base: '#25282d' }, { id: 'bordo', accent: '#7d2a3c', base: '#4a1f2a' },
               { id: 'sis', accent: '#1f3a5f', base: '#e8ecf1' } ],
  fonts: { body: 'source-sans-3', display: 'source-serif-4' },
  paper: '#ffffff', ink: '#1c2430', muted: '#5b6675', rule: '#d9dee5' }
```

"Sis" takımı açık gri yan sütundur (Zety Cascade / FlowCV Quicksilver tipi); üstündeki metin `--on-base` ile kendiliğinden koyu olur.

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 1.0` = 9.75 pt (Source Sans küçük görünür); satır aralığı 1.4 |
| Sütun | `--side-width: 32%` (bugün %34) |
| Kenar | yan 13 mm (yan sütunun dışı), üst/alt 14 mm |
| Blok / bölüm arası | 2.8 mm / 6 mm |

- **Başlık:** bugünkü iki hücreli ızgara kalır (`var(--side-width) | 1fr`); kimlik her zaman 2. sütunda.
  - Fotoğraf: 32 mm daire, koyu hücrede ortalı; **halka yok** (`outline` kaldırılır); üst boşluk `--pad-y`, alt 6 mm.
  - Ad: `--font-display` (Source Serif 4), 2.45em (24 pt), 600, -0.01em, satır 1.08. `--name-room: 112mm; --name-char: 0.66`.
  - Unvan: 1.12em, 600, `--accent-ink`, üst 1.2 mm.
  - İletişim: iki sütunlu sarmalı flex (bugünkü yol), 0.95em, `--muted`, üst 3 mm; ayırıcı gizli.
- **Bölüm başlığı (ana):** gövde ailesi, 0.95em, 700, büyük harf, 0.05em, `--accent-ink`; alt iç boşluk 1 mm; `border-bottom: 0.25mm solid var(--rule)`. Öndeki çubuk kaldırılır.
- **Bölüm başlığı (yan):** 0.9em, 700, büyük harf, 0.05em, `--on-base`; `border-bottom: 0.25mm solid` `--on-base`'in %22'si (yalnız çizgi; metin rengi karıştırılmaz).
- **Kayıt (ana):** ortak varsayılan. Kurum satırı **vurgu renginde değil**.
- **Yan sütun:** metin `--on-base-dim`; etiket blok, 600, `--on-base`; iki nokta K5 ile gizli; tarih ve alt satır `--on-base-muted`.
- **Fotoğrafsız:** sol üst hücre boş kalır; yan sütunun ilk başlığı `--pad-y` hizasından başlar.
- **Yoğunluk:** 1 sayfa = 3 satır özet + 3 iş (9 madde) + 1 eğitim + 2 proje; yanda 3 beceri grubu + diller + sertifikalar.
- **Kanca:** K5.

---

### Şablon 5. Teknik (`teknik`)

- **Kimlik:** yoğun, tek sayfalık, siyah-beyaz; her bölümün altında tam çizgi, kayıtlar dört köşeli.
- **Hedef:** yazılımcı, mühendis, veri; ABD tipi tek sayfa özgeçmiş; ATS'ye en güvenli seçenek.
- **Referans:** Jake's Resume; Typst basic-resume ve imprecv; Resume Worded "Professional"; Resume.io Prague (ad sol, iletişim sağ).

```
┌──────────────────────────────────────────┐
│ Deniz Aksoy       e-posta · telefon ┌──┐ │
│ Frontend Geliştirici şehir · web · gh│fo│ │
│                                     └──┘ │
│ DENEYİM                                  │
│ ──────────────────────────────────────── │
│ Frontend Geliştirici        Şub 24 – Gün │
│ Lacivert Yazılım (italik)          İzmir │
│  • madde                                 │
│  • madde                                 │
│ Yazılım Stajyeri           Haz 23–Eyl 23 │
│ Martı Teknoloji                 İstanbul │
│ EĞİTİM                                   │
│ ──────────────────────────────────────── │
│ BECERİLER                                │
│ ──────────────────────────────────────── │
│ Diller: …   Çatılar: …   Araçlar: …      │
└──────────────────────────────────────────┘
```

```ts
{ id: 'teknik', columns: [1], tags: ['dense'], headerAlign: 'left',
  colorSets: [ { id: 'siyah', accent: '#111111' }, { id: 'lacivert', accent: '#1f3a5f' }, { id: 'bordo', accent: '#6e1f2b' } ],
  fonts: { body: 'source-serif-4', display: 'source-serif-4' },
  paper: '#ffffff', ink: '#111111', muted: '#4d4d4d', rule: '#111111' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 0.975` = 9.5 pt; satır aralığı 1.27 |
| Kenar | yan 13 mm, üst/alt 12 mm |
| Blok / bölüm arası | 1.8 mm / 3.6 mm |

- **Başlık:** `.cv-identity { display: grid; grid-template-columns: minmax(0,1fr) auto; column-gap: 6mm; align-items: end }`; `.cv-heading` 1. sütun, `.cv-contact` 2. sütun (DOM sırasıyla aynı yön). Alt iç boşluk 3 mm; çizgi yok.
  - Ad: 2.1em (20 pt), 700, satır 1.05, 0. `--name-room: 78mm; --name-char: 0.60`.
  - Unvan: 1em, italik, `--ink`, üst 0.6 mm.
  - İletişim: 0.92em, `--ink`, **sağa yaslı**, en çok 2 satır, `max-width: 82mm`, satır içi " ·".
  - Fotoğraf: 20 × 25 mm, köşe 1 mm, en sağda (`.cv-header` ızgarası `minmax(0,1fr) auto`, foto 2. sütun).
- **Bölüm başlığı:** 0.95em, 700, büyük harf, 0.04em, `--accent-ink`; alt iç boşluk 0.5 mm; `border-bottom: 0.25mm solid var(--ink)`. İlk kayda 1.2 mm.
- **Kayıt (dört köşe):**
  - 1. satır: başlık 700 solda; tarih sağda 0.95em, **`--ink`** (soluk değil).
  - 2. satır: `.entry-sub { display: flex; gap: 4mm; font-style: italic; color: var(--ink) }`; `.entry-sub .part:first-child { flex: 1; min-width: 0 }`; ikinci parçanın baştaki ayırıcısı gizli (`.entry-sub .part:nth-child(2) > .sep { display: none }`). Sonuç: kurum solda, yer (ve varsa not) sağda. İlk parçanın 500/`--ink` kuralı burada yok.
  - Emsal: Panel iletişimde `.sep`'i zaten gizliyor. `e2e/ats.spec.ts` alt satırda " · " bekliyorsa bu şablonda yer sola alınır (düz satır) ve dört köşeden vazgeçilir.
- **Madde:** `disc`, işaret 0.75em `--ink`; maddeler arası 0.3 mm; `ul` sol iç boşluk 3.6 mm.
- **Beceri:** ardışık satırlar arası 0.6 mm.
- **Ortalı hâl:** tam Jake's: ad ortada, iletişim altında tek satır ortalı.
- **Fotoğrafsız:** iletişim sağ kenara dayanır.
- **Yoğunluk:** setin en yoğunu. 1 sayfa = 2 satır özet + 4 iş (16 madde) + 2 eğitim + 3 proje (6 madde) + 4 beceri satırı.
- **Kanca:** yok (K3 önerilir).

---

### Şablon 6. Çizgi (`cizgi`)

- **Kimlik:** sayfanın tepesinde ince vurgu şeridi; bölüm başlıkları renkli ve sağlarına ince çizgi uzanır.
- **Hedef:** biraz renk isteyen ama ciddi kalan; mühendislik, pazarlama, ürün.
- **Referans:** Awesome-CV (başlık + uzanan çizgi, tek vurgu); Reactive Resume Rhyhorn; CVwizard "Horizontal" (üst şerit).

```
┌▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀┐
│ Deniz Aksoy                      ( foto )│
│ Frontend Geliştirici (vurgu)             │
│ e-posta · telefon · şehir · web          │
│                                          │
│ Özet ─────────────────────────────────── │
│ metin                                    │
│ Deneyim ──────────────────────────────── │
│ Frontend Geliştirici        Şub 24 – Gün │
│ Lacivert Yazılım · İzmir                 │
│  • madde                                 │
│ Eğitim ───────────────────────────────── │
│ Beceriler ────────────────────────────── │
└──────────────────────────────────────────┘
```

```ts
{ id: 'cizgi', columns: [1], tags: ['accent_line'], headerAlign: 'left',
  colorSets: [ { id: 'mavi', accent: '#1d4e89' }, { id: 'camgobegi', accent: '#0f766e' }, { id: 'kirmizi', accent: '#b3261e' },
               { id: 'grafit', accent: '#374151' }, { id: 'murdum', accent: '#5b2a4e' } ],
  fonts: { body: 'source-sans-3', display: 'source-sans-3' },
  paper: '#ffffff', ink: '#1c2430', muted: '#5b6675', rule: '#d9dee5' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 1.03` = 10.0 pt; satır aralığı 1.38 |
| Kenar | yan 17 mm, üst/alt 15 mm |
| Blok / bölüm arası | 2.8 mm / 5.6 mm |

- **Üst şerit:** `.tpl-cizgi .page { background: linear-gradient(var(--accent) 0 2mm, var(--paper) 0) }`; her sayfada tekrar eder.
- **Başlık:** `grid-template-columns: minmax(0,1fr) auto`; alt iç boşluk 5 mm.
  - Fotoğraf: 26 mm daire, sağda.
  - Ad: 2.4em (24 pt), 700, -0.01em, satır 1.08. `--name-room: 140mm; --name-char: 0.60`.
  - Unvan: 1.12em, 600, `--accent-ink`, üst 1 mm.
  - İletişim: 0.95em, `--muted`, üst 2.2 mm.
- **Bölüm başlığı:** `display: flex; align-items: center; gap: 3mm`; metin 1.12em (11.2 pt), 700, `--accent-ink`, `text-transform: none`, harf aralığı 0; `::after { content: ''; flex: 1; border-top: 0.25mm solid var(--accent-light) }`.
- **Kayıt:** ortak varsayılan.
- **Madde:** `disc`; `li::marker` `--accent`.
- **Fotoğrafsız:** başlık tek sütun.
- **Yoğunluk:** 1 sayfa = Yalın ile aynı içerik + 1 kayıt.
- **Kanca:** K3.

---

### Şablon 7. Bant (`bant`)

- **Kimlik:** kenardan kenara düz koyu bant; içinde beyaz tırnaklı ad ve yuvarlak fotoğraf.
- **Hedef:** fotoğraflı, renkli ama düzgün; satış, turizm, sağlık, eğitim.
- **Referans:** FlowCV Cobalt Edge; Resume.io Vienna; Canva bant başlıklılar.

```
┌██████████████████████████████████████████┐
│█ Deniz Aksoy (beyaz, tırnaklı) ██( foto )│
│█ Frontend Geliştirici (italik) ██████████│
│█ e-posta · telefon · şehir · web ████████│
├──────────────────────────────────────────┤
│ Özet                                     │
│ ▬▬▬                                      │
│ metin                                    │
│ Deneyim                                  │
│ ▬▬▬                                      │
│ Frontend Geliştirici        Şub 24 – Gün │
│ Lacivert Yazılım · İzmir                 │
│  • madde                                 │
└──────────────────────────────────────────┘
```

```ts
{ id: 'bant', columns: [1, 2], tags: ['band'], headerAlign: 'left',
  colorSets: [ { id: 'lacivert', accent: '#14365a' }, { id: 'zumrut', accent: '#0b5d4b' }, { id: 'murdum', accent: '#5b2a4e' },
               { id: 'grafit', accent: '#2b2f36' }, { id: 'petrol', accent: '#0d5463' } ],
  fonts: { body: 'inter', display: 'literata' },
  paper: '#ffffff', ink: '#1c2430', muted: '#5b6675', rule: '#d9dee5' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 0.92` = 9.0 pt; satır aralığı 1.42 |
| Kenar | yan 17 mm, alt 14 mm |
| Blok / bölüm arası | 2.8 mm / 6 mm |

- **Başlık:** `background: var(--accent); color: var(--on-accent)`; **köşe yarıçapı 0**; iç boşluk 11 mm `--pad-x` 10 mm; altında 6 mm boşluk (`margin-bottom`). `grid-template-columns: minmax(0,1fr) auto`, dikey ortalı.
  - Fotoğraf: 30 mm daire, **bandın içinde**, sağda; `border: 0.7mm solid var(--on-accent)`. Taşma yok.
  - Ad: `--font-display` (Literata), 2.65em (24 pt), 600, satır 1.08, 0. `--name-room: 135mm; --name-char: 0.64`.
  - Unvan: Literata italik 400, 1.2em, `--on-accent-dim`, üst 1 mm.
  - İletişim: 0.95em, `--on-accent-muted`, üst 3 mm; ayırıcı `--on-accent-muted`.
  - Editör vurguları için başlıkta `--sg-surface: var(--accent); --sg-ink: var(--on-accent)`.
- **Bölüm başlığı:** `--font-display`, 1.3em (11.7 pt), 600, `--accent-ink`, `text-transform: none`; altında kısa çubuk: `::after { content: ''; display: block; width: 9mm; height: 0.7mm; margin-top: 1mm; background: var(--accent) }`.
- **Kayıt:** ortak varsayılan (kurum vurgu renginde değil).
- **İki sütun:** `--side-width: 31%`; yan sütun **zeminsiz** (kart yok); etiketler blok; sütunlar arası 8 mm.
- **Fotoğrafsız:** bant tek sütun; yükseklik içerikten.
- **Sayfa 2+:** bant yok; üst boşluk `--pad-y`.
- **Yoğunluk:** 1 sayfa = Yalın ile aynı içerik.
- **Kanca:** K3.

---

### Şablon 8. Çizelge (`cizelge`)

- **Kimlik:** tarihler solda kendi sütununda; bölüm başlıkları açık renkli şerit içinde.
- **Hedef:** Avrupa tipi tablo düzeni (Lebenslauf); kariyer sırası önemli olanlar; akademik.
- **Referans:** FlowCV Mercury Flow, Steady Form, Executive ("Popular" 2., 3., 6. sıra); ModernCV classic; Alman Lebenslauf.

```
┌──────────────────────────────────────────┐
│ Deniz Aksoy  Frontend Geliştirici  (foto)│
│ e-posta · telefon · şehir · web          │
│ ░░░░░░░░░░░░░░░░ Özet ░░░░░░░░░░░░░░░░░░ │
│ metin (tam genişlik)                     │
│ ░░░░░░░░░░░░░░ Deneyim ░░░░░░░░░░░░░░░░░ │
│ Şub 2024 –     Frontend Geliştirici      │
│ Günümüz        Lacivert Yazılım · İzmir  │
│                 • madde                  │
│ Haz 2023 –     Yazılım Stajyeri          │
│ Eyl 2023       Martı Teknoloji · İstanbul│
│ ░░░░░░░░░░░░░░ Eğitim ░░░░░░░░░░░░░░░░░░ │
│ Eyl 2020 –     Ege Üniversitesi          │
│ ░░░░░░░░░░░░░ Beceriler ░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────────┘
```

```ts
{ id: 'cizelge', columns: [1], datePosition: 'start', tags: ['date_column'], headerAlign: 'left',
  colorSets: [ { id: 'celik', accent: '#3b5b7a' }, { id: 'grafit', accent: '#4a4f57' }, { id: 'orman', accent: '#2f5d50' },
               { id: 'bordo', accent: '#7a2e2e' } ],
  fonts: { body: 'archivo', display: 'archivo' },
  paper: '#ffffff', ink: '#1c2430', muted: '#5b6675', rule: '#d9dee5' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 0.92` = 9.0 pt; satır aralığı 1.4 |
| Kenar | yan 16 mm, üst/alt 14 mm |
| Tarih sütunu | `--date-col: 30mm`; içerikle arası 4 mm |
| Blok / bölüm arası | 2.6 mm / 5 mm |

- **Başlık:** `grid-template-columns: minmax(0,1fr) auto`; alt iç boşluk 4.5 mm.
  - `.cv-heading { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 3mm }`: ad ve unvan aynı satırda; sığmazsa unvan alta iner.
  - Ad: 2.45em (22 pt), 700, -0.01em. `--name-room: 140mm; --name-char: 0.64`.
  - Unvan: 1.3em, italik 400, `--muted`.
  - İletişim: 0.95em, `--muted`, üst 2 mm.
  - Fotoğraf: 28 mm daire, sağda.
- **Bölüm başlığı:** `background: var(--accent-soft)`; metin **ortalı**, 1em, 700, `--ink`, `text-transform: none`; iç boşluk 1 mm 3 mm; köşe 0.
- **Kayıt (K1 ile):**
  - `.entry-head { display: grid; grid-template-columns: var(--date-col) minmax(0,1fr); column-gap: 4mm; align-items: baseline }`.
  - `.entry-date { grid-column: 1; white-space: normal; font-size: 0.92em; color: var(--ink) }`: uzun aralık iki satıra iner ("Şub 2024 –" / "Günümüz").
  - `.entry-title { grid-column: 2 }` (tarihsiz kayıtta da 2. sütun).
  - `.entry-sub, .entry-body { margin-left: calc(var(--date-col) + 4mm) }`.
  - Uygulanacak türler: experience, education, projects, certificates, awards, volunteer, custom, references.
- **Özet, beceri, dil:** tam genişlik (tarih sütunu payı yok).
- **Madde:** ortak.
- **Fotoğrafsız:** başlık tek sütun.
- **Yoğunluk:** gövde 144 mm'ye indiği için 1 sayfa = 3 satır özet + 3 iş (8 madde) + 1 eğitim + 2 proje + beceriler.
- **Kanca:** K1 (zorunlu), K3.

---

### Şablon 9. İsviçre (`isvicre`)

- **Kimlik:** bölüm adları solda dar etiket sütununda; her bölümün üstünde tam genişlik ince çizgi.
- **Hedef:** tasarım bilinci olan kurumsal; mimarlık, mühendislik, danışmanlık.
- **Referans:** Resume.io London (sitenin ilk şablonu); Resume Genius White House; Europass'ın etiket düzeni.

```
┌──────────────────────────────────────────┐
│   ┌────┐ ┃ Deniz Aksoy                   │
│   │foto│ ┃ FRONTEND GELİŞTİRİCİ          │
│   └────┘ ┃ e-posta · telefon · şehir     │
│ ──────────────────────────────────────── │
│     ÖZET   metin                         │
│ ──────────────────────────────────────── │
│  DENEYİM   Frontend Geliştirici  Şub–Gün │
│            Lacivert Yazılım · İzmir      │
│             • madde                      │
│ ──────────────────────────────────────── │
│   EĞİTİM   Ege Üniversitesi    Eyl–Haz   │
│ ──────────────────────────────────────── │
│ BECERİLER  Diller: …                     │
└──────────────────────────────────────────┘
```

```ts
{ id: 'isvicre', columns: [1], tags: ['label_column'], headerAlign: 'left',
  colorSets: [ { id: 'kirmizi', accent: '#c62828' }, { id: 'kobalt', accent: '#1f4fd1' }, { id: 'siyah', accent: '#161616' },
               { id: 'orman', accent: '#1f6b4f' } ],
  fonts: { body: 'ibm-plex-sans', display: 'ibm-plex-sans' },   // mono kaldırıldı
  paper: '#ffffff', ink: '#161616', muted: '#5f5f5f', rule: '#cfcfcf' }
```

| Ölçü | Değer | Bugün |
|---|---|---|
| Gövde | `--fs × 0.92` = 9.0 pt; satır aralığı 1.42 | 0.9 |
| Etiket sütunu | `--label-ratio: 0.22` (yaklaşık 39 mm); etiketin sağında 5 mm | 0.27; 6 mm |
| Kenar | yan 16 mm, üst 15 mm | |
| Blok arası | 2.4 mm | 3 mm |
| Bölüm | çizgiden önce 4 mm, çizgiden sonra 2.4 mm | 5.6 + 2.6 |

- **Başlık:** bugünkü ızgara kalır (etiket sütunu | içerik); alt iç boşluk 5 mm.
  - Fotoğraf: 24 × 24 mm kare, köşe 0, etiket sütununda sağa dayalı.
  - Kimlik: `border-left: 0.8mm solid var(--accent)` (bugün 1.1 mm), sol iç boşluk 4.5 mm.
  - Ad: 2.55em (23 pt; bugün 3.2em), **500** (bugün 300), -0.015em, satır 1.05. `--name-room: 125mm; --name-char: 0.62`.
  - Unvan: 0.86em, 500, büyük harf, 0.05em, `--muted`, üst 1.6 mm.
  - İletişim: **gövde ailesi** (mono değil), 0.95em, `--muted`, üst 2.2 mm, satır içi " ·".
- **Bölüm başlığı:** bugünkü ızgara tekniği kalır (h2 1. sütunda, ilk kayıtla aynı satırda; çizgi metinsiz `::before`). 0.82em, 600, büyük harf, 0.05em, `--ink`, sağa yaslı.
- **Kayıt:** tarih **gövde ailesi**, 0.92em, `tabular-nums`, `--muted`. Gerisi ortak.
- **Beceri ve dil:** ardışık satırlar arası 1 mm (bugün her biri tam blok aralığı).
- **Madde:** `disc`; işaret `--muted`.
- **Fotoğrafsız:** etiket hücresi boş; ad içerik sütununda kalır.
- **Yoğunluk:** örnek CV tek sayfaya sığmalı (bugün taşıyor): 3 satır özet + 3 iş (8 madde) + 1 eğitim + 2 proje + 3 beceri + 2 dil + 1 sertifika.
- **Kanca:** yok (K3 önerilir).

---

### Şablon 10. Yönetici (`yonetici`)

- **Kimlik:** tırnaklı, ferah, ağırbaşlı; iletişim iki ince çizgi arasında, bölümler kalın üst çizgiyle ayrılır, özet bir giriş paragrafı.
- **Hedef:** yönetici, direktör, kıdemli uzman, akademisyen; 2 sayfalık CV.
- **Referans:** FlowCV Executive ve Editorial Rule; Resume Genius Chicago (çift çizgi arasında iletişim); Novoresume Executive.

```
┌──────────────────────────────────────────┐
│                                          │
│  Deniz Aksoy (tırnaklı, 26 pt)   ┌─────┐ │
│  Frontend Geliştirici (italik)   │foto │ │
│                                  └─────┘ │
│  ──────────────────────────────────────  │
│  e-posta · telefon · şehir · web · in    │
│  ──────────────────────────────────────  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ÖZET                                    │
│  Giriş paragrafı, bir boy büyük.         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  DENEYİM                                 │
│  Frontend Geliştirici       Şub 24 – Gün │
│  Lacivert Yazılım · İzmir (italik)       │
└──────────────────────────────────────────┘
```

```ts
{ id: 'yonetici', columns: [1], tags: ['executive'], headerAlign: 'left',
  colorSets: [ { id: 'siyah', accent: '#1a1a1a' }, { id: 'lacivert', accent: '#1b2f4b' }, { id: 'bordo', accent: '#6e1f2b' },
               { id: 'orman', accent: '#234a3d' } ],
  fonts: { body: 'literata', display: 'literata' },
  paper: '#ffffff', ink: '#1a1a1a', muted: '#5f5f5f', rule: '#1a1a1a' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 0.96` = 9.4 pt; satır aralığı 1.42 |
| Kenar | yan 19 mm, üst/alt 17 mm |
| Blok / bölüm arası | 3 mm / 6.5 mm |

- **Başlık:** `grid-template-columns: minmax(0,1fr) auto`, üstten hizalı; alt iç boşluk 6 mm.
  - Fotoğraf: 26 × 32 mm, köşe 1 mm, sağ üstte. İletişim şeridi fotoğrafın soluna kadar gelir (kimlik 1. sütunda, fotoğraf 2. sütunda; şerit fotoğrafın altına uzamaz).
  - Ad: 2.75em (26 pt), 600, satır 1.05, -0.005em. `--name-room: 130mm; --name-char: 0.64`.
  - Unvan: 1.2em, italik 400, `--accent-ink`, üst 1.2 mm.
  - İletişim: üst 4.5 mm; `border-top` ve `border-bottom: 0.25mm solid var(--ink)`; iç boşluk 1.6 mm 0; 0.95em, `--ink`, satır içi " ·".
- **Bölüm başlığı:** `border-top: 0.5mm solid var(--ink)`; üst iç boşluk 1.4 mm; 0.84em, 700, büyük harf, 0.05em, `--accent-ink`. İlk kayda 2.2 mm.
- **Özet:** 1.12em (10.5 pt), satır aralığı 1.45, `--ink`.
- **Kayıt:** başlık 700. Tarih 0.92em `--muted`. Alt satır italik `--muted` (ilk parça da italik).
- **Madde:** `disc`, işaret 0.75em `--muted`; maddeler arası 0.8 mm.
- **Fotoğrafsız:** başlık tek sütun.
- **Yoğunluk:** bilerek ferah. 1 sayfa = 4 satır özet + 3 iş (8 madde) + 1 eğitim + beceriler; tipik kullanım 2 sayfa.
- **Kanca:** K3.

---

### Şablon 11. Portre (`portre`)

- **Kimlik:** sağ üstte büyük vesikalık; solda ad ve alt alta iki sütun iletişim listesi; bölüm başlıklarının solunda dikey vurgu çubuğu.
- **Hedef:** fotoğrafın beklendiği başvurular: Türkiye, Almanya, Avusturya, İsviçre, Fransa; kabin, turizm, perakende, ön büro.
- **Referans:** Alman Lebenslauf geleneği (4,5 × 6,5 cm, sağ üst); Novoresume Minimalist (iki sütun iletişim); Resume Genius "Social".

```
┌──────────────────────────────────────────┐
│ Deniz Aksoy                    ┌───────┐ │
│ Frontend Geliştirici (vurgu)   │       │ │
│                                │ foto  │ │
│ e-posta          telefon       │ 34×44 │ │
│ şehir            web           │       │ │
│ linkedin         github        └───────┘ │
│ ──────────────────────────────────────── │
│ ┃ ÖZET                                   │
│ metin                                    │
│ ┃ DENEYİM                                │
│ Frontend Geliştirici        Şub 24 – Gün │
│ Lacivert Yazılım · İzmir                 │
│ ┃ EĞİTİM                                 │
└──────────────────────────────────────────┘
```

```ts
{ id: 'portre', columns: [1, 2], tags: ['photo_large'], headerAlign: 'left',
  colorSets: [ { id: 'mavi', accent: '#1f5fa8' }, { id: 'petrol', accent: '#0f5c6e' }, { id: 'grafit', accent: '#374151' },
               { id: 'bordo', accent: '#8c2f39' }, { id: 'zumrut', accent: '#0b6e4f' } ],
  fonts: { body: 'inter', display: 'manrope' },
  paper: '#ffffff', ink: '#1c2430', muted: '#5b6675', rule: '#d9dee5' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 0.92` = 9.0 pt; satır aralığı 1.42 |
| Kenar | yan 17 mm, üst/alt 15 mm |
| Blok / bölüm arası | 2.8 mm / 6 mm |

- **Başlık:** `grid-template-columns: minmax(0,1fr) auto`, **üstten hizalı** (`align-items: start`), aralık 8 mm; kenar boşluğu `margin: 0 var(--pad-x)` ile verilir, alt iç boşluk 5 mm, `border-bottom: 0.25mm solid var(--rule)`, sonra 5 mm.
  - Fotoğraf: **34 × 44 mm**, köşe 1.5 mm, sağda.
  - Ad: `--font-display` (Manrope), 2.65em (24 pt), 700, -0.015em, satır 1.08. `--name-room: 122mm; --name-char: 0.64`.
  - Unvan: gövde ailesi, 1.15em, 600, `--accent-ink`, üst 1.2 mm.
  - İletişim: üst 5 mm; `display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 0.9mm 6mm`; `li { display: block }`; ayırıcı gizli (Panel'deki emsal); 0.95em, `--ink`. Yarıma sığmayan uzun öğe (`li.is-long`) `grid-column: 1 / -1`.
- **Bölüm başlığı:** `border-left: 1.1mm solid var(--accent)`; sol iç boşluk 2.4 mm; 0.95em, 700, büyük harf, 0.04em, `--ink`; satır aralığı 1.15.
- **Kayıt:** ortak varsayılan.
- **İki sütun:** `--side-width: 30%`, yan sütun solda zeminsiz; etiketler blok.
- **Fotoğrafsız:** başlık tek sütun; iletişim ızgarası 3 sütuna çıkar (`.no-photo .cv-contact { grid-template-columns: repeat(3, minmax(0,1fr)) }`). Baskıda yer tutucu kalkınca başlık kısalır, uzamaz.
- **Yoğunluk:** başlık yaklaşık 60 mm. 1 sayfa = 3 satır özet + 3 iş (7 madde) + 1 eğitim + beceriler + diller.
- **Kanca:** yok.

---

### Şablon 12. Denge (`denge`)

- **Kimlik:** ortalı büyük harfli ad; altında tam çizgi; gövde dikey ince çizgiyle ikiye bölünür, solda dar zeminsiz sütun.
- **Hedef:** Canva tarzı "minimal" isteyen; pazarlama, insan kaynakları, yönetici asistanı, yeni mezun.
- **Referans:** Canva "Harper Russo / Emma Sanchez" tipi minimal siyah-beyazlar; Deedy Resume (ortalı ad, 1/3 + 2/3); FlowCV Saffron Line.

```
┌──────────────────────────────────────────┐
│                 ( foto )                 │
│               DENİZ AKSOY                │
│           FRONTEND GELİŞTİRİCİ           │
│      e-posta · telefon · şehir · web     │
│ ──────────────────────────────────────── │
│ BECERİLER   │ ÖZET                       │
│ ─────────   │ ────────────────────────── │
│ Diller      │ metin                      │
│ TypeScript  │ DENEYİM                    │
│ DİLLER      │ ────────────────────────── │
│ ─────────   │ Unvan          Şub 24–Gün  │
│ Türkçe      │ Kurum · Şehir              │
│ SERTİFİKA   │  • madde                   │
└──────────────────────────────────────────┘
```

```ts
{ id: 'denge', columns: [2, 1], tags: ['divider'], headerAlign: 'center',
  colorSets: [ { id: 'grafit', accent: '#2f343b' }, { id: 'lacivert', accent: '#1f3a5f' }, { id: 'adacayi', accent: '#4c6a57' },
               { id: 'toprak', accent: '#8a5a3c' }, { id: 'murdum', accent: '#5b2a4e' } ],
  fonts: { body: 'source-sans-3', display: 'poppins' },
  paper: '#ffffff', ink: '#1f2328', muted: '#5f666e', rule: '#cfd3d8' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 1.0` = 9.75 pt; satır aralığı 1.4 |
| Kenar | yan 15 mm, üst/alt 15 mm |
| Sütun | `--side-width: 31%`; yan sağ iç 6 mm, ana sol iç 6 mm |
| Blok / bölüm arası | 2.8 mm / 5.6 mm |

- **Başlık:** ortalı; `margin: 0 var(--pad-x); padding: var(--pad-y) 0 5mm; border-bottom: 0.25mm solid var(--rule)`. Altında boşluk yok: sütunlar `padding-top: 5mm` ile başlar (`.page-inner.has-header .col`), böylece dikey çizgi yatay çizgiye değer.
  - Fotoğraf: 24 mm daire, adın üstünde, alt 3.5 mm.
  - Ad: `--font-display` (Poppins), 2.15em (21 pt), **500**, büyük harf, 0.05em, satır 1.1. `--name-room: 150mm; --name-char: 0.78`.
  - Unvan: gövde ailesi, 0.9em, 600, büyük harf, 0.05em, `--accent-ink`, üst 1.6 mm.
  - İletişim: 0.95em, `--muted`, üst 2.4 mm, ortalı.
- **Dikey çizgi:** `.cols-2 .col-main { background: linear-gradient(var(--rule), var(--rule)) no-repeat left top / 0.25mm calc(100% - var(--pad-y)) }`. Başlıksız sayfada: `background-position: left var(--pad-y); background-size: 0.25mm calc(100% - 2 * var(--pad-y))`. Kenarlık kullanma: sayfanın altına ve üstüne kadar uzar.
- **Bölüm başlığı:** gövde ailesi, 0.9em, 700, büyük harf, 0.05em, `--accent-ink`; alt iç boşluk 1 mm; `border-bottom: 0.25mm solid var(--rule)`.
- **Kayıt (ana):** ortak varsayılan.
- **Yan sütun:** etiket blok, 600; iki nokta K5 ile gizli; dil seviyesi alt satırda `--muted`.
- **Tek sütun:** dikey çizgi yok; başlık ve bölüm başlıkları aynı.
- **Sola yaslı hâl:** foto adın solunda, metin sola.
- **Fotoğrafsız:** ad en üstte.
- **Yoğunluk:** 1 sayfa = 3 satır özet + 3 iş (9 madde) + 1 eğitim + 2 proje; yanda 3 beceri grubu + diller + sertifikalar.
- **Kanca:** K5, K3.

---

### Şablon 13. Dergi (`dergi`)

- **Kimlik:** iri yumuşak tırnaklı ad, altında kalın siyah çizgi; bölüm başlıkları italik tırnaklı ve çizgisiz; özet giriş paragrafı.
- **Hedef:** tasarımcı, yazar, editör, mimar, iletişimci. Karakterli ama sakin.
- **Referans:** Reactive Resume Onyx (çizgisiz tırnaklı başlıklar); Resume.io Prague (renkli tırnaklı başlıklar); eski Çerçeve'nin iç düzeni ve eski Manşet'in editoryal fikri, ölçüsü indirilmiş hâliyle.

```
┌──────────────────────────────────────────┐
│                                          │
│  Deniz Aksoy (34 pt, Fraunces)  ┌─────┐  │
│  FRONTEND GELİŞTİRİCİ           │foto │  │
│  e-posta · telefon · şehir      └─────┘  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                          │
│  Özet (italik, vurgu)                    │
│  Giriş paragrafı, bir boy büyük.         │
│                                          │
│  Deneyim                                 │
│  Frontend Geliştirici       Şub 24 – Gün │
│  Lacivert Yazılım · İzmir                │
│   • madde                                │
└──────────────────────────────────────────┘
```

```ts
{ id: 'dergi', columns: [1, 2], tags: ['editorial'], headerAlign: 'left',
  colorSets: [ { id: 'kiremit', accent: '#a63d1e' }, { id: 'lacivert', accent: '#1f3a5f' }, { id: 'orman', accent: '#2f5d50' },
               { id: 'siyah', accent: '#161616' }, { id: 'bordo', accent: '#8c2f39' } ],
  fonts: { body: 'source-serif-4', display: 'fraunces' },
  paper: '#ffffff', ink: '#161616', muted: '#5f5f5f', rule: '#d4d4d4' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 0.97` = 9.5 pt; satır aralığı 1.42 |
| Kenar | yan 20 mm, üst/alt 17 mm |
| Blok / bölüm arası | 3 mm / 7 mm |

- **Başlık:** `grid-template-columns: minmax(0,1fr) auto`, alttan hizalı (`align-items: end`); `margin: 0 var(--pad-x); padding: var(--pad-y) 0 5mm; border-bottom: 0.9mm solid var(--ink)`; sonra 6 mm. Çizginin uçları düz.
  - Fotoğraf: 28 × 35 mm, köşe 0, sağda; `filter: grayscale(1)` (yalnız `img`; metin öğesi değil).
  - Ad: `--font-display` (Fraunces 600), **3.6em (34 pt)**, satır 1, -0.015em. Uzun adda (`is-long`) 2.9em. `--name-room: 128mm; --name-char: 0.60`. Ad tek satırda kalmalı; iki satıra yalnız 3+ kelimelik adlarda iner.
  - Unvan: gövde ailesi, 0.86em, 700, büyük harf, 0.05em, `--accent-ink`, üst 2.4 mm.
  - İletişim: 0.95em, `--muted`, üst 2 mm.
- **Bölüm başlığı:** Fraunces **italik 600**, 1.42em (13.5 pt), `--accent-ink`, `text-transform: none`, harf aralığı 0; çizgi yok. İlk kayda 1.6 mm.
- **Özet:** 1.15em (10.9 pt), satır aralığı 1.45, **düz ağırlık** (eski Manşet'teki kalın 15 pt değil).
- **Kayıt:** başlık 700. Tarih 0.95em italik `--muted`. Alt satır `--muted`.
- **Madde:** `disc`, işaret `--accent`.
- **İki sütun:** `--side-width: 30%`, yan sütun solda zeminsiz, **dikey çizgi yok** (Denge'den ayrışsın); sütunlar arası 9 mm.
- **Fotoğrafsız:** başlık tek sütun.
- **Yoğunluk:** ferah. 1 sayfa = 4 satır özet + 3 iş (8 madde) + 1 eğitim + beceriler.
- **Kanca:** K3.

---

### Şablon 14. Blok (`blok`)

- **Kimlik:** sayfanın sol üst köşesine dayalı kare fotoğraf ve yanında açık renkli ad bloğu; bölüm başlıkları küçük siyah etiket kutuları.
- **Hedef:** grafik, moda, reklam, medya; genç, cesur ama okunur.
- **Referans:** Resume.io Madrid ("Vivid"); Resume.io Toronto'nun siyah etiketleri; eski Afiş'in siyah kutu fikri, fosforsuz.

```
┌────────┬─────────────────────────────────┐
│        │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│  foto  │░ DENİZ AKSOY (kalın, siyah) ░░░░│
│ 42×42  │░ Frontend Geliştirici ░░░░░░░░░░│
│        │░ e-posta · telefon · şehir ░░░░░│
├────────┴─────────────────────────────────┤
│                                          │
│    ▐ÖZET▌                                │
│    metin                                 │
│    ▐DENEYİM▌                             │
│    Frontend Geliştirici     ŞUB 24 – GÜN │
│    Lacivert Yazılım · İzmir              │
│     • madde                              │
│    ▐EĞİTİM▌                              │
└──────────────────────────────────────────┘
```

```ts
{ id: 'blok', columns: [1, 2], tags: ['bold'], headerAlign: 'left',
  colorSets: [ { id: 'sari', accent: '#ffd84d' }, { id: 'kum', accent: '#e9dfcf' }, { id: 'buz', accent: '#d3e4f0' },
               { id: 'nane', accent: '#d3e9da' }, { id: 'siyahbeyaz', accent: '#ffffff' } ],
  fonts: { body: 'archivo', display: 'archivo' },
  paper: '#ffffff', ink: '#111111', muted: '#595959', rule: '#d4d4d4' }
```

| Ölçü | Değer |
|---|---|
| Gövde | `--fs × 0.92` = 9.0 pt; satır aralığı 1.4 |
| Kenar | gövdede yan 20 mm, alt 15 mm; başlık kenardan kenara |
| Blok / bölüm arası | 2.8 mm / 6 mm |

- **Başlık:** `padding: 0; gap: 0; display: grid; grid-template-columns: auto minmax(0,1fr); align-items: stretch`; altında 8 mm boşluk.
  - Fotoğraf: 42 × 42 mm kare, köşe 0, sayfanın sol üst köşesine dayalı.
  - Kimlik bloğu: `background: var(--accent-mark)` (üstünde `--ink` ≥ 4.5:1 garantili token); `min-height: 42mm`; iç boşluk 8 mm 12 mm; içerik dikey ortalı (`display: flex; flex-direction: column; justify-content: center`). Editör vurguları için `--sg-surface: var(--accent-mark)`.
  - Ad: 2.9em (26 pt), **800**, büyük harf, satır 0.98, -0.01em, `--ink`. `--name-room: 135mm; --name-char: 0.72`.
  - Unvan: 1.05em, 600, `--ink`, üst 1.4 mm.
  - İletişim: 0.95em, `--ink`, üst 2.6 mm, satır içi " ·"; ayırıcı `--ink`.
  - Başlığın altında her takımda `border-bottom: 1mm solid var(--ink)` çizilir. "Siyah-beyaz" takımında blok beyaz olduğu için başlığı bu çizgi kapatır; ayrı bir koşul yazmaya gerek kalmaz.
- **Bölüm başlığı:** `align-self: flex-start; background: var(--ink); color: var(--paper)`; 0.8em, 700, büyük harf, 0.05em; iç boşluk 0.7 mm 2.2 mm; köşe 0. İlk kayda 2.2 mm.
- **Kayıt:** başlık 700. Tarih sağda 0.82em, 600, büyük harf, 0.04em, `--muted`. Alt satır `--muted`. **Fosfor yok.**
- **Madde:** `disc`, işaret `--ink`.
- **İki sütun:** `--side-width: 31%`, solda zeminsiz; sütunlar arası 8 mm.
- **Fotoğrafsız:** blok kenardan kenara; `min-height: 34mm`.
- **Sayfa 2+:** başlık yok; üst boşluk `--pad-y`.
- **Yoğunluk:** 1 sayfa = 3 satır özet + 3 iş (8 madde) + 1 eğitim + beceriler.
- **Kanca:** K3.

---

## 4. Galeri

### 4.1 Sıra ve kart etiketleri

Sıra `TEMPLATE_META` dizisinin sırasıdır. Sütun etiketi (`Tek sütun` / `İki sütun` / `Tek ya da iki sütun`) bugünkü gibi `columns`'tan gelir; yanına tek özellik etiketi eklenir.

| Sıra | Ad | id | `tag` | Etiket (TR) | Etiket (EN) | Kart açıklaması (TR) |
|---|---|---|---|---|---|---|
| 1 | Yalın | `yalin` | `plain` | En sade | Plain | Çizgisiz, süssüz; küçük kare fotoğraf ve bol boşluk. Her başvuruya uyar. |
| 2 | Zarif | `zarif` | `serif` | Tırnaklı klasik | Classic serif | Ortalı tırnaklı ad, başlıkların iki yanında ince çizgi. Hukuk, finans, akademi. |
| 3 | İkili | `ikili` | `side_right` | Sağda dar sütun | Right column | Deneyim solda, beceriler sağda; kalın çizgili başlıklar. Tek sayfaya çok şey sığar. |
| 4 | Panel | `panel` | `dark_side` | Koyu yan sütun | Dark sidebar | Solda koyu sütun ve yuvarlak fotoğraf; ad beyaz alanda. |
| 5 | Teknik | `teknik` | `dense` | Yoğun, tek sayfa | Dense one-pager | Siyah-beyaz, sık satırlı; yazılım ve mühendislik başvurularının standardı. |
| 6 | Çizgi | `cizgi` | `accent_line` | Vurgu çizgili | Accent line | Üstte ince renk şeridi, başlıkların sağına uzanan çizgi. |
| 7 | Bant | `bant` | `band` | Renkli bant | Colour band | Kenardan kenara koyu bant; içinde beyaz ad ve fotoğraf. |
| 8 | Çizelge | `cizelge` | `date_column` | Tarihler solda | Dates on the left | Tarihler ayrı sütunda, başlıklar açık şeritte; Avrupa tipi tablo düzeni. |
| 9 | İsviçre | `isvicre` | `label_column` | Sol etiket sütunu | Label column | Bölüm adları solda dar sütunda, aralarında ince çizgiler. |
| 10 | Yönetici | `yonetici` | `executive` | Ferah, tırnaklı | Executive | Geniş boşluklu, ağırbaşlı; özet bir giriş paragrafı gibi. |
| 11 | Portre | `portre` | `photo_large` | Büyük fotoğraf | Large photo | Sağ üstte vesikalık, solda düzenli iletişim listesi. |
| 12 | Denge | `denge` | `divider` | Ortalı ad, iki sütun | Centred, two columns | Büyük harfli ortalı ad; gövde ince dikey çizgiyle ikiye ayrılır. |
| 13 | Dergi | `dergi` | `editorial` | İri tırnaklı ad | Editorial | Büyük yumuşak tırnaklı ad ve italik başlıklar. Yaratıcı işler için. |
| 14 | Blok | `blok` | `bold` | Renk bloğu | Colour block | Köşeye dayalı fotoğraf, yanında renkli ad bloğu, siyah etiket başlıklar. |

Yeni `TemplateTag` birleşimi: `'plain' | 'serif' | 'side_right' | 'dark_side' | 'dense' | 'accent_line' | 'band' | 'date_column' | 'label_column' | 'executive' | 'photo_large' | 'divider' | 'editorial' | 'bold'`. Silinenler: `big_name`, `dark`, `timeline`, `highlight`, `frame`.

Kategori sekmesi hâlâ gerekmiyor (14 kart). İstenirse tek ayrım yeter: ilk 12 "İş başvurusu", son 2 "Yaratıcı".

### 4.2 Yeni mesaj anahtarları

- `template_<id>_name`, `template_<id>_desc`: 9 yeni id (`yalin, ikili, teknik, cizgi, yonetici, portre, denge, dergi, blok`) ve yeniden yazılan `cizelge`; 4 düzeltilenin açıklaması güncellenir; silinen 5 id'nin (`manset, gece, cift, afis, cerceve`) anahtarları kaldırılır.
- `tag_<id>`: yukarıdaki 14.
- `color_<id>` yeni olanlar: `celik`, `petrol`, `fildisi`, `sis`, `toprak`, `kiremit`, `buz`, `nane`. Diğerleri bugün var.

### 4.3 Küçük resim

- Örnek CV sayfanın %85-95'ini doldurmalı: `src/cv/sample.ts`'teki uydurma kişiye 1 iş, 1 eğitim ve 2-3 madde daha eklenmeli. Bugün tek sütunlu kartlar yarım sayfa görünüyor.
- Fotoğraf yerinde silüet (bugünkü gibi).
- Galeri notu ("Hepsi ATS'nin okuyabileceği düzende") kalır.

---

## 5. Ortak kalite çıtası

Bütün şablonlarda geçerli. Bir şablon ancak bunları sağlıyorsa "bitti" sayılır.

### 5.1 Tipografi

| Kural | Değer |
|---|---|
| Gövde | orta boyda 8.8-10.6 pt. Büyük x yüksekliği (Inter, Archivo, Plex, Franklin) 8.8-9.2; Source Sans 9.75-10; tırnaklılar 9.4-9.75; Garamond 10.6 |
| Satır aralığı | gövdede 1.27-1.45. Yoğun şablon 1.27-1.38, ferah 1.42-1.45 |
| Satır uzunluğu | tek sütunda 85-115 karakter; ana sütunda (iki sütun) 60-80 |
| Ad | 20-27 pt. İstisna yalnız Dergi (34 pt). Ad gövdenin 2.1-2.9 katı |
| Unvan | adın %40-50'si; adla arası 0.6-1.8 mm |
| Bölüm başlığı | gövdeden ayrışmalı: ya en az 1.12em, ya da büyük harf + 700 + çizgi/zemin. Yalnız "0.8em büyük harf" yetmez |
| Boy sayısı | bir şablonda en çok 5 ayrı boy: ad, unvan, bölüm başlığı, gövde, küçük (tarih/iletişim) |
| Ağırlık | en çok 3: 400, 600 (ya da 500), 700. Aynı satırda iki kalın yan yana gelmez |
| Aile | en çok 2 (başlık + gövde). Eş aralıklı aile yok |
| İtalik | yalnız italiği olan ailede (`font-synthesis: none`). Manrope, Space Grotesk, Poppins, DM Serif (700) için italik isteme |
| Büyük harf | yalnız kısa etiketlerde (bölüm başlığı, unvan); 0.04-0.05em. Türkçe için `<html lang>` şart (i → İ) |
| Rakam | tarihlerde `tabular-nums` |

### 5.2 Boşluk ritmi

| Aralık | Oran / değer |
|---|---|
| Bölüm arası : blok arası | 1.8-2.4 kat |
| Bölüm başlığı → ilk kayıt | 1.2-2.2 mm (blok aralığından küçük: başlık kendi içeriğine yapışır) |
| Kayıt başlığı → alt satır | 0 (aynı satır aralığı) |
| Alt satır → gövde | 1-1.2 mm |
| Maddeler arası | 0.3-0.8 mm |
| Ardışık beceri/dil satırları | 0.6-1.2 mm (ayrı blok aralığı değil) |
| Başlık (header) → gövde | 4.5-8 mm |
| Kenar boşluğu | yan 13-20 mm, üst/alt 12-17 mm. 12 mm'nin altı yok: ev yazıcıları kırpar |
| Kural | bir şablonda bütün dikey boşluklar en çok 5 farklı değerden seçilir |

### 5.3 Hiza

- Tek sol kenar: ad, bölüm başlıkları, kayıt başlıkları, özet aynı x'te başlar (etiket ve tarih sütunlu şablonlarda içerik sütununun sol kenarı).
- Tarihler tek sağ kenarda, kayıt başlığıyla aynı taban çizgisinde (`align-items: baseline`), bölünmez. Başlıkla arası en az 4 mm; başlık uzunsa başlık satıra kırılır, tarih kırılmaz.
- Çizgiler kenar boşluğuna oturur: `--pad-x`'ten `--pad-x`'e. Yarım kalan, farklı uzunlukta çizgi yok.
- Yan sütunla ana sütunun ilk bölüm başlıkları aynı y'de başlar.
- Madde işareti kayıt başlığının sol kenarından en çok 4 mm içeride; ikinci satır metnin altına hizalanır.
- Fotoğrafın üst kenarı adın büyük harf yüksekliğiyle ya da başlık iç boşluğuyla hizalı; "arada bir yerde" durmaz.

### 5.4 Renk ve çizgi

- Bir vurgu rengi. Vurgunun kapladığı alan: zeminli şablonlar (Panel, Bant, Blok) dışında sayfanın %5'inden az.
- Gövde metni her zaman `--ink`. Kurum satırı, tarih, madde metni vurgu renginde olmaz (tek istisna İkili'nin kurum adı).
- Soluk metin (`--muted`) kâğıda karşı en az 4.5:1; tarih ve iletişim dahil.
- Metin rengi CSS'te karıştırılmaz; token kullanılır (base.css sözleşmesi).
- Çizgi kalınlığı: ince 0.25 mm, kalın 0.5-0.9 mm. Bir şablonda en çok 2 kalınlık.
- Köşe yarıçapı: yalnız fotoğrafta (0, 1-2 mm ya da tam daire). Zemin ve kutularda 0.
- Yasak: gölge, gradyan (sayfa zemini için düz renk geçişli `linear-gradient` tekniği hariç), halka, hap, çip, nokta, ikon, beceri çubuğu, fosfor, çerçeve, tam sayfa koyu zemin.

### 5.5 Sayfalama (dul ve yetim)

Mevcut kurallar aynen: sığan kayıt bölünmez; bölüm başlığı sayfa dibinde yalnız kalmaz; uzun kayıt maddeler arasından bölünür. Ek çıta:

- Bölünen kayıtta her iki sayfada en az 2 madde kalır; tek madde yetim bırakılmaz.
- Bölüm başlığından sonra aynı sayfada o kaydın en az başlığı + alt satırı + 1 maddesi bulunur.
- Son sayfada 4 satırdan az içerik kalıyorsa editör "bir sayfaya sığdır" önerir (sıkı aralığa geçiş); bu bir arayüz notudur, şablon işi değil.
- İletişim satırı en çok 2 satır (Portre'nin ızgarası hariç). Satır ayırıcıyla bitmez (K3).
- Ad kelime ortasından bölünmez (mevcut `--name-*` düzeneği).

### 5.6 Fotoğraf

- Fotoğrafsız hâl ayrı bir tasarım değil, aynı düzenin `auto` sütunu kapanmış hâlidir; hiçbir şablonda boş fotoğraf yuvası kalmaz (Panel'in koyu hücresi hariç: orada sütun sürer).
- Yer tutucu baskıda kalkınca başlık uzamaz (base.css kuralı).
- Biçimler: daire (Zarif, İkili, Panel, Çizgi, Bant, Çizelge, Denge), yuvarlak köşeli kare (Yalın), kare (İsviçre, Blok), dikey dikdörtgen (Teknik, Yönetici, Portre, Dergi).

### 5.7 ATS (değişmedi, hatırlatma)

- DOM sırası = okuma sırası; `order`, `*-reverse`, metinde `position` yok. K1 ve K2 bu yüzden markup'ta çözülüyor, CSS'te değil.
- İletişim başlıkta. Metin `::before/::after` ile üretilmez. Harf aralığı ≤ 0.05em.
- Metin taşıyan öğede opacity, transform, filter, z-index yok (Dergi'nin gri tonu yalnız `img`'de).
- Gizlenen ayırıcılar (Panel, Portre iletişimi; Teknik alt satırı; K5 iki noktası) görsel ayrımı boşlukla korur; `e2e/ats.spec.ts` her yeni şablonda ve iki sütun hâlinde çalıştırılır. K1 ve K2 için teste iki beklenti eklenir: Çizelge'de "tarih, sonra unvan" sırası; İkili'de "deneyim, sonra beceriler" sırası.

### 5.8 Kabul ölçütü (her şablon için)

1. Örnek CV ile fotoğraflı ve fotoğrafsız, Türkçe ve İngilizce, 1 ve 3 sayfalık ekran görüntüsü alındı.
2. Görüntü, şartnamedeki referans tasarımın yanına konup karşılaştırıldı.
3. §5.1-5.4'teki sayılar ölçüldü (ad boyu, bölüm arası, kenar, tarih hizası).
4. `e2e/ats.spec.ts` ve `e2e/stress.spec.ts` geçti.
5. Ürün sahibine sorulacak tek soru: "Bunu kendi başvurunda kullanır mıydın?" Cevap hayırsa şablon sete girmez.

---

## 6. Uygulama sırası önerisi

1. **Motor:** K1, K2, K3, K4, K5, K6, K7 ve göç v3. Şablon CSS'leri bunlara dayanıyor.
2. **Önce 4 temel şablon:** Yalın, Teknik, İkili, Zarif. Ürün sahibine gösterilir; çıta burada oturur.
3. **Sonra:** Panel, Bant, İsviçre (düzeltmeler), Çizgi, Çizelge.
4. **Sonra:** Yönetici, Portre, Denge.
5. **En son:** Dergi, Blok.

Açık kalan, karar bekleyen noktalar:
- K2 kabul edilmezse İkili sol sütunla çıkar; o durumda Denge ile fazla benzeşir ve ikisinden biri (öneri: İkili) setten düşer, set 13'e iner.
- K6 (Libre Franklin) kabul edilmezse İkili'nin gövdesi Inter olur; Yalın ile aynı aileyi paylaşır.
- Teknik'in dört köşeli alt satırı ATS testindeki ayırıcı beklentisine takılırsa düz satıra dönülür.
- Akademik için ayrı şablon yok: ayırt edici tek özelliği (sayfa üstünde ad ve sayfa numarası) motorun bugün yapmadığı bir iş. Akademik kullanıcıya Zarif, Çizelge ve Teknik önerilir.
