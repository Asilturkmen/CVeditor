---
version: alpha
name: CVeditör
description: >-
  Tarayıcıda çalışan, şablonlu CV editörü. Arayüz sade ve nötr, tek sakin vurgu
  rengi taşır; hareket amaçlıdır. CV her ekranda sahnenin yıldızı, arayüz geri planda.
  Taslak (2026-10-16): Asil'in notlarından ve V1 kodundan çıkarıldı; referans siteler bekleniyor.
colors:
  # Site arayüzü, açık tema (varsayılan). Kaynak: src/styles/app.css
  bg: "#f6f6f3"
  surface: "#ffffff"
  surface-2: "#f0efeb"
  surface-3: "#e8e7e2"
  canvas: "#e9e8e3"
  line: "#e2e1dc"
  line-strong: "#cfcec8"
  text: "#1b1b19"
  muted: "#66655f"
  faint: "#6e6d66"
  accent: "#1f6f6b"                 # --accent-base, Petrol (varsayılan)
  accent-hover: "color-mix(in oklab, #1f6f6b 86%, black)"
  accent-fg: "#ffffff"
  accent-soft: "color-mix(in oklab, #1f6f6b 10%, #ffffff)"
  accent-line: "color-mix(in oklab, #1f6f6b 35%, #ffffff)"
  danger: "#b42318"
  danger-soft: "#fdecea"
  warn: "#9a5b00"
  warn-soft: "#fff4dc"
  ok: "#1f7a46"
  # Koyu tema ([data-theme='dark'])
  bg-dark: "#121211"
  surface-dark: "#1a1a19"
  surface-2-dark: "#222220"
  surface-3-dark: "#2b2b29"
  canvas-dark: "#0d0d0c"
  line-dark: "#2b2b29"
  line-strong-dark: "#3b3b38"
  text-dark: "#ecebe7"
  muted-dark: "#a3a29b"
  faint-dark: "#929189"
  accent-dark: "color-mix(in oklab, #1f6f6b 62%, white)"
  accent-fg-dark: "#0f0f0e"
  danger-dark: "#f2877d"
  warn-dark: "#f0b860"
  ok-dark: "#6ccf97"
  # Site vurgu seçenekleri (src/lib/prefs.ts ACCENTS; index.html'de de aynı liste)
  accent-petrol: "#1f6f6b"
  accent-murekkep: "#2b4f81"
  accent-kiremit: "#a8502d"
  accent-orman: "#2f6a3c"
  accent-grafit: "#45443f"
  # CV kâğıdı (src/render/renderCv.ts cvVariables). Temadan bağımsız, her zaman açık.
  cv-ink: "#1c1c1e"
  cv-muted: "#5a5a60"
  cv-rule: "#d6d6db"
  cv-paper: "#ffffff"
typography:
  # html { font-size: 14px } → 1rem = 14px. Arayüz yazı tipi Instrument Sans Variable, 'ss01' açık.
  page-title:   { fontFamily: Instrument Sans Variable, fontSize: 21px, fontWeight: 600, letterSpacing: -0.025em }  # text-2xl tracking-tight
  dialog-title: { fontFamily: Instrument Sans Variable, fontSize: 17px, fontWeight: 600, letterSpacing: -0.025em }
  title-md:     { fontFamily: Instrument Sans Variable, fontSize: 15px, fontWeight: 600, letterSpacing: -0.025em }  # panel/ayar bölüm başlığı, kart adı
  body:         { fontFamily: Instrument Sans Variable, fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
  body-sm:      { fontFamily: Instrument Sans Variable, fontSize: 13px, fontWeight: 400 }
  label:        { fontFamily: Instrument Sans Variable, fontSize: 12.5px, fontWeight: 500 }  # Field etiketi, text-muted
  caption:      { fontFamily: Instrument Sans Variable, fontSize: 11px, fontWeight: 600 }    # dil rozeti, sayaç, kbd
  cv-body-sm:   { fontSize: 9.25pt }   # TemplateSettings.fontSize = sm
  cv-body-md:   { fontSize: 9.75pt }   # md (varsayılan)
  cv-body-lg:   { fontSize: 10.5pt }   # lg
rounded:
  sm: 0.25rem     # 3.5px  rozet, kbd
  md: 0.375rem    # 5.25px küçük düğme, tooltip, segment
  lg: 0.5rem      # 7px    düğme, input
  xl: 0.75rem     # 10.5px menü, kayıt kartı, ayar satırı, toast
  2xl: 1rem       # 14px   dialog, şablon kartı, boş durum
  full: 9999px    # anahtar, sayaç hapı
spacing:
  unit: 0.25rem         # Tailwind adımı = 3.5px
  xs: 0.375rem          # gap-1.5
  sm: 0.5rem            # gap-2
  md: 0.75rem           # gap-3
  lg: 1rem              # gap-4 / px-4 panel iç boşluğu
  xl: 1.5rem            # px-6 sayfa kenarı, ızgara aralığı
  2xl: 2rem             # pt-8 sayfa üstü, ayar bölümleri arası
  container: 1240px     # AppShell içerik genişliği
  content-narrow: 920px # Şablonlar ızgarası, Ayarlar
  header-height: 3.5rem # h-14
  panel-default: 500px  # editör sağ panel
  panel-min: 380px
  editor-breakpoint: 900px  # altında MobileEditor
  cv-compact: { block-gap: 2.2mm, section-gap: 4.2mm, pad-x: 14mm, pad-y: 12mm, line-height: 1.32 }
  cv-normal:  { block-gap: 3mm,   section-gap: 5.6mm, pad-x: 16mm, pad-y: 14mm, line-height: 1.4 }
  cv-relaxed: { block-gap: 4mm,   section-gap: 7mm,   pad-x: 18mm, pad-y: 16mm, line-height: 1.48 }
components:
  button-primary:   { backgroundColor: "{colors.accent}", textColor: "{colors.accent-fg}", rounded: "{rounded.lg}", height: 2.25rem, padding: "0 0.875rem" }
  button-primary-hover: { backgroundColor: "{colors.accent-hover}" }
  button-secondary: { backgroundColor: "{colors.surface}", textColor: "{colors.text}", rounded: "{rounded.lg}", height: 2.25rem }
  button-ghost:     { textColor: "{colors.muted}", rounded: "{rounded.lg}", height: 2.25rem }
  button-danger:    { backgroundColor: "{colors.danger}", textColor: "#ffffff", rounded: "{rounded.lg}", height: 2.25rem }
  button-sm:        { height: 1.75rem, rounded: "{rounded.md}", padding: "0 0.625rem" }
  input:            { backgroundColor: "{colors.surface}", textColor: "{colors.text}", rounded: "{rounded.lg}", height: 2.25rem, padding: "0 0.75rem" }
  dialog:           { backgroundColor: "{colors.surface}", rounded: "{rounded.2xl}", width: "min(92vw, 520px)" }
  menu:             { backgroundColor: "{colors.surface}", rounded: "{rounded.xl}", padding: 0.25rem }
  tooltip:          { backgroundColor: "{colors.text}", textColor: "{colors.bg}", rounded: "{rounded.md}" }
  toast:            { backgroundColor: "{colors.text}", textColor: "{colors.bg}", rounded: "{rounded.xl}" }
  item-card:        { backgroundColor: "{colors.surface}", rounded: "{rounded.xl}" }
motion:   # Uzantı: resmi DESIGN.md şemasında yok. Kaynak: app.css @theme ve keyframes
  ease-out-soft: "cubic-bezier(0.2, 0.7, 0.2, 1)"
  ease-spring: "cubic-bezier(0.34, 1.3, 0.64, 1)"
  exit: 120ms
  fast: 150ms
  base: 180ms
  slow: 220ms
  max: 300ms
---

# CVeditör tasarım rehberi

Arayüz kuran ya da değiştiren her kodlama oturumu bu dosyaya uyar. Değerler (yukarıdaki token'lar) bağlayıcıdır; metin onların nasıl kullanılacağını anlatır. Kaynaklar: Asil'in CVeditör kararları (vault `cv-editor` notu), genel tasarım ilkeleri (`tasarim-anlayisi`, yalnız genel kısmı), V1 kodu. Kod ile not çeliştiğinde **not kazanır**; fark "Kodla fark" diye işaretli.

## Overview

**Karakter: sade ama özenli, hareketli.** Herkese açılacak bir ürün; şık ve modern görünmeli, ama yapay zekâ ürünlerinin tek tip görüntüsüne ("AI slop") düşmemeli.

- **CV sahnenin yıldızı.** Her ekranda CV (önizleme, küçük resim, galeri) en büyük ve en belirgin öğedir. Arayüz nötr gri tonlarda geri çekilir.
- **Tek sakin vurgu rengi.** Vurgu yalnız birincil eylemde, seçili durumda, odakta ve küçük kimlik işaretlerinde (Wordmark'taki "editör") kullanılır.
- **Logo yok, yazı var:** `Wordmark` ("CV" + vurgu renginde "editör"). Ad kesinleşince logo gelir.
- **Masaüstü öncelikli.** Editör bilgisayar için tasarlanır. Telefonda yalnız CV'lerim listesi, önizleme ve PDF çalışır; editör yerine "bilgisayardan aç" notu (`MobileEditor`).
- **Açık tema varsayılan + tek anahtarla koyu tema.** "Sistem" seçeneği yok (`Theme = 'light' | 'dark'`). Tercih `localStorage`'da; `index.html` ilk boyamadan önce uygular.
- **İlk bakışta anlaşılır.** Her değer ne olduğunu söyler (etiket ya da cümle), her ikonun yazısı ya da balonu vardır.

**Bu projede geçmeyen kurallar.** `tasarim-anlayisi` notu tmt-ops iç panelinden çıktı. Şunlar orada geçerli, burada **geçmez**: "animasyon yok", yoğun yönetim ekranı, panelin liste/kart/filtre desenleri, "mobil öncelikli" ve renkli hap/rozet yasağının katı hâli. Örtüştüğü tek yer: CVeditör'ün kendi kararı da "sade ve nötr, tek sakin vurgu rengi" diyor; bu yüzden renk tasarruflu kalır.

## Colors

| Token (Tailwind) | Ne için | Yapma |
|---|---|---|
| `bg-bg` | Sayfa zemini | Kart zemini olarak kullanma |
| `bg-surface` | Kart, panel, dialog, input | |
| `bg-surface-2` / `-3` | Hover, nötr rozet, segment zemini | Vurgu yerine kullanma |
| `bg-canvas` | CV önizlemesinin ve küçük resimlerin arkası | Başka yerde kullanma |
| `border-line` / `border-line-strong` | Varsayılan kenar / hover ve kesikli boş durum | |
| `text-text` / `text-muted` | Ana metin / ikincil metin, açıklama | |
| `text-faint` | İkincil bilgi, yer tutucu, devre dışı, dekoratif ayırıcı (`·`) | En az 4.5:1 (açıkta bg 4.8, koyuda 5.9); en önemli metin için yine `text` / `muted` |
| `bg-accent`, `text-accent` | Birincil eylem, seçili durum, bağlantı, odak | Bir ekranda birden çok birincil düğme yapma |
| `accent-soft` / `accent-line` | Seçili seçenek zemini / odaklı kartın kenarı | |
| `danger`, `danger-soft` | Silme, hata | Dekor için kullanma |
| `warn`, `warn-soft` | Uyarı bandı, "Örnek" rozeti, sayfa sayısı > 1 | |
| `ok` | Kaydedildi işareti, onay | |

- **Renkleri yalnız token'la ver.** Bileşene hex yazma (`bg-[#...]` yok). Yeni anlam gerekiyorsa önce `app.css`'e açık + koyu token ekle.
- **Vurgu rengi değişkendir.** Kullanıcı Ayarlar'dan Petrol (varsayılan, `#1f6f6b`), Mürekkep, Kiremit, Orman, Grafit seçer; `--accent-base` değişir, `--accent-hover/-soft/-line` `color-mix` ile türer. Tasarım her beşinde de çalışmalı; vurgunun belirli bir renk olduğunu varsayma.
- **Koyu tema** ayrı palet değil, aynı token adlarının `[data-theme='dark']` değerleridir. Koyu temada vurgu %62 beyazla açılır, `accent-fg` koyulaşır.
- **Durum rengi anlam taşır, dekor değildir.** Renkli zemin (`*-soft`) yalnız uyarı bandında, hata kutusunda ve "Örnek" gibi kullanıcıyı uyaran rozette.
- **Kodla fark:** `PromptBox` öneri noktası `bg-[#e7c34a]` sabit hex; `--suggest` gibi bir token'a taşınmalı (`base.css`'teki `.sg-*` sarısıyla aynı aile).

## Typography

- **Arayüz yazı tipi: Instrument Sans Variable** (`@fontsource-variable/instrument-sans`, `font-feature-settings: 'ss01'`). Inter/Geist bilerek seçilmedi ("her yerde aynı görünüm" riski). CV yazı tipleri ayrıdır (CV kâğıdı bölümü).
- **Kök boyut 14px** (`html { font-size: 14px }`). Tailwind'in rem tabanlı bütün ölçüleri buna göre küçülür: `text-sm` = 12.25px, `text-xs` = 10.5px, `h-9` = 31.5px.

| Rol | Boyut | Sınıf (bugün) | Nerede |
|---|---|---|---|
| `page-title` | 21px / 600 | `text-2xl font-semibold tracking-tight` | CV'lerim, Şablonlar, Ayarlar başlığı |
| `dialog-title` | 17px / 600 | `text-[17px]` | Dialog başlığı, şablon adı, Wordmark |
| `title-md` | 15px / 600 | `text-[15px]` | Panel ve ayar bölüm başlığı, CV kartı adı |
| `body` | 14px | (kök) | Genel metin |
| `body-sm` | 13px | `text-[13px]` | Açıklama, uyarı bandı, küçük düğme |
| `label` | 12.5px / 500 | `text-[12.5px] text-muted` | `Field` etiketi |
| `caption` | 11px / 600 | `text-[11px]` | Dil rozeti (TR/EN), sayaç, `kbd` |

- Başlıklarda `tracking-tight`, sayılarda `tabular-nums` kullan.
- Hiyerarşiyi boyut + kalınlık + renk (`text` → `muted`) ile kur. Büyük harf yalnız küçük grup etiketlerinde (`uppercase tracking-wide text-xs`).
- **Kodla fark:** kod px'li rol boyutlarını (`text-[13px]`, `text-[12.5px]`) rem'li Tailwind boyutlarıyla (`text-sm` 12.25px, `text-xs` 10.5px) karıştırıyor; ölçek 7 değil ~10 basamak. Yeni kodda tablodaki rolleri kullan. Birleştirme (ör. `@theme`'e `--text-body-sm` gibi rol token'ları) ayrı bir iş; Asil'e sorulacak.

## Layout

- **Kabuk (`AppShell`):** yapışkan üst çubuk `h-14`, `border-b border-line`, `bg-bg`. Solda `Wordmark`, yanında sekmeler **CV'lerim · Şablonlar** (altında kayan vurgu çizgisi), sağda tema düğmesi ve Ayarlar. İçerik `max-w-[1240px] px-6 pt-8 pb-24`.
- **Sayfa başlığı deseni:** solda `page-title` (+ varsa `rounded-full bg-surface-2` sayaç) ve altında `text-muted` tek cümle; sağda araçlar (arama, `/` kısayolu `kbd` ile gösterilir) ve en sağda tek birincil eylem. Başlık ile içerik arası `mb-7`/`mb-8`.
- **Izgaralar:** CV'lerim `repeat(auto-fill, minmax(220px, 1fr))`, `gap-x-6 gap-y-8`. Şablonlar en çok 2 sütun, `max-w-[920px]`, `gap-x-10 gap-y-12`. Ayarlar `max-w-[920px]`, her bölüm `260px | 1fr` iki sütun, aralarında `border-b`.
- **Editör (masaüstü, ≥ 900px):** tam yükseklik; üst çubuk `h-14 bg-surface` (geri, CV adı, dil rozeti, kaydetme göstergesi | geri al/yinele, sayfa sayısı, tema, ⋯ menü, **PDF al**).
  - Sol: `PreviewPane`, `bg-canvas`, A4 sayfalar gölgeli; sağ altta yüzen `ZoomControl` (−, %, +, Sığdır, 100%).
  - Orta: `Splitter`, 1px `bg-line`, hover/odakta vurgu; sürükle, ok tuşu (24px), çift tık sıfırlar.
  - Sağ: panel varsayılan 500px, en az 380px, en çok pencerenin %62'si. Üstte `Segmented` **İçerik | Görünüm**, ortada kayan içerik (`px-4 pt-4 pb-10`), en altta sabit `PromptBox` (iki sekmede de).
- **Telefon (< 900px):** `MobileEditor`: geri, CV adı, PDF düğmesi; altında not bandı; salt okunur önizleme.
- **Hiza ve simetri ölçülerek.** Aynı türden öğeler aynı x'te başlar, satırlar eşit yükseklikte. Sunmadan önce ekran görüntüsü al ve ölç.
- **Yer israfı yapma:** aynı şeyi tekrarlayan ikinci başlık, tek düğme için ayrı satır, anlamsız boşluk yok.
- **Ortalama yalnız** boş durumda, 404/eksik CV ekranında ve toast'ta. Sayfa içeriği sola yaslı.

## Elevation & Depth

| Token | Kullanım |
|---|---|
| `shadow-sm` | Düğme (primary/secondary), segment göstergesi, zoom kontrolü |
| `shadow-md` | Menü, tooltip, toast, hover'da CV kartı, önizlemedeki sayfa |
| `shadow-lg` | Dialog, sürüklenen kart/bölüm, hover'da şablon kartı |

- Derinliği önce kenar (`border-line`) ve zemin farkıyla ver; gölge yalnız gerçekten üstte duran öğede.
- Overlay: `bg-black/35` (koyu: `/60`). Bulanıklık (`backdrop-blur`) kullanma.

## Shapes

- Köşe yarıçapı boyutla büyür: `md` küçük denetim → `lg` düğme/input → `xl` kart/menü/toast → `2xl` dialog, şablon kartı, boş durum. Hap ve anahtar `full`.
- İç içe kutuda içteki yarıçap dıştakinden küçük olur (ör. `Menu` `xl`, öğesi `lg`).
- Her şeyi aynı büyük yuvarlak karta koyma; liste satırı, ayar satırı ve bölüm başlığı kartsız da durabilir.

## Components

Bileşenler `src/components/ui/` altında, elle yazılmış (Radix + Tailwind; shadcn yok). Yeni ekranda önce bunları kullan; aynı görünümü elle tekrar yazma.

- **`Button`**: `variant` = `primary | secondary (varsayılan) | ghost | quiet | danger`; `size` = `sm (h-7) | md (h-9) | icon (size-9) | icon-sm (size-7)`. İkon 16px. Basınca `translate-y-px`. Ekranda tek `primary`. Yalnız ikonlu düğmede `aria-label` + `Tooltip` zorunlu.
- **`Field`** + `Input` / `Textarea` / `Select`: etiket her zaman görünür, yer tutucu etiketin yerine geçmez. Odak: `border-accent` + `ring-3 ring-accent/15`. Alanlar iki sütunlu ızgarada (`grid-cols-2 gap-x-3 gap-y-3.5`), uzun alan `col-span-2`.
- **`Dialog`**: yalnız kısa, odaklı işler: ad değiştirme, silme onayı, yeni CV adımları, içe aktarma, PDF onayı. CV içeriği dialogda düzenlenmez (panelde). Alt çubuk sağa yaslı: `ghost` Vazgeç + eylem düğmesi. Geniş içerikte genişlik `min(94vw,680px)`.
- **`Menu`** (`MenuItem`, `MenuSeparator`, `MenuLabel`): ikincil eylemler ⋯ arkasında. Tehlikeli öğe en altta, ayırıcıdan sonra, `danger`. Devre dışı öğe nedenini `hint` ile söyler (ör. "V3").
- **`Segmented`**: 2-4 seçenek; seçili göstergesi kayar (200ms). Ok tuşlarıyla gezilir. Sekme ve ikili seçim (TR/EN, boyut, boşluk) için.
- **`Switch`**: açık/kapalı ayarı (koyu tema, fotoğraf). Açıkken `bg-accent`, başparmak yaylı.
- **`Tooltip`**: varsayılan alt, `bg-text text-bg`, `max-w-64`. Kısayolu da yazar: "Geri al · Ctrl+Z".
- **`Toaster` / `toast()`**: alt ortada, ters renk, en çok 3. Geri dönüşü zor işlemden sonra **Geri al** eylemi taşır (7 sn; eylemsiz 3.5 sn). Hata tonu `tone: 'error'`.
- **Silme deseni:** CV ve bölüm silme → sayfa içi `Dialog` (ne olacağını söyler) + silindikten sonra "Geri al" toast'u. Kayıt silme → doğrudan sil + "Geri al" toast'u (boş kayıt sessiz silinir). Hepsini sil gibi geri alınamaz işlem → onay kutusu işaretlenmeden düğme açılmaz. Tarayıcının `confirm()` penceresini asla kullanma.
- **Boş durum:** `rounded-2xl border border-dashed border-line-strong`, ortalı başlık + yol gösteren tek cümle + tek eylem. Boş CV önizlemesinde de ipucu metni (`preview_empty_hint`).
- **Uyarı bandı:** `bg-warn-soft border-b border-warn/25`, solda `warn` ikon, kalın başlık + `muted` açıklama; sorunlu kayıtların adları tıklanabilir bağlantı.
- **Kayıt kartı (`ItemCard`):** `rounded-xl border bg-surface`; başlık satırı: ⠿ tutamak (`GripVertical`) · kayıt adı · Gizli rozeti · göster/gizle · ⋯. Odaklı kart `border-accent-line`, sürüklenen kart `shadow-lg`, gizli kart `opacity-60`.
- **Bölüm:** başlık satırı tutamak + ad (tıklayınca yeniden adlandırılır) + kayıt sayısı; kayıtlar `pl-6` içeride; altta vurgu renkli "+ Ekle" `ghost` düğmesi. En altta kesikli "Bölüm ekle".
- **Seçenek kartı (`NewCvDialog` başlangıç seçimi):** radio gibi davranan kart; seçilince `border-accent bg-accent-soft`, ikonu vurguya döner, ek alanlar altında açılır.
- **`PromptBox`:** panelin altında sabit. `rounded-xl border bg-bg` kutu, 2 satır metin, solda "Kapsam: Tüm CV ⌄" menüsü (varsayılan Tüm CV; bölüm ya da odaklı kayda daraltılır), sağda Enter ipucu ve gönder (`icon-sm primary`, ↑). Çalışırken dönen yükleyici + Durdur. Altında tek satır not + gizlilik balonu. Öneri gelince kutunun yerini **öneri listesi** alır: Tümünü reddet (`ghost`) / Tümünü kabul et (`primary`), satır başına ✕ / ✓. Öneriler CV üstünde işaretli görünür; yapay zekâ hiçbir şeyi doğrudan değiştirmez.
- **Kaydetme göstergesi (`SaveIndicator`):** üst çubukta küçük, `faint`; kaydedilince yaylı ✓. Ayrı "Kaydet" düğmesi yok (otomatik kayıt; Ctrl+S yalnız hemen yazar).
- **Kodla fark:** "+ Yeni CV" ve boş durum düğmesi `Link` üstüne `primary` sınıflarını elle tekrar yazıyor; `Button` sınıflarını paylaşan bir yardımcı (`buttonClass`) çıkarılmalı.

## Motion

Etkileyici = amaçlı, gösterişli değil. Her hareket bir şeyi anlatır: nereden geldi, nereye gitti, ne değişti.

- **Süre:** çoğu 150-300ms. Kapanış açılıştan kısa (120ms, `ease-in`). Kullanıcıyı asla bekletme; hareket yarıda kesilebilir olmalı (CSS geçişi, `transform`/`opacity`).
- **Eğri:** `--ease-out-soft` her şey için. `--ease-spring` yalnız küçük öğede (anahtar başparmağı, kaydedildi ✓, seçili rozeti); büyük yüzeyde yay yok.
- **`prefers-reduced-motion`:** `app.css` ve `base.css` süreleri sıfırlar. Yeni animasyon bu kurala takılmadan çalışmalı (bilgi animasyona bağlı olmamalı).

| Yer | Hareket | Kod |
|---|---|---|
| CV listesi → editör | Çapraz geçiş 180ms | `defaultViewTransition` + `::view-transition-*` |
| İçerik ↔ Görünüm | Gösterge kayar, içerik 6px yükselerek gelir | `Segmented`, `animate-[rise-in_200ms]` |
| Sürükle-bırak sıralama | Öğeler yer açar | dnd-kit `transition` |
| Önizlemede kayda tıklama | Panel kayar, kart kısa süre vurgulanır | `scrollIntoView` + `.animate-flash` |
| Yapay zekâ önerisi | CV'de sarı zeminle belirir (320ms) | `.sg-block`, `sg-in` |
| Yeni sayfa eklenmesi | Sayfa 10px yükselerek gelir (260ms) | `.page-enter` |
| Kaydedildi | ✓ yaylı büyür | `save-tick` |
| Menü, dialog, tooltip | `pop-in` / `pop-out`, overlay `fade-in` | `.pop`, `.overlay` |
| Sekme çubuğu (üst menü) | Vurgu çizgisi kayar 250ms | `NavTabs` |

- **Olmayacak yer:** sayfa kaydırma süsleri, kaydırınca beliren öğeler, paralaks, zıplayan düğmeler, sürekli dönen/yanıp sönen öğe (yükleyici dışında), yalnız süs için hover animasyonu.
- **Kodla fark:** not "şablon değiştirince CV yeni düzene akar" diyor; kod yalnız 150ms opaklık geçişi yapıyor (`PreviewPane` `fading`). Gerçek akış (blokların yeni yerine kayması) yapılacaksa iframe içinde, PDF'e etkisiz ve 300ms altında olmalı. `.animate-flash` 1100ms sürüyor; bekletmeyen bir sönüm olduğu için istisna sayılır.

## Iconography

- Tek ikon kümesi: **lucide-react**. Düğmede 16px (`size-4`), küçük satırda 14px (`size-3.5`). Çizgi kalınlığı varsayılan; dolu ikon yalnız seçili işaretinde (✓).
- Yalnız ikonlu her düğmede `aria-label` + `Tooltip`. Anlamı açık olmayan ikonun yanına yazı koy.
- Ayırıcı olarak `·`, sürükleme için `GripVertical` (⠿), ikincil eylemler için `MoreHorizontal` (⋯).
- **Yapma:** emoji ikon; yapay zekâ için ✨/✦ parıltı; "AI" rozeti. Yapay zekâ eylemi sıradan bir ikonla (↑ gönder) anlatılır.

## İçerik ve dil

- Arayüz Türkçe, kullanıcıya **"sen"** diye hitap eder ("Bir şablon seç, bilgilerini gir; PDF'in hazır.").
- Bütün arayüz metinleri `messages/tr.json`'da, kodda `m.anahtar()`. Bileşene sabit Türkçe metin yazma. CV dilindeki metinler (bölüm başlıkları, ay adları) ayrı: `src/cv/locale.ts`.
- **Aynı kavram her yerde aynı adla:** CV'lerim, Şablonlar, İçerik, Görünüm, Kapsam, Geri al, PDF al, Gizli. Yeni ad uydurmadan önce `tr.json`'da ara.
- Boş durum ve hata metni ne olduğunu **ve ne yapılacağını** söyler. Uyarı sakin dille ve hangi kayıt olduğunu adıyla söyler.
- Örnek veri her zaman uydurma kişidir (`src/cv/sample.ts`) ve örnek olduğu yazılır ("Örnek" rozeti, galeri altındaki not).
- **Yapma:** "Supercharge your career" tarzı boş başlık, uydurma kullanıcı yorumu, uydurma sayı ya da "ATS puanı %87" gibi skor.

## Erişilebilirlik

- Odak: `:focus-visible` 2px vurgu çizgisi, 2px boşluk. Odak halkasını kaldırma.
- Klavye: kısayollar Ctrl+Z / Ctrl+Shift+Z / Ctrl+P / Ctrl+S / `/` / Ctrl+B, Ctrl+I; Ayarlar'da listelenir. `Segmented` ve `Splitter` ok tuşlarıyla, sıralama dnd-kit `KeyboardSensor` ile.
- Kontrast: okunması gereken metin en az 4.5:1. `muted` açıkta 5.85:1, koyuda 6.8:1; `faint` açıkta 4.5-5.2:1, koyuda 5.0-5.9:1 (2026-10-16'da yükseltildi).
- Dokunma alanı en az 28px (`icon-sm`); telefonda birincil eylemler `h-9`.
- `role="status"` kaydetme ve yükleme göstergelerinde, `role="alert"` sayfa uyarısında. Radio gibi davranan grupta `role="radiogroup"` + `aria-checked`.
- **Kodla fark:** `Field` ipucu `text-xs` (10.5px) boyutunda; okunurluk için en az 12px'e çıkarılmalı.

## Do's and Don'ts

**Yap**
- CV'yi en büyük öğe yap; arayüzü nötr tut, vurguyu tek yerde harca.
- Token kullan; açık ve koyu temada, beş vurgu renginde ve 390px'te kontrol et.
- Uzun metni yapıyla çöz (sarma, iki satır, geniş sütun). Metin `…` ile kesilmez.
- Yeniden tasarımdan önce ekranın envanterini çıkar; her bilgi ve kontrolün yeni yerini eşle. Bir şey kalkacaksa önce Asil'e sor.
- Boş durumda yol göster; anında tepki ver (otomatik kayıt, canlı önizleme).

**Yapma (AI slop yasak listesi)**
- Mor-mavi gradyan, parlama, arka planda bulanık renk lekeleri.
- Her yerde cam efekti (glassmorphism, `backdrop-blur`).
- ✨/✦ parıltı ikonu, "AI-powered" rozeti, emoji ikon.
- Her şeyi aynı 16px yuvarlak karta koymak; anlamsız bento ızgarası.
- Kaydırınca aşağıdan beliren öğeler, paralaks, zıplayan düğmeler.
- Boş pazarlama başlıkları, uydurma kullanıcı yorumu ve sayılar.
- Her şeyi ortalamak.
- Varsayılan Tailwind/shadcn görünümünü olduğu gibi bırakmak.
- Bir kontrolü yalnız hover'da görünür yapmak (saklamak = silmek).

**Kodla fark (metin kesme ve gizli kontrol):** şu yerler `truncate` kullanıyor: CV kartı adı (`CvListPage`), editör CV adı alanı, kayıt kartı adı ve bölüm başlığı (`SectionList`), öneri hedefi ve kapsam etiketi (`PromptBox`), içe aktarma satırı (`ImportPreview`), telefon başlığı. Bölüm adını değiştirme kalemi (`PenLine`) yalnız hover'da görünüyor. Hepsi bu kurala göre gözden geçirilmeli.

## CV kâğıdı ve şablonlar

CV çizimi site arayüzünden ayrıdır: iframe içinde, site stilinden izole, önizleme ve PDF için **aynı** HTML ve CSS (`src/render`). Kâğıt temadan etkilenmez; koyu temada da beyazdır.

**Şablon = ayar + küçük CSS.** Yeni şablon ayrı bir kod yığını değildir:
1. `src/render/templates.ts`'e bir `TemplateDef` (ad, CSS, varsayılan `TemplateSettings`).
2. `src/render/styles/<id>.css`: her kural `.tpl-<id>` ile başlar, yalnız CV değişkenlerini okur (`--accent`, `--accent-ink`, `--ink`, `--muted`, `--rule`, `--paper`, `--font`, `--fs`, `--block-gap`, `--section-gap`, `--pad-x`, `--pad-y`, `--lh`).
3. Yapı (`.page`, `.col-main`, `.col-side`, `.cv-header`, `.entry`) `base.css`'te sabittir; şablon yalnız görünümü değiştirir. Her şablon tek ve iki sütunu, üç boşluk ölçeğini, üç yazı boyunu, fotoğraf açık/kapalıyı ve sola/ortaya hizalı başlığı kaldırmalı.

**Mevcut şablonlar:** **Klasik** (tırnaklı, varsayılan Source Serif 4, tek sütun, vurgu renkli büyük harf bölüm başlığı + ince alt çizgi) ve **Modern** (Inter, iki sütun, ad bandının altında kalın vurgu çizgisi, yan sütun %7 vurgu tonu, başlık önünde kısa vurgu çubuğu).

**Ölçüler:**
- Sayfa A4, `210mm × 297mm`, `@page { margin: 0 }`; kenar boşluğu `--pad-x/--pad-y` ile içeriden.
- Yazı boyu `sm 9.25pt · md 9.75pt · lg 10.5pt`; ad 2.3-2.5em, unvan 1.15em, iletişim 0.95em, tarih 0.93em `tabular-nums`.
- Boşluk ölçeği yukarıdaki `cv-compact / cv-normal / cv-relaxed` tablosu.
- Renk: metin `#1c1c1e`, ikincil `#5a5a60`, çizgi `#d6d6db`; vurgu CV ayarından (8 hazır renk + özel), kullanıcının site vurgusundan bağımsız.
- Yazı tipleri (Inter, IBM Plex Sans, Source Sans 3, Source Serif 4, Literata) siteyle sunulur, latin-ext içerir (ş, ğ, ı, İ), PDF'e gömülür. Ağırlık başına **statik** woff2 (`@fontsource/*`; 400, 500, 600, 700, italik 400/700): değişken yazı tipi Chrome PDF'inde Type3 olur. Şablon CSS'inde yalnız bu ağırlıklar kullanılır (650/750 gibi ara değer yok).

**ATS kuralları (zorunlu):**
- DOM sırası okuma sırasıdır. CSS `order`, `position: absolute`, `flex-direction: *-reverse`, grid ile yer değiştirme yasak. İki sütunda yan sütun kısa ve DOM'da mantıklı sırada.
- Önemli metni `::before/::after` ile üretme (Modern'deki boş dekor çubuğu gibi süs serbest).
- Metin seçilebilir; görsel içinde metin, tablo ya da metin kutusu ile düzen kurma.
- Büyük harf başlıkta `letter-spacing` en çok 0.05em: ~0.1em'den genişi PDF ayrıştırıcılarında harf harf çıkar ("D E N E Y İ M").
- İletişim her düzende tam genişlik başlıkta (ad ve unvanın altında); yan sütunda değil. Her iletişim öğesi bölünmez birim (`white-space: nowrap`), satır yalnız öğeler arasında kırılır; adres ortadan bölünmez.
- `<html lang>` CV dilinden gelir (Türkçe büyük İ); `hyphens: manual`, kelime bölme yok.
- Zengin metin yalnız `p, ul/li, strong, em, a`; renk ve boyut şablondan gelir, metin içinde değişmez.
- Bölüm başlıkları CV diline göre `locale.ts`'ten gelir; şablon değiştirmek içerik kaybettirmez.
- **Sayfalama:** kayıt sığıyorsa bölünmez; bölüm başlığı sayfa dibinde yalnız kalmaz; bir sayfadan uzun kayıt göze çarpan uyarı + PDF'te zorunlu onay ile maddeler arasından bölünür; metin asla kesilmez. 1 sayfayı aşınca sakin uyarı.
- Önizlemeye özgü sınıflar (`.ph`, `.sg-*`, `body.interactive`, `.overflow-warning`, `.page-enter`) `@media print`'te gizlenir; PDF'e girmez.
- V2'de her yeni şablon otomatik testten geçmeden eklenmez (PDF metni, okuma sırası, önizleme = PDF).

## Çalışma biçimi

- Ekranı sunmadan önce ekran görüntüsü al; hiza, eşit yükseklik ve boşluğu **ölç**. Açık + koyu, masaüstü + 390px.
- Yeni yerleşim istenince tahminle tur atma: yapısal olarak farklı **2-3 ASCII önizleme** sun, birini öner, Asil seçince uygula. Bunun dışında varyant gösterme; en iyi tek çözümü uygula.
- Şikâyet gelince kaynağı sor ya da örnek görsel iste. Düzeltmeyi kök nedeni tek yerde çözerek yap (çoğu zaman token ya da `ui/` bileşeni).
- Bu dosya ile Asil'in sonraki geri bildirimi çelişirse geri bildirim kazanır; bu dosyayı da güncelle.

## Açık sorular / referans siteler bekleniyor

- **Referans siteler:** Asil verecek. Geldiğinde renk, tipografi ve hareket ölçüleri onlara göre gözden geçirilir; bu dosya taslaktır.
- **Kesin ad ve logo:** "CVeditör" çalışma adı; logo ad kesinleşince.
- **Yazı ölçeği:** 14px kök ve px/rem karışık boyutlar korunsun mu, rol token'larına mı geçilsin?
- **Şablon değiştirme akışı:** opaklık geçişi yeterli mi, yoksa blokların yeni yerine kaydığı gerçek akış mı istenir?
- **Öneri rengi:** sarı (`.sg-*`, `#e7c34a`) token'a alınsın; koyu temada panel tarafındaki karşılığı belirlensin.
- **İlk şablonun özgün tasarımı:** "karışık kaynak" süreci (Claude önerisi + Claude Design + Asil'in örnekleri) yapılmadı; Klasik ve Modern geçici taban.
- **Kesme ve gizli kontrol düzeltmeleri** (Do's and Don'ts altındaki liste) ne zaman yapılacak.
