---
version: beta
name: CVeditör
description: >-
  Tarayıcıda çalışan, şablonlu CV editörü. Arayüz Apple'ın uygulama dilini (macOS/iPadOS üretkenlik
  uygulamaları) izler: gri pencere + beyaz gruplar, tek vurgu rengi, sistem metin stilleri, işlevsel
  malzeme, kesilebilir yaylı hareket. CV her ekranda sahnenin yıldızı, arayüz geri planda.
  2026-11-19: Apple şartnamesiyle baştan yazıldı. Kaynak: src/styles/app.css (token), src/components/ui (bileşen).
colors:
  # Açık tema (varsayılan) / koyu tema ([data-theme='dark'])
  bg-window:        { light: "#F5F5F7", dark: "#1C1C1E" }
  bg-canvas:        { light: "#E5E5EA", dark: "#141416" }
  bg-content:       { light: "#FFFFFF", dark: "#2C2C2E" }
  bg-elevated:      { light: "#FFFFFF", dark: "#2C2C2E" }
  bg-paper:         { light: "#FFFFFF", dark: "#FFFFFF" }
  fill-1:           { light: "rgb(120 120 128 / .20)", dark: "rgb(120 120 128 / .36)" }
  fill-2:           { light: "rgb(120 120 128 / .16)", dark: "rgb(120 120 128 / .32)" }
  fill-3:           { light: "rgb(118 118 128 / .12)", dark: "rgb(118 118 128 / .24)" }
  fill-4:           { light: "rgb(116 116 128 / .08)", dark: "rgb(116 116 128 / .18)" }
  text-1:           { light: "#1D1D1F", dark: "#F5F5F7" }
  text-2:           { light: "#6C6C70", dark: "#AEAEB2" }
  text-3:           { light: "#86868B", dark: "#98989D" }
  separator:        { light: "rgb(0 0 0 / .08)", dark: "rgb(255 255 255 / .08)" }
  separator-strong: { light: "#D1D1D6", dark: "#48484A" }
  control-border:   { light: "#8E8E93", dark: "#8E8E93" }
  ring-elevated:    { light: "rgb(0 0 0 / .08)", dark: "rgb(255 255 255 / .12)" }
  accent:           { light: "#00786F", dark: "#2CC7B5" }   # Petrol (varsayılan); diğerleri aşağıda
  accent-fg:        { light: "#FFFFFF", dark: "#00201C" }
  accent-hover:     { light: "color-mix(srgb, accent 90%, black)", dark: "color-mix(srgb, accent 88%, white)" }
  accent-pressed:   { light: "color-mix(srgb, accent 80%, black)", dark: "color-mix(srgb, accent 76%, white)" }
  accent-soft:      { light: "accent %10", dark: "accent %14" }
  focus-ring:       "accent %80"
  danger:           { light: "#D70015", dark: "#FF6165" }
  warn:             { light: "#9A5B00", dark: "#FFA056" }
  ok:               { light: "#007A2D", dark: "#4AD968" }
  suggest:          { light: "#FFCC00", dark: "#FFD600" }
  "*-soft":         { light: "renk %10", dark: "renk %14" }
  accents:          # src/lib/prefs.ts ACCENTS + index.html ilk boyama haritası
    petrol:   { light: "#00786F", dark: "#2CC7B5" }
    murekkep: { light: "#0A5FD8", dark: "#5CB8FF" }
    kiremit:  { light: "#B8500F", dark: "#FFA056" }
    orman:    { light: "#1B7F3B", dark: "#4AD968" }
    grafit:   { light: "#48484A", dark: "#D1D1D6" }
  # CV kâğıdı (src/render). Temadan bağımsız, her zaman açık.
  cv-ink: "#1c1c1e"
  cv-muted: "#5a5a60"
  cv-rule: "#d6d6db"
  cv-paper: "#ffffff"
typography:
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter Variable', 'Segoe UI', system-ui, sans-serif"
  title-lg:  { size: 26px, lineHeight: 32px, weight: 700, letterSpacing: -0.01em }
  title-1:   { size: 22px, lineHeight: 28px, weight: 700, letterSpacing: -0.01em }
  title-2:   { size: 17px, lineHeight: 22px, weight: 600 }
  title-3:   { size: 15px, lineHeight: 20px, weight: 600 }
  headline:  { size: 13px, lineHeight: 18px, weight: 600 }
  body:      { size: 13px, lineHeight: 18px, weight: 400 }   # telefonda 16/22
  body-user: { size: 14px, lineHeight: 21px, weight: 400 }   # telefonda 16/24
  callout:   { size: 12px, lineHeight: 16px, weight: 400 }   # telefonda 13/18
  caption:   { size: 11px, lineHeight: 14px, weight: 500 }
  cv-body-sm: { fontSize: 9.25pt }
  cv-body-md: { fontSize: 9.75pt }
  cv-body-lg: { fontSize: 10.5pt }
rounded:
  xs: 4px     # onay kutusu, kbd, rozet
  sm: 6px     # 24px kontrol, segmented başparmağı, ipucu
  md: 8px     # 28px kontrol, menü öğesi, küçük resim
  lg: 10px    # 36px metin alanı, grup içi odak
  xl: 12px    # grup, kart, menü, popover, prompt kutusu
  2xl: 16px   # dialog
  3xl: 20px   # telefonda alt sayfanın üst köşeleri
  full: 9999px # 36px+ düğme, anahtar, bildirim, hap
  page: 0     # A4 kâğıdı
spacing:
  root: 16px            # html kökü tarayıcı varsayılanı; Tailwind adımı 4px
  grid: 4px             # bütün ölçüler 4'ün katı, tam piksel
  control-heights: [24, 28, 36, 44]
  container: 1240px
  inspector: { default: 440px, min: 360px, max: "560px | %45" }
  toolbar: 52px
  inspector-header: 44px
  editor-breakpoint: 900px
  cv-compact: { block-gap: 2.2mm, section-gap: 4.2mm, pad-x: 14mm, pad-y: 12mm, line-height: 1.32 }
  cv-normal:  { block-gap: 3mm,   section-gap: 5.6mm, pad-x: 16mm, pad-y: 14mm, line-height: 1.4 }
  cv-relaxed: { block-gap: 4mm,   section-gap: 7mm,   pad-x: 18mm, pad-y: 16mm, line-height: 1.48 }
motion:
  dur-press: 100ms
  dur-exit: 120ms
  dur-fast: 150ms
  dur-base: 200ms
  dur-slow: 300ms
  ease-out: "cubic-bezier(0.23, 1, 0.32, 1)"
  ease-in-out: "cubic-bezier(0.77, 0, 0.175, 1)"
  ease-sheet: "cubic-bezier(0.32, 0.72, 0, 1)"
  spring-smooth: "Spring(0.2s, bounce 0) → linear(…) 300ms"
  spring-snappy: "Spring(0.2s, bounce 0.15) → linear(…) 280ms"
  spring-bouncy: "Spring(0.18s, bounce 0.3) → linear(…) 300ms, yalnız ≤ 24px öğe"
---

# CVeditör tasarım rehberi

Arayüz kuran ya da değiştiren her oturum bu dosyaya uyar. Değerler bağlayıcıdır; tek kaynak `src/styles/app.css` (token) ve `src/components/ui/` (bileşen). Kod ile bu dosya çeliştiğinde önce Asil'e sorulur; Asil'in sonraki geri bildirimi bu dosyayı da günceller.

Bileşenlerin canlı vitrini: geliştirme sunucusunda **`/_ui`** (yalnız `import.meta.env.DEV`; üretim paketine girmez). Yeni bileşen ya da durum eklersen vitrine de ekle.

## 1. İlkeler

1. **İçerik önde, krom geride.** Ekranın en parlak ve en büyük nesnesi CV kâğıdıdır (önizleme, küçük resim, galeri). Panel, çubuk, galeri zemini gri tonda geri çekilir; beyaz yalnız içerik yüzeylerinde (kâğıt, grup, menü).
2. **İki katmanlı zemin: gri pencere + beyaz gruplar.** Derinlik çerçeveyle değil ton farkıyla verilir. Çerçeve çizgisi yalnız ayırıcıda, grup dışı alanda ve onay kutusunda.
3. **Kart değil grup.** İlgili satırlar tek yuvarlak blokta, aralarında metnin x'inden başlayan ince ayırıcı. Kutu içinde kutu yok; grup içindeki alan çıplaktır, satırın kendisi alandır.
4. **Tek öne çıkan eylem.** Görünümde bir (en çok iki) dolgulu düğme. Tercih boyutla değil stille ayrılır. Yıkıcı eylem asla birincil, asla dolgulu kırmızı, asla Enter'ın hedefi değildir.
5. **Renk tasarrufu.** Vurgu yalnız birincil eylem, seçim, odak ve bağlantıda; etkileşimsiz metinde yok. Durum rengi nokta/ikon boyutunda. Aynı renk iki anlama gelmez.
6. **Sistem yazısı, adlandırılmış metin stilleri.** Hiyerarşi önce ağırlık, sonra boyut, en son renk. Bir ekranda en çok üç boyut. Rol dışı boyut (`text-[13.5px]`) yazılmaz. Light/Thin ağırlık yok.
7. **Tam piksel, 4'lük ızgara, ortak sol kenar.** Bir paneldeki bölüm başlığı, satır metni ve grup altı notu aynı x'te başlar. Girinti hiyerarşi demektir.
8. **Eş merkezli köşeler.** İç yarıçap = dış yarıçap − aradaki boşluk (menü 12 / öğe 8; grup 12 / odak 10). 36px ve üstü düğme kapsül, 28px kontrol 8px.
9. **Malzeme işlevseldir.** Yarı saydam yüzey YALNIZ dört yerde (bkz. §5). İçerik katmanında, dialogda, menüde, kartta asla; üst üste iki malzeme yok.
10. **Sert çizgi yerine kaydırma kenarı.** Çubuğun ayırıcısı yalnız içerik altına girince belirir.
11. **Anında tepki, kesilebilir hareket.** Geri bildirim basışta verilir; animasyon girdiyi kilitlemez, yarıda yön değiştirir; sık yapılan ve klavyeyle tetiklenen işte animasyon yok.
12. **Mekânsal tutarlılık.** Bir şey nereden geldiyse oraya gider; menü/popover tetikleyicisinden büyür, dialog merkezden, panel kenarından.
13. **Tanıdık desenler.** Geri = `‹` ikon (yazı değil), sol başta. Birincil eylem araç çubuğunun sağ ucunda. Dialogda Vazgeç solda, eylem sağda. `⋯` = diğer işlemler. Başka pencere açan etiket "…" ile biter ("Yeniden adlandır…").
14. **Erişilebilirlik tasarımın parçası.** Okunan metin ≥ 4.5:1; renk tek işaret değil; `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more` karşılanır.

Ürün kuralları (değişmez):
- **Kullanıcıya "sen" diye hitap edilir.** Bütün metinler `messages/tr.json` + `messages/en.json`'da (`m.anahtar()`); bileşene sabit metin yazılmaz. CV dilindeki metinler ayrı (`src/cv/locale.ts`).
- **Metin "…" ile kesilmez.** Uzun metin sarar, satır büyür; yapıyla çözülür (iki satır, geniş sütun). `truncate` / `line-clamp` yeni kodda yok.
- **Saklamak = silmek.** Kontrol yalnız hover'da görünmez. "Sadelik minimalizm değildir": her şeyi `⋯` arkasına gömmek sade değildir.
- **Açık tema varsayılan + tek anahtarla koyu.** "Sistem" seçeneği yok (`Theme = 'light' | 'dark'`); `index.html` ilk boyamadan önce uygular. Apple sistem ayarını izlemeyi önerir; bu bilinçli sapma.
- **Masaüstü öncelikli.** Telefonda CV'lerim, önizleme ve PDF; editör yerine "bilgisayardan aç" notu.
- **Logo yok, yazı var:** `Wordmark` ("CV" + vurgu renginde "editör").
- **Örnek veri uydurmadır** (`src/cv/sample.ts`) ve örnek olduğu yazılır.

## 2. Token'lar

Tailwind sınıfı → CSS değişkeni. Renkler `@theme inline` (değer temaya göre değişir), yazı ve yarıçap `@theme` (telefonda değişken değişir). Değerler yukarıdaki ön bilgide.

### 2.1 Zemin ve dolgu

| Sınıf | Değişken | Kullanım |
|---|---|---|
| `bg-window` | `--bg-window` | Sayfa zemini, inspector paneli, malzemenin tonu |
| `bg-canvas` | `--bg-canvas` | YALNIZ CV önizlemesinin arkası |
| `bg-content` | `--bg-content` | Grup, kart, liste, grup dışı alan |
| `bg-elevated` | `--bg-elevated` | Menü, popover, dialog, ipucu, bildirim; her zaman gölge/halka ile |
| `bg-paper` | `--bg-paper` | A4 kâğıdı; koyu temada da beyaz |
| `bg-fill-1` | `--fill-1` | Basılı durum, kapalı anahtar rayı |
| `bg-fill-2` | `--fill-2` | İkincil düğme hover, açık/seçili ikon düğmesi |
| `bg-fill-3` | `--fill-3` | İkincil düğme, segmented rayı, beyaz üstündeki alan, ikon düğmesi hover |
| `bg-fill-4` | `--fill-4` | Satır hover, menü öğesi vurgusu |

Dolgular yarı saydamdır; hem beyaz hem gri zeminde çalışır.

### 2.2 Metin

| Sınıf | Değişken | Kontrast (açık) | Kullanım |
|---|---|---|---|
| `text-fg` | `--text-1` | beyazda 16.8 | Ana metin, alan değeri, başlık, ikon |
| `text-fg-2` | `--text-2` | beyazda 5.23, pencerede 4.80 | Etiket, açıklama, ikincil bilgi, **yer tutucu** |
| `text-fg-3` | `--text-3` | beyazda 3.62 | YALNIZ süs (ayırıcı `·`, şerit oku, tutamak) ve devre dışı metin |

- **Yer tutucu ≥ 4.5:1** (karar): `::placeholder` ve TipTap yer tutucusu `--text-2`.
- `text-fg-2` tuvalde (4.16) ve gri pencere üstündeki dolguda (4.20) 4.5'in altında: oralarda `text-fg`.
- Malzeme üstünde yalnız `text-fg` ve vurgu dolgulu düğme; gri metin yok.

### 2.3 Ayırıcı, kenar, vurgu, durum

| Sınıf | Kullanım |
|---|---|
| `border-separator` / `bg-separator` | Grup içi satır ayırıcı, bölme çizgisi, kaydırma kenarı |
| `border-separator-strong` | Grup dışı alanın kenarı (inset halka), sürükleme hedefi |
| `border-control` (`--control-border`) | Onay kutusu ve radyo kenarı (3:1) |
| `bg-accent` / `text-accent-fg` | Birincil düğme, seçili onay/radyo, açık anahtar |
| `hover:bg-accent-hover`, `active:bg-accent-pressed` | Birincil düğme durumları |
| `text-accent` | Bağlantı, düz düğme ("+ Ekle"). Tuvalde metin olarak kullanılmaz (4.27) |
| `bg-accent-soft` | Seçili satır, önizlemeden gelen kayıt işareti, bırakma hedefi |
| `outline-focus-ring` (`--focus-ring`) | Odak halkası |
| `text-danger`, `text-warn`, `text-ok` | Durum metni/ikonu. Sistem renkleri beyaz yazıyla 4.5'i tutmadığından dolgu olarak değil yalnız nokta/ikon |
| `bg-*-soft` | YALNIZ kullanıcıyı uyaran rozet ("Örnek") ve öneri farkı. Renkli bant yok |
| `bg-suggest` / `bg-suggest-soft` | Yapay zekâ önerisi işareti (üstünde `text-fg`) |

**Vurgu değişkendir.** Petrol (varsayılan), Mürekkep, Kiremit, Orman, Grafit; her biri açık + koyu çift (koyu, açıktan türetilmez). `prefs.ts` kökte `--accent-light` / `--accent-dark` verir. Tasarım beşinde de çalışmalı; vurgunun belirli bir renk olduğunu varsayma. Renk yalnız token'la verilir; bileşende hex yok (`bg-[#…]` yok). Yeni anlam gerekiyorsa önce `app.css`'e açık + koyu token ekle.

`prefers-contrast: more`: `--separator` → `--control-border`, alan kenarı `#6C6C70`.

### 2.4 Yazı

Arayüz yazısı: Apple cihazlarda SF Pro (`-apple-system`, `BlinkMacSystemFont`; gömülmez), diğerlerinde **Inter Variable** (`@fontsource-variable/inter/opsz.css`, `wght` + `opsz`, latin-ext). `system-ui` bilerek sonda (başta olsa Windows'ta Segoe UI'ye düşerdi). Instrument Sans kalktı. Gövdeye `font-feature-settings` verilmez; sayılarda `tabular-nums`.

| Sınıf | px / satır / ağırlık | Kullanım |
|---|---|---|
| `text-title-lg` | 26 / 32 / 700, -0.01em | Sayfa başlığı (CV'lerim, Şablonlar, Ayarlar) |
| `text-title-1` | 22 / 28 / 700, -0.01em | Boş durum başlığı, karşılama, eksik CV ekranı |
| `text-title-2` | 17 / 22 / 600 | Dialog başlığı, ayar grubu başlığı, şablon adı |
| `text-title-3` | 15 / 20 / 600 | Inspector bölüm başlığı, kart adı, üst çubukta CV adı |
| `text-headline` | 13 / 18 / 600 | Vurgulu satır başlığı, açık kayıt başlığı |
| `text-body` | 13 / 18 / 400 | Varsayılan (gövde): satır, alan değeri, menü, düğme (500) |
| `text-body-user` | 14 / 21 / 400 | YALNIZ kullanıcının yazdığı çok satırlı metin (zengin metin, textarea, prompt) |
| `text-callout` | 12 / 16 / 400 | Açıklama, yardım, grup altı notu, kısayol, ipucu |
| `text-caption` | 11 / 14 / 500 | YALNIZ bilgi taşımayan küçük işaret (dil rozeti, `kbd`) |

- Rol sınıfı ağırlığı da verir; `font-medium`/`font-semibold` ile değiştirilebilir.
- ≤ 17px'te harf aralığı 0; 22px ve üstünde -0.01em (rol sınıfında var). `tracking-tight` yeni kodda yok.
- 10px yok; bilgi taşıyan en küçük metin 12px. Büyük harfli küçük etiket yok.
- Telefonda (dokunmatik VE < 600px) `body` 16/22, `body-user` 16/24, `callout` 13/18 (değişkenler kendiliğinden değişir).

### 2.5 Boşluk ve ölçü

Kök 16px; Tailwind adımı 4px. Ölçüler 4'ün katı, tam piksel.

| Ad | px | Kullanım |
|---|---|---|
| 0.5 | 2 | Segmented ray içi |
| 1 | 4 | Menü iç boşluğu, rozet, iki ikon düğmesi arası |
| 1.5 | 6 | İkon ile etiket arası |
| 2 | 8 | İlişkili kontroller arası, araç çubuğu grupları arası, başlık ile grup arası |
| 3 | 12 | Satır yatay iç boşluğu (inspector); kontrol çevresinde en az boşluk |
| 4 | 16 | Panel kenar boşluğu, ayar satırı yatay iç boşluğu, telefon sayfa kenarı |
| 5 | 20 | Dialog iç boşluğu |
| 6 | 24 | Inspector bölümleri arası, sayfa kenarı, ızgara yatay aralığı |
| 8 | 32 | Sayfa başlığı ile içerik, ızgara dikey aralığı, ayar grupları arası |
| 12 | 48 | Sayfa alt boşluğu, boş durumun üst/alt boşluğu |

Kontrol yükseklikleri: **24** (küçük), **28** (varsayılan, macOS), **36** (büyük), **44** (dokunma hedefi; telefonda her kontrol).

### 2.6 Yarıçap

`rounded-xs` 4 · `rounded-sm` 6 · `rounded-md` 8 · `rounded-lg` 10 · `rounded-xl` 12 · `rounded-2xl` 16 · `rounded-3xl` 20 · `rounded-full`. Kullanım ön bilgide. Tailwind'in varsayılan ölçeği bu değerlerle değiştirildi. A4 kâğıdı keskin köşe.

### 2.7 Gölge

| Sınıf | Kullanım |
|---|---|
| `shadow-1` | Grup, segmented başparmağı (koyuda yok) |
| `shadow-2` | Yüzen hap, bildirim, ipucu, uyarı kapsülü, hover'da küçük resim |
| `shadow-3` | Menü, popover, sürüklenen satır |
| `shadow-4` | Dialog, alt sayfa |
| `shadow-page` | A4 kâğıdı |
| `shadow-thumb` | Galeri küçük resmi |

Renksiz, iki-üç kat, her zaman 1px halkayla. Koyu temada derinliği gölge değil yüzeyin açılması taşır. **Bir sınır için tek mekanizma:** boşluk, kap ya da ayırıcı; hem çerçeve hem gölge hem dolgu yok. Grup = beyaz + `shadow-1` (çerçevesiz); koyuda gölgesiz, çerçevesiz.

## 3. Malzeme, örtü, kaydırma kenarı

`.material` (`app.css`): `--material` (açık `rgb(245 245 247/.8)`, koyu `rgb(28 28 30/.85)`) + `saturate(180%) blur(20px)`. **YALNIZ dört yerde:** üst çubuk, inspector'ın yapışkan başlığı, alttaki prompt çubuğu, yüzen zoom hapı (`Toolbar`, `FloatingPill` bunu kendisi verir). `@supports` geri dönüşü ve `prefers-reduced-transparency` / `prefers-contrast: more` altında opak `--bg-window`. Kontrast `prefers-reduced-transparency`'ye emanet edilmez (Safari/Firefox desteklemez); opaklık bu yüzden yüksek.

Örtü: `--overlay` açık `rgb(0 0 0/.25)`, koyu `.55`; bulanıklık yok.

Kaydırma kenarı: `.scroll-edge-bottom` / `.scroll-edge-top` + `data-scrolled` (kaydırma > 0 iken `--separator`, 150ms). Kaydırma durumu `useScrollEdge(ref)` ile.

## 4. Hareket

Kitaplık yok; yaylar CSS `linear()` (Apple `Spring(duration, bounce)` analitik çözümü). Sınıflar: `ease-out`, `ease-in-out`, `ease-sheet`, `ease-spring-smooth`, `ease-spring-snappy`, `ease-spring-bouncy`; süreler `--dur-*`.

| Yer | Özellik | Süre / eğri | Nerede |
|---|---|---|---|
| Basış | `scale .97` (≤ 28px ikon `.94`, tam genişlik `.99`) | 100ms; bırakınca 160ms `ease-out` | `.press`, `.press-sm`, `.press-wide` |
| Hover rengi | `background-color` | 150ms (yalnız hover destekli işaretçi) | Tailwind `hover:` |
| Segmented başparmağı, gezinme hapı | `transform` | 300ms `spring-smooth` | `Segmented`, `NavPills` |
| Anahtar topu | `translate`, `width` | 280ms `spring-snappy` | `Switch` |
| Onay işareti, "Kaydedildi" ✓ | `scale .6 → 1` + opaklık | 300ms `spring-bouncy` | `check-in`, `.animate-save-tick` |
| Menü, popover, açılır liste | opaklık + `scale .96 → 1`, köken tetikleyici | giriş 200ms `ease-out`, çıkış 120ms | `.pop` |
| İpucu | yalnız opaklık; komşuya geçişte 0 | 150ms | `.tip` |
| Dialog | `scale .97 → 1` yay + opaklık; köken merkez | giriş 300ms, çıkış 120ms | `.dialog` |
| Alt sayfa (telefonda dialog, `Sheet`) | `translate 100% → 0` | 300ms `spring-smooth`, çıkış 160ms | `.sheet` |
| Bildirim | `translate 100% → 0` + opaklık | 300ms `spring-smooth` | `.toast-enter` |
| Açılır satır | `grid-template-rows 0fr → 1fr` | 200ms `ease-out` | `OutlineRow`, `Disclosure` |
| Sürüklenen satır | `scale 1.02` + `shadow-3`; bırakınca 280ms `spring-snappy` | 200ms | dnd-kit |
| Önizlemeden kayda gelme | `accent-soft` söner | 600ms | `.animate-flash` |
| Sayfa geçişi, tema değişimi | View Transition çapraz geçiş | 200ms `ease-out` | `::view-transition-*` |

Kurallar:
- Yalnız `transform`/`scale`/`translate` ve `opacity` canlandırılır; `transition: all` yok; mümkünse keyframe yerine `transition` (yarıda yön değiştirsin). Radix çıkışı keyframe ister (`.pop`, `.dialog`, `.overlay`).
- `ease-in` hiçbir yerde yok. Yay yalnız konum/ölçekte; renkte ve opaklıkta yok; `spring-bouncy` yalnız ≤ 24px öğede.
- Klavyeyle tetiklenen işte (Ctrl+Z, ok tuşuyla segment) animasyon yok (`Segmented` klavyede anında).
- **`prefers-reduced-motion: reduce`:** hareket sıfırlanmaz, yumuşar. `app.css` aynı adlı keyframe'leri yalnız opaklıkla yeniden tanımlar; geçişlerde `transform/scale/translate` canlandırılmaz (anında olur), renk ve opaklık geçişi kalır; `.press` ölçeği kalkar.
- **Olmayacak yer:** kaydırınca beliren öğe, paralaks, zıplayan düğme, süs için hover animasyonu, sürekli dönen öğe (yükleyici dışında).

## 5. Bileşenler

Hepsi `src/components/ui/` altında, elle yazılmış (Radix + Tailwind; shadcn yok). Yeni ekranda önce bunlar; aynı görünümü elle tekrar yazma. Ortak durum kuralları:

- **Hover** yalnız ince işaretçide; dolgu bir kademe koyulaşır. **Basılı** iki kademe + ölçek. **Odak** (`:focus-visible`): `3px solid --focus-ring`, 1px boşluk, yarıçapı izler; grup içi çıplak alanda içe dönük 2px halka. Odak halkası kaldırılmaz; `scroll-margin` ile yapışkan çubuğun altında kalmaz. **Devre dışı:** `opacity .4`, `not-allowed`, hover/basılı yok; nedeni ipucu ya da satır açıklamasıyla söylenir.
- **İkon:** lucide, 16px, çizgi 1.75 (kökteki `LucideProvider`; `TooltipProvider` içinde). 20px ve üstünde `strokeWidth={1.5}`. Yalnız ikonlu her düğmede `aria-label` + ipucu (`IconButton` zorunlu kılar). SF Symbols, emoji, ✨ yok.

### Envanter

| Bileşen | Dosya | Ana prop'lar | Ne için |
|---|---|---|---|
| `Button`, `buttonClass()` | `Button.tsx`, `buttonClass.ts` | `variant`: `primary` · `secondary` (varsayılan) · `plain` · `ghost` · `destructive` (eski: `quiet`=ghost, `danger`=destructive); `size`: `sm` 24 · `md` 28 (varsayılan) · `lg` 36 kapsül · `xl` 44 kapsül · `icon` 28 · `icon-sm` 24 · `icon-lg` 36; `loading` | Düğme. Telefonda md/lg/ikon 44. Bağlantıya `buttonClass()` |
| `IconButton` | `IconButton.tsx` | `label` (zorunlu; ad + ipucu), `icon`, `shortcut`, `tooltip`, `size` sm/md/lg, `active`, `variant` | İkon düğmesi; menü tetikleyicisi olarak `asChild` ile |
| `Toolbar`, `ToolbarSection`, `ToolbarGroup`, `FloatingPill`, `PillDivider` | `Toolbar.tsx` | `Toolbar`: `scrolled`, `size` lg 52/md 44, `edge` bottom/top, `as`; `ToolbarSection`: `grow`; `ToolbarGroup`/`FloatingPill`: `aria-label` | Malzemeli üst çubuk, inspector başlığı, prompt çubuğu kabı; 36px ikon grubu kapsülü; yüzen zoom/sayfa hapı |
| `useScrollEdge` | `useScrollEdge.ts` | `(ref?, edge)` → boolean | Kaydırma kenarı çizgisi |
| `NavPills`, `navPillClass` | `NavPills.tsx` | `aria-label`; bağlantılara `navPillClass` + `aria-current="page"` | Üst düzey gezinme hap sekmeleri (kayan seçili zemin) |
| `Segmented` | `Segmented.tsx` | `value`, `onChange`, `options[{value,label,disabled}]`, `size` sm 24/md 28/lg 32, `stretch`, `aria-label` | Aynı nesnenin yüzleri ve 2-5 seçenekli ayar. `role=radiogroup`/`radio` |
| `Switch` | `Switch.tsx` | `checked`, `onCheckedChange`, `id`, `disabled`, `aria-label`, `aria-describedby` | Tek ayar aç/kapat, 40×24. Araç çubuğunda yok |
| `Checkbox` | `Checkbox.tsx` | `checked` (bool \| `'indeterminate'`), `onCheckedChange`, `label`, `description`, `disabled` | Hiyerarşik seçenek; etiketle tek tıklama alanı |
| `RadioGroup`, `RadioItem`, `RadioRow` | `Checkbox.tsx` | `RadioGroup`: `value`, `onValueChange`, `orientation`; `RadioRow`: `value`, `title`, `description`, `icon`, `selected`, `children` (seçiliyken ek alan) | Radyo; satır görünümlü seçim (başlangıç türü) |
| `Field` | `Field.tsx` | `label`, `hint`, `error`, `children(id)` | Etiketi üstte tek başına alan (dialog, sayfa) |
| `Input`, `Textarea`, `Select` | `Field.tsx` | `Input`/`Select`: `controlSize` sm 28/md 36 | Grup dışı alan; beyaz yüzeyde `controlOnContentClass` ekle |
| `BareInput`, `BareTextarea` | `Field.tsx` | input/textarea prop'ları | Grup içi çıplak alan (FormRow ile) |
| `controlClass`, `controlFocusedClass`, `controlOnContentClass`, `bareControlClass` | `controlClass.ts` | — | Alan görünümü; odağı kendisi almayan kap için odak sınıfı |
| `SearchField` | `SearchField.tsx` | `value`, `onValueChange`, `shortcut` ("/"), `clearLabel`, `wrapperClassName` | 36px arama; temizle ✕; kısayol `kbd` |
| `SelectMenu` | `SelectMenu.tsx` | `value`, `onValueChange`, `options` ya da `groups[{label, options}]`, `size` sm/md, `bare`, `placeholder`, seçenekte `short`/`style` | macOS açılır düğme (Radix Select, seçili öğe düğmenin üstünde) |
| `Group` | `Group.tsx` | `title`, `count`, `leading`, `actions`, `footer`, `inset` md 12/lg 16, `size` section/settings | Gruplu liste kabı; ayırıcıları kendisi koyar |
| `GroupRow` | `Group.tsx` | `title`, `description`, `leading`, `trailing`, `onClick` (gezinen satır + ok), `selected`, `disabled`, `htmlFor` (satır = etiket) | Ayar/liste satırı, en az 44px |
| `FormRow` | `Group.tsx` | `label`, `children(id, describedBy)`, `stacked`, `error`, `hint`, `labelWidth` (120) | Inspector form satırı, 40px |
| `OutlineRow` | `Disclosure.tsx` | `title`, `meta`, `open`, `onOpenChange`, `leading` (tutamak), `actions`, `hidden` | Anahat satırı: kapalı tek satır, aynı grupta yerinde açılır |
| `Disclosure` | `Disclosure.tsx` | `summary`, `open`/`defaultOpen`, `onOpenChange` | Grup dışı açılır satır ("▸ Geçen 24 kontrol") |
| `DragHandle` | `DragHandle.tsx` | `label` (varsayılan "Sürükleyerek taşı"), dnd-kit `attributes`/`listeners` | ⠿ tutamak, 24px alan, her zaman görünür |
| `Menu`, `MenuTrigger`, `MenuContent`, `MenuItem`, `MenuCheckboxItem`, `MenuRadioGroup`, `MenuRadioItem`, `MenuSeparator`, `MenuLabel`, `MenuGroup` | `Menu.tsx` | `MenuContent`: `align`, `side`; `MenuItem`: `icon`, `onSelect`, `danger`, `disabled`, `hint`, `shortcut` | ⋯ ve eylem menüleri |
| `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverClose`, `PopoverAnchor` | `Popover.tsx` | `PopoverContent`: `align`, `side`, `aria-label` | Tıklanır rozet kutusu, kısa ayar |
| `Dialog` | `Dialog.tsx` | `open`, `onOpenChange`, `title`, `description`, `footer`, `size` md 480/lg 640, `closeButton` | Kısa odaklı iş; telefonda kendiliğinden alt sayfa |
| `Sheet`, `SheetClose` | `Sheet.tsx` | `open`, `onOpenChange`, `title`, `description` | Her genişlikte alt sayfa (telefonda eylem listesi) |
| `Tooltip`, `TooltipProvider` | `Tooltip.tsx` | `content`, `shortcut`, `side`; sağlayıcı: `delayDuration` 600 | Açık balon; kökte ikon çizgisi de buradan |
| `Toaster`, `toast()` | `Toaster.tsx`, `toast.ts` | `toast({message, tone, action, duration})` | Kapsül bildirim (yalnız "Geri al" ve arka plan hatası) |
| `Badge`, `Kbd` | `Badge.tsx` | `tone` neutral/warn | TR/EN, "Örnek", "Gizli"; klavye tuşu |
| `EmptyState`, `DropZone` | `EmptyState.tsx` | `icon`, `title`, `description`, `actions`; `DropZone`: `active` | Çerçevesiz boş durum; bırakma hedefi |
| `FloatingNotice`, `InlineNotice` | `Notice.tsx` | `tone` warn/danger/ok/info, `action`, `role` | Tuvalin üstünde yüzen uyarı kapsülü; satır içi ikonlu not |
| `Swatches` | `Swatches.tsx` | `value`, `onChange`, `options[{value,color,second,label}]` | 24px renk daireleri (vurgu, renk takımı) |
| `Spinner` | `Spinner.tsx` | `size` (14) | Yükleniyor halkası |

### Bileşen kuralları

**Düğme.** Görünümde bir `primary`. İkincil eylem `secondary` (Vazgeç, Yükle, Dosya seç). Satır içi ekleme `plain` ("+ Deneyim ekle"). Araç çubuğundaki yazılı eylem `ghost`. Sil `destructive`. Dialog, sayfa başlığı ve üst çubuktaki eylem `lg`; inspector ve ayar satırında `md`; telefon ve boş durumda `xl`. Yan yana düğmeler aynı yükseklikte, aralarında 8px. Yüklenirken `loading` (etiket kalır, halka gelir, kilitlenir). Enter birincil düğmeyi çalıştırır.

**İkon düğmesi.** 28×28, yarıçap 8, zeminsiz; hover `fill-3`, basılı `fill-1` + `.94`; açık/seçili (`active`, menüsü açık) `fill-2`. İki ikon düğmesi arası 4px; işlev grubu `ToolbarGroup` (36px kapsül, arasız).

**Metin alanı.** Grup içinde çıplak (`FormRow` + `BareInput`): zemin/çerçeve yok, odakta değer bölgesine içe 2px vurgu halkası, hata `aria-invalid` + kırmızı halka + altta callout. Grup dışında (`Input`): 36px, yarıçap 10, gri pencere üstünde beyaz + 1px `separator-strong` iç halka; beyaz yüzey üstünde `controlOnContentClass` (gri dolgu, kenarsız); odakta 1px vurgu + 3px yumuşak halka. Çok satırlı metin `body-user`; zengin metin alanının kendi çerçevesi olmaz (grup içinde: üstte 36px biçim çubuğu, ayırıcı, metin). Etiket her zaman görünür; yer tutucu etiket yerine geçmez; alan genişliği beklenen metnin uzunluğunu anlatır.

**Açılır düğme.** `SelectMenu` (28px, gri dolgu, sağda çift ok; grup satırında `bare`). 2-5 öğe ve yer varsa `Segmented`. Native `Select` yalnız uzun, düz listede (ay/yıl).

**Segmented.** Ray `fill-3`, başparmak beyaz (koyuda `#636366`) + `shadow-1`; seçili 600, diğerleri 400, hepsi `text-fg`; segmentler eşit; seçili vurguyla doldurulmaz. Bir kontrolde ya hep yazı ya hep ikon. Hap sekme (`NavPills`) = başka sayfa; segmented = aynı nesnenin başka yüzü; karıştırılmaz.

**Anahtar / onay / radyo.** Tek ayar → anahtar; hiyerarşik liste → onay kutusu; tekli seçim → radyo (satır görünümünde `RadioRow`). Etiket + kontrol tek tıklama alanı.

**Grup ve satır.** Grup: `bg-content`, yarıçap 12, `shadow-1`, `overflow-hidden`, iç boşluksuz (satırlar kendi boşluğunu taşır). Ayırıcı metnin x'inden sağ kenara, ilk satırın üstünde yok. Grup altı notu `callout text-fg-2`, 8px üstte, satır metniyle aynı x; gri kutu değil. Satır başlığı `body text-fg`, açıklaması `callout text-fg-2` 2px altta; sağdaki değer düz `text-fg-2` (rozet değil). Gezinen satır: hover `fill-4`, basılı `fill-3`, seçili `accent-soft`, sağda 12px ok.

| Satır | En az yükseklik | Yatay boşluk |
|---|---|---|
| Inspector form satırı (`FormRow`) | 40 | 12; etiket sütunu 120 |
| Inspector kayıt satırı (`OutlineRow`, kapalı) | 44 | 12, solda tutamak |
| Ayar satırı (`GroupRow`) | 44 (açıklamalı ~56) | 16 |
| Telefon | 44 / 60 | 16 |

**Inspector bölümü.** `Group` başlığı `title-3` (tutamak `leading`, sayı `count` düz `text-fg-2`, sağda ikon düğmeleri `actions`); bölümler arası 24, başlık ile grup arası 8, panel kenarı 16. Kayıt açılınca aynı grupta yerinde genişler (`OutlineRow`), bir bölümde bir kayıt açık. Gizli kayıt `hidden` (üçüncül + üstü çizili; opaklıkla soldurma yok). Adı değiştirme kalemi her zaman görünür ya da `⋯` → "Yeniden adlandır…". "Bölüm ekle" panelin sonunda tam genişlik `secondary lg`; kesikli kutu değil.

**Menü ve popover.** Opak `bg-elevated`, yarıçap 12, iç boşluk 4, `shadow-3`, 180-320px; öğe 32px, yarıçap 8; vurgu `fill-4` (metin değişmez); seçili öğe solda ✓; yıkıcı öğe en altta ayırıcıdan sonra `danger`; devre dışı öğe nedenini `hint` ile söyler. Popover tetikleyiciyi örtmez, aynı anda tek, içinden popover açılmaz, uyarı içermez; dışına tıklayınca kapanır ve iş kaydedilir.

**Dialog.** Kısa, odaklı iş; CV içeriği dialogda düzenlenmez. Başlık `title-2` sola yaslı, açıklama `body text-fg-2`; eylem satırı sağa yaslı, `lg` düğmeler, solda Vazgeç (`secondary`) sağda eylem (`primary`). Enter birincile, Esc Vazgeç'e; yıkıcı onayda Enter Vazgeç'te (`autoFocus`), "Sil" `destructive`. ✕ yalnız eylem satırı yoksa. Açılınca ilk alana odak, kapanınca tetikleyiciye döner. Telefonda alt sayfa: tutamak, eylemler tam genişlik 44px, birincil üstte. Tarayıcının `confirm()`'u asla.

**Silme deseni.** CV ve bölüm silme → `Dialog` (ne olacağını söyler) + silindikten sonra "Geri al" bildirimi. Kayıt silme → doğrudan sil + "Geri al" bildirimi. Geri alınamaz işlem → onay kutusu işaretlenmeden düğme açılmaz.

**Bildirim.** Yalnız "Geri al" taşıyan işlemde ve arka plan hatasında; rutin başarıda yok (kaydetme göstergesi yeter). Kapsül 40px, `bg-elevated` + `shadow-2` (ters renk değil), renk yalnız ikonda, eylem düz vurgu düğmesi. Alt ortada, 24px yukarıda, en çok 3. Eylemli 7 sn, eylemsiz 3.5 sn; üstüne gelince/odakta süre durur.

**İpucu.** Açık yüzey, `callout`, en çok 240px, ok yok; kısayol aynı satırda ikincil renkte ("Geri al  Ctrl+Z"). İlk 600ms, komşuya geçişte 0. Dokunmatikte yok.

**Rozet.** Yalnız bilgi taşımayan kısa işaret (TR/EN, "Örnek", "Gizli"): 18px, yarıçap 4, `caption`. "Örnek" `tone="warn"`. Sayaç rozet değil düz sayı; değer hap içine alınmaz. Rozet çorbası yok.

**Boş durum.** Çerçevesiz, ortalı: 40px ikon (`text-fg-3`, çizgi 1.5), 16px, `title-1`, 8px, açıklama en çok 360px, 20px, tek birincil `lg` (varsa ikinci eylem yanında). Kesikli çerçeve yalnız sürükleme sırasında (`DropZone active`). Metin ne olduğunu ve ne yapılacağını söyler.

**Sürükleme.** `DragHandle` her zaman görünür; sürüklenen satır `bg-elevated`, yarıçap 10, `shadow-3`, `scale(1.02)`; diğerleri 200ms yer açar; bırakınca 280ms `spring-snappy`. Klavye karşılığı ve `⋯` → "Yukarı/Aşağı taşı" zorunlu.

**Uyarı.** Sayfa taşması ve "bilgisayardan aç" notu `FloatingNotice` (tuvalin üst ortasında yüzen kapsül; sorunlu kayıt adı bağlantı). Durum satırı `InlineNotice` (16px durum ikonu + `text-fg`). Renkli bant yok.

**Kaydetme göstergesi.** Üst çubukta CV adının yanında `callout text-fg`; kaydedilince 12px ✓ (`.animate-save-tick`). `role="status"`. Ayrı "Kaydet" düğmesi yok.

**Prompt çubuğu.** Inspector'ın altında yapışkan `Toolbar edge="top"` (malzeme); içindeki kutu `bg-content`, yarıçap 12, `shadow-1`, metin `body-user`; solda kapsam `SelectMenu size="sm" bare`, sağda 28px daire gönder (`IconButton variant="primary"`, `ArrowUp`; boşken devre dışı). Not satırı `callout text-fg`. Parıltı, gradyan, "AI" rozeti yok; "Örnek" rozeti kalır.

## 6. Yerleşim desenleri

**Galeri sayfaları (CV'lerim, Şablonlar, İnceleme, Ayarlar).** Üst çubuk 52px `Toolbar`, içerik kabıyla aynı genişlik ve sol kenar (`max-w-[1240px]`, yatay 24; telefonda 16). Solda `Wordmark`, 24px sonra `NavPills`; sağda tema ve Ayarlar ikon düğmeleri (4px ara). Sayfa başlığı çubukta değil içeriğin başında: `title-lg`, 4px altında tek cümle `body text-fg-2`; sağında araçlar (arama 36×240, tek birincil `lg`) aynı taban çizgisinde. Başlık ile ızgara arası 32.

**Galeri ızgarası.** `repeat(auto-fill, minmax(200px, 1fr))`, yatay 24 dikey 32 (≥ lg 4 sütun, 900-1100px 3, telefonda 2). Kart kapsızdır: A4 küçük resim doğrudan pencere zemininde (`bg-paper`, yarıçap 6, `shadow-thumb`; hover `shadow-2` + `translateY(-1px)`; seçili/odak 3px vurgu halkası, 3px boşluk). Altında 12px ile ad `title-3`, ayırt edici özellikler tek satır `callout text-fg-2` ("İki sütun · Koyu yan sütun"), açıklama `callout text-fg-2` (sarar). `⋯` adın sağında her zaman görünür. "Yeni CV" hücresi `fill-4` zemin, ortada 24px `+`; kesikli çerçeve yok.

**Editör (masaüstü ≥ 900px): belge + inspector.**
```
┌ üst çubuk 52 (malzeme): ‹  Genel TR ✎ [TR ⌄] ✓ Kaydedildi   (↶ ↷)  Şablonlar  İncele  (⋯)  [PDF al] ┐
├ sol ray 232 (kapalı gelir) ┬ tuval (--bg-canvas, kâğıt çevresinde ≥ 32px) ┬ inspector 440 (360-560) ┤
│ Şablonlar | Sayfalar      │        ┌──────────┐                           │ (İçerik | Görünüm)  44   │
│ 2 sütun küçük resim       │        │ A4 kâğıt │                           │ gruplu bölümler          │
│                           │        └──────────┘     ( ‹ 1/2 › | − 68% + | Sığdır ) │ prompt çubuğu 44 │
└───────────────────────────┴───────────────────────────────────────────────┴──────────────────────────┘
```
- Üst çubuk baş: geri (ikon), CV adı `title-3` (yerinde düzenlenir; uzun ad sarmaz, alan esner), dil rozeti (tıklanınca popover: CV dili + "İngilizceye çevir…"), kaydetme göstergesi. Son: geri al/yinele grubu, şablon rayı ve İncele, `⋯` (Kopyasını oluştur · JSON · Diğer dile çevir · Bu CV'yi incele · Koyu tema · — · Sil), en sağda "PDF al" (`primary lg`).
- Tuval: varsayılan "Sayfaya sığdır" (üst/alt boşluk 32 dengeli); alt ortada tek `FloatingPill` (sayfa ‹ 1/2 ›, −/%/+, Sığdır menüsü: Sayfaya sığdır · Genişliğe sığdır · %100); tek sayfada "1 sayfa", 1'i aşınca uyarı ikonu. Taşma uyarısı tuvalin üst ortasında `FloatingNotice`. Bildirimler hapın üstünde.
- Inspector: `bg-window`, solunda 1px bölme çizgisi (tutma alanı 9px; hover/odak/sürüklemede 2px vurgu; ok tuşu 24px; çift tık sıfırlar). Başlık 44px `Toolbar size="md"` + tam genişlik `Segmented` (yatay 16). İçerik tek sütun bölümler (§5 Inspector bölümü): Kişisel bilgiler açılır satır; bölüm başlığında "+ Ekle"; kayıtlar anahat satırı, varsayılan tek kayıt açık ("Tümünü aç" anahtarı eski hep-açık düzeni verir). Önizlemede bir kayda tıklayınca panel oraya kayar ve satır 600ms `accent-soft` ile işaretlenir.
- Görünüm sekmesi (Pages'in Biçim paneli): gruplar sırasıyla Şablon (40×56 küçük resim + ad + "Değiştir…" rayı açar), Renk (`Swatches` + "Özel…"), Yazı tipi (`SelectMenu`, her seçenek kendi yazı tipinde), Yazı boyutu / Boşluk / Ad hizası / Sütun (`Segmented`), Fotoğraf (küçük resim + Yükle + anahtar), Bölümler (sürükle + Yan/Ana `Segmented sm`). Her ayar bir satır: etiket solda, kontrol sağda.
- Prompt çubuğu boşta 44px tek satır; odakta en çok 5 satıra büyür, not ve "Enter gönderir" görünür; açık kayıtta "Yalnız bu kayıt" çipi.

**Ayarlar (macOS Sistem Ayarları).** Tek sütun `max-w-[720px]`; sayfa başlığı `title-lg`; her grup başlığı `title-2`, 8px, `Group inset="lg"`, altında not; gruplar arası 32. Sıra: Görünüm (Arayüz dili `Segmented` · Koyu tema `Switch` · Vurgu rengi `Swatches`) · Veri ve yedek · Tarayıcı · Klavye kısayolları · Tehlikeli bölge · Hakkında. Satırdaki kontroller `md` (28px). Brave notu grup altı notudur; durum satırı `InlineNotice tone="ok"`. Göreve özgü seçenek (CV rengi, yazı tipi) Ayarlar'da değil işin yapıldığı yerde. Bu yerleşim yeni; Asil'e ASCII önizlemeyle sunulur.

**Telefon (< 900px).** Üst çubuk 52 + `env(safe-area-inset-top)`: geri (44px), CV adı. Birincil eylem alt çubukta (`Toolbar edge="top"`, tam genişlik "PDF al" `xl`, altta `max(16px, safe-area)`). "Bilgisayardan aç" `FloatingNotice`. CV'lerim 2 sütun ya da 68×96 küçük resimli liste satırı. Dokunma hedefleri ≥ 44 (bileşenler `phone:` varyantıyla kendiliğinden), `body` 16px, hover yok, ipucu yok. Dialoglar alt sayfa. `100dvh`. Yerleşim cihaza değil kullanılabilir genişliğe göre değişir; özellik kümesi küçülmez.

**Genel.** Ortalama yalnız boş durumda, 404/eksik CV ekranında ve bildirimde; sayfa içeriği sola yaslı. Aynı şeyi tekrarlayan ikinci başlık, tek düğme için ayrı satır, anlamsız boşluk yok.

## 7. Erişilebilirlik

- Kontrast: okunan metin ≥ 4.5:1 (her token çifti hesaplandı, §2.2); durumu kenarla gösteren kontrol (onay kutusu, radyo) ≥ 3:1; odak halkası ≥ 3:1.
- Renk tek işaret değil: hata = kırmızı halka + ikonlu/metinli açıklama; durum = ikon + metin.
- Klavye: Ctrl+Z / Ctrl+Shift+Z / Ctrl+P / Ctrl+S / `/` / Ctrl+B / Ctrl+I; Ayarlar'da listelenir ve ilgili düğmenin ipucunda yazar. `Segmented`, `Swatches` ve bölme çizgisi ok tuşlarıyla; sıralama dnd-kit `KeyboardSensor` ile.
- Roller: `role="status"` kaydetme/yükleme göstergesi ve bildirimde; `role="alert"` sayfa uyarısında; radyo gibi grup `radiogroup` + `aria-checked`; açılır satır `aria-expanded` + `aria-controls`.
- Dokunma alanı masaüstünde en az 24px, telefonda 44px.
- `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more` §3-4'teki gibi.

## 8. Yasak listesi

**AI slop:** mor-mavi gradyan, parlama, arka planda bulanık/renkli leke, gradyan zemin, renkli gölge; ✨/✦ parıltı, "AI-powered"/"AI" rozeti, Apple Intelligence gökkuşağı kenarı, emoji ikon; anlamsız bento; kaydırınca beliren öğe, paralaks, zıplayan düğme; boş pazarlama başlığı, uydurma sayı/yorum/puan ("ATS puanı %87"); her şeyi ortalamak; varsayılan Tailwind/shadcn görünümü.

**Yüzey:** malzeme dört yer dışında (§3); cam üstüne cam; Liquid Glass kırılma/mercek taklidi (SVG filtre); malzeme üstünde gri metin; kutu içinde kutu (beyaz grubun içinde gri/çerçeveli alan, grupta kesikli kutu, her anahtara ayrı kart); hem çerçeve hem gölge hem dolgu; bir sayfada iki kart dili.

**Yazı ve renk:** SF Pro'yu web yazı tipi olarak gömmek; `system-ui`'yi yığının başına koymak; HIG izleme tablosunu `letter-spacing` yazmak; Light/Thin ağırlık; hiyerarşiyi beş gri tonla kurmak; 10-11px bilgi metni; `#8E8E93`'ü gövde metni yapmak; Apple mavisini beyaz yazılı düğmede kullanmak (3.5:1); koyu temayı açığın tersi yapmak, saf siyah pencere; küçük BÜYÜK HARFLİ geniş aralıklı gri etiket; rozet çorbası.

**Davranış:** seçili segmenti/sekmeyi vurguyla doldurmak; birden çok dolgulu düğme; yıkıcı eylemi dolgulu kırmızı yapmak ya da Enter'a bağlamak; kontrolü yalnız hover'da göstermek; metni "…" ile kesmek; `ease-in`, `transition: all`, `scale(0)`'dan giriş, merkezden büyüyen popover; menüde yay; klavye eylemini canlandırmak; animasyon bitene kadar girdiyi kilitlemek; `prefers-reduced-motion`'da her şeyi kapatmak; geri için yazı ya da kalın kutulu geri düğmesi; pazarlama ölçülerini (56-96px başlık, 17px gövde) uygulamaya taşımak; iOS ölçülerini masaüstüne aynen koymak.

## 9. Yeni ekran kontrol listesi

1. Envanter: ekrandaki her bilgi ve kontrolün yeni yeri eşlendi; kalkan bir şey varsa Asil'e soruldu.
2. Yeni yerleşimse 2-3 yapısal ASCII önizleme sunuldu, Asil seçti.
3. Yalnız token ve `src/components/ui` bileşenleri; hex yok, rol dışı yazı boyu yok, `truncate` yok.
4. Zemin katmanı doğru: pencere gri, içerik beyaz grup, tuval yalnız önizleme arkası, malzeme yalnız dört yerde.
5. Tek birincil eylem; Vazgeç solda, eylem sağda; yıkıcı eylem `destructive`.
6. Ortak sol kenar ölçüldü (başlık, satır metni, not aynı x); ölçüler 4'ün katı; yan yana kontroller aynı yükseklikte ve taban çizgisinde.
7. Her ikon düğmesinin `label`'ı ve ipucu var; her kontrol klavyeyle erişilir; odak halkası görünür ve çubuk altında kalmıyor.
8. Metinler `messages/tr.json` + `en.json`'da; "sen" hitabı; uzun Türkçe ve İngilizce metinde sarma doğru.
9. Ekran görüntüsü alındı ve ölçüldü: açık + koyu; 1440×900, 1280×720, 390×844 (dokunmatik); TR + EN; beş vurgu renginden en az ikisi; `prefers-reduced-motion`.
10. Uçtan uca testler geçti; yeni bileşen/durum `/_ui` vitrinine eklendi.

## 10. Kalkan adlar (geçiş)

Eski adlar `app.css`'te yeni değerlere bağlı duruyor; ekranlar yeniden kurulurken yenileriyle değiştirilir, sonra silinir.

| Eski | Yeni |
|---|---|
| `bg-bg` | `bg-window` |
| `bg-surface` | `bg-content` (menü/dialog için `bg-elevated`) |
| `bg-surface-2` | `bg-fill-3` (hover için `bg-fill-4`) |
| `bg-surface-3` | `bg-fill-1` |
| `bg-canvas` | `bg-canvas` (değer değişti, ad aynı) |
| `border-line` | `border-separator` |
| `border-line-strong` | `border-separator-strong` |
| `text-text` | `text-fg` |
| `text-muted` | `text-fg-2` |
| `text-faint` | bilgi için `text-fg-2` (eski ad buna bağlı), süs/devre dışı için `text-fg-3` |
| `accent-line` | odak/seçim için `outline-focus-ring` ya da `bg-accent-soft` |
| `shadow-sm` / `shadow-md` / `shadow-lg` | `shadow-1` / `shadow-2` / `shadow-3` (dialog `shadow-4`) |
| `ease-[var(--ease-out-soft)]`, `--ease-spring` | `ease-out`, `ease-spring-snappy` (ya da `-smooth`/`-bouncy`) |
| `text-sm` (12.25px) | `text-body` (eski ad artık 13px) |
| `text-xs` (10.5px) | `text-callout` (eski ad artık 12px) |
| `text-[17px]`, `text-[15px]`, `text-[13px]`, `text-[12.5px]`, `text-[11px]` | `text-title-2`, `text-title-3`, `text-body`, `text-callout`, `text-caption` |
| `text-2xl font-semibold tracking-tight` | `text-title-lg` |
| `Button variant="ghost"` (gri yazı) | `ghost` artık birincil renk yazı; Vazgeç için `secondary` |
| `Button variant="danger"` (dolgulu kırmızı) | `destructive` (gri dolgu + kırmızı yazı); `danger` aynı görünür |
| `Button size="md"` (31.5px) | `md` 28px; dialog/sayfa eylemi `lg` 36px |
| `Button size="icon"` (31.5px) | `icon` 28px |
| `--accent-base` | `--accent-light` / `--accent-dark` (`prefs.ts`) |
| kesikli boş durum kutusu | `EmptyState` (çerçevesiz) / `DropZone` |
| uyarı bandı (`bg-warn-soft border-b`) | `FloatingNotice` |
| `NavTabs` alt çizgisi | `NavPills` |
| ters renkli toast/tooltip | açık `bg-elevated` yüzey (bileşenler güncel) |

## 11. CV kâğıdı ve şablonlar

CV çizimi site arayüzünden ayrıdır: iframe içinde, site stilinden izole, önizleme ve PDF için **aynı** HTML ve CSS (`src/render`). Kâğıt temadan etkilenmez; koyu temada da beyazdır. Bu dosyadaki arayüz token'ları kâğıda girmez.

**Şablon = ayar + küçük CSS.**
1. `src/render/templateMeta.ts`'e bir kayıt (kimlik, sütunlar, renk takımları, yazı tipleri, etiketler, kâğıt/metin renkleri); `templates.ts` CSS'i bağlar ve `TemplateDef`'i kurar (ad/açıklama `template_<id>_name/_desc`).
2. `src/render/styles/<id>.css`: her kural `.tpl-<id>` ile başlar, yalnız `base.css` başındaki sözleşmedeki değişkenleri ve kancaları okur (renk: `--accent`, `--accent-ink`, `--on-accent`, `--accent-mark`, `--accent-soft/-light/-dark`, `--base`, `--on-base`, `--base-soft`, `--base-ink`, `--accent-on-base`; kâğıt: `--paper`, `--ink`, `--muted`, `--rule`; yazı: `--font`, `--font-display`, `--font-mono`, `--fs`; boşluk: `--block-gap`, `--section-gap`, `--pad-x`, `--pad-y`, `--lh`).
3. Yapı (`.page`, `.col-main`, `.col-side`, `.cv-header`, `.entry`) `base.css`'te sabit; şablon yalnız görünümü değiştirir. Her şablon desteklediği sütun düzenlerini, üç boşluk ölçeğini, üç yazı boyunu, fotoğraflı/fotoğrafsız hâli kaldırmalı.

**Şablonlar (10):** Zarif, Panel, Bant, Manşet, Gece, İsviçre, Çizelge, Çift Ton, Afiş, Çerçeve (tarifler `docs/sablonlar/sartname.md`). Renk takımları şablona özgü (+ "Özel renk"/"Özel zemin"); metin olarak kullanılan renk kâğıda karşı 4.5:1'in altındaysa kendiliğinden koyulaşır (`src/render/colors.ts`). Kâğıdın vurgusu kullanıcının site vurgusundan bağımsızdır.

**Ölçüler:** A4 `210mm × 297mm`, `@page { margin: 0 }`; yazı boyu `sm 9.25pt · md 9.75pt · lg 10.5pt`; boşluk ölçeği ön bilgideki `cv-*`. Yazı tipleri siteyle sunulur, latin-ext içerir, PDF'e gömülür; ağırlık başına **statik** woff2 (değişken yazı tipi Chrome PDF'inde Type3 olur). Gövde: Inter, IBM Plex Sans, Source Sans 3, Manrope, Space Grotesk, Archivo, Source Serif 4, Literata, EB Garamond; başlık ailesi: Poppins, DM Serif Display, Playfair Display, Fraunces; eş aralıklı: IBM Plex Mono.

**ATS kuralları (zorunlu):**
- DOM sırası okuma sırasıdır. CSS `order`, `*-reverse`, `position:absolute` ile metin taşıma yasak (tek istisna metinsiz `img.cv-photo`).
- Metin taşıyan öğe kendi boyama katmanını açmaz: `position` (relative dahil), `opacity < 1`, `transform`, `filter`, `z-index`, `mix-blend-mode`, `isolation`, `will-change` yasak. `e2e/ats.spec.ts` (`styleAudit`) denetler.
- `font-synthesis: none`; önemli metin `::before/::after` ile üretilmez; harf aralığı ≤ 0.05em.
- İletişim her düzende başlıkta (yan sütunda değil), her öğe bölünmez birim; ad kelime ortasından bölünmez.
- `<html lang>` CV dilinden; `hyphens: manual`.
- Zengin metin yalnız `p, ul/li, strong, em, a` (`sanitizeRichText`).
- **Sayfalama:** kayıt sığıyorsa bölünmez; bölüm başlığı sayfa dibinde yalnız kalmaz; bir sayfadan uzun kayıt raporlanır ve maddeler arasından bölünür; metin asla kesilmez.
- Önizlemeye özgü sınıflar (`.ph`, `.sg-*`, `body.interactive`, `.overflow-warning`, `.page-enter`) baskıda gizlenir.
- Yeni şablon `e2e/ats.spec.ts` ve `e2e/stress.spec.ts`'ten geçmeden eklenmez.

## 12. Çalışma biçimi

- Ekranı sunmadan önce ekran görüntüsü al; hiza, eşit yükseklik ve boşluğu **ölç** (§9.9).
- Yeni yerleşim istenince tahminle tur atma: yapısal olarak farklı 2-3 ASCII önizleme sun, birini öner, Asil seçince uygula.
- Şikâyet gelince kök nedeni tek yerde çöz (çoğu zaman token ya da `ui/` bileşeni).
- Kaynaklar: Apple HIG (Typography, Color, Materials, Motion, Layout, Dark Mode, Accessibility, Buttons, Toolbars, Lists, Menus, Popovers, Sheets, Scroll views, Settings), WWDC25-310 ve WWDC18 "Designing Fluid Interfaces"; şartnamenin hesap ve ölçüm notları Asil'in vault'unda.
