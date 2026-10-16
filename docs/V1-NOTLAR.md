# V1 notları (gece oturumu, 2026-10-16)

V1 = çalışan arayüz, A-Z. Bu dosya ne yapıldığını, senin onayını bekleyen kararları ve bilinen eksikleri anlatır. V2'ye (sunucu) geçilmedi.

> **Bu dosya V1 gecesinin kaydıdır.** Sonradan yapılanlar `(sonradan yapıldı)` diye işaretli. Güncel durum: `docs/DURUM.md`.

## Nasıl denenir

```bash
npm install
npm run dev     # http://localhost:5173 (port sabit)
```

İlk açılışta Şablonlar gelir. Gerçek CV'ni girmeden denemek için: şablon seç → **Eski CV'yi içe aktar** → **Örnekle göster**. Uydurma bir örnek CV dolar.

PDF: editörde **PDF al** (Ctrl+P) → yazdır penceresinde "Hedef: PDF olarak kaydet". Kenar boşluğu ve A4 kendiliğinden gelir. Dosya adı otomatik olarak `Ad_Soyad_CV_tr` önerilir.

## Yapılanlar

- **Ekranlar:** Şablonlar (ilk ziyaret) · CV'lerim (küçük resimli, arama `/`) · yeni CV akışı (şablon → ad + dil → boş / içe aktar / kopyala) · editör · ayarlar · telefonda önizleme + PDF.
- **Editör:** solda canlı CV, sağda İçerik | Görünüm; altta sabit prompt kutusu. Ayırıcı sürüklenir (çift tıkla sıfırlanır). Önizlemede kayda tıklayınca panel o kayda kayar ve imleç ilk alana gelir. Panelde bir alana odaklanınca önizlemede kayıt vurgulanır.
- **Bölümler:** standart 10 bölüm + özel bölüm. Başlığa tıklayınca yeniden adlandırılır. Bölüm ve kayıt gizlenir, kopyalanır, silinir (Geri al'lı), sürüklenerek sıralanır.
- **Sayfalama (kendi kodumuz):** kayıt sığıyorsa asla bölünmez. Bölüm başlığı sayfa dibinde yalnız kalmaz. Bir sayfadan uzun kayıt sarı uyarı verir ve kesikli çerçeveyle işaretlenir. PDF'te onay kutusu işaretlenmeden devam edilmez. Kayıt maddeler arasından bölünür; metin kaybolmaz.
- **Şablonlar:** Klasik (tırnaklı yazı, tek sütun) ve Modern (ad bandı + renkli yan sütun). İkisi de tek ve iki sütunu destekler. İki sütunda hangi bölümün yanda duracağı seçilir.
- **Görünüm:** 8 hazır vurgu rengi + özel renk, 5 yazı tipi (hepsi latin-ext, PDF'e gömülü), boyut, boşluk, başlık hizası, sütun, fotoğraf.
- **Veri:** IndexedDB (Dexie) + Zod şeması + şema göç altyapısı. Otomatik kayıt (450 ms), Ctrl+Z / Ctrl+Shift+Z ortak geçmiş (TipTap'in kendi geçmişi kapalı). JSON yedek (tek CV ya da hepsi), geri yükleme (çakışmada "ikisini de tut / değiştir"). Kalıcı depolama izni, yedek hatırlatması.
- **Yapay zekâ ekranları (örnek veri):** prompt + kapsam (Tüm CV / bölüm / seçili kayıt). Öneri CV'de sarı zeminle işaretlenir: küçük değişiklik kelime düzeyinde, büyük değişiklik eski/yeni blok olarak. Tek tek ya da toplu kabul/ret; toplu kabul tek geri alma adımı. Öneri beklerken PDF alınmaz. İçe aktarma önizlemesi kayıt kayıt seçilir. Hiçbir istek atılmaz.
- **Testler:** 40 birim testi (Vitest), 20 uçtan uca test (Playwright, Chromium). `npm run check` hepsini çalıştırır.
- **Bağımsız kod incelemesi:** ikinci bir ajan kodu okuyup 9 sorun buldu, hepsi düzeltildi. Aralarında CV adından XSS, "Geri al" bildiriminin Ctrl+Z sonrası kaydı ikinci kez eklemesi, öneri kabulünün sonradan yazılanı ezmesi ve küçük resimlerde yanlış sayfalama vardı. Önizleme iframe'i artık betik çalıştıramaz (sandbox).

## Senin kararını bekleyenler (gece varsayılanla ilerledim)

1. **Site vurgu rengi:** varsayılan *Petrol* (#1f6f6b). Ayarlar'da 5 seçenek var (Petrol, Mürekkep, Kiremit, Orman, Grafit). Not "vurgu rengini Asil seçer" diyordu; seçince varsayılanı değiştiririm.
2. **Arayüz yazı tipi:** Instrument Sans. Inter ve Geist "her yerde aynı görünüm" riski yüzünden seçilmedi.
3. **Şablon adları:** "Klasik" ve "Modern". İlk şablon için konuştuğumuz "karışık kaynak" süreci (Claude Design + senin örneklerin) yapılmadı. Bunlar DESIGN.md gelene kadar kullanılacak sağlam iki taban.
4. **Fotoğraf yüklenince otomatik görünür olur** (bildirimle). Varsayılan yine kapalı; ama yükleyen büyük olasılıkla görmek ister.
5. **Bir sayfadan uzun kayıt:** önizlemede de bölünmüş gösteriliyor (önizleme = PDF). Uyarı + PDF onayı senin kararındaki gibi.
6. **Yedek hatırlatması:** hiç yedek yoksa ilk CV'den 1 gün sonra; yedek varsa 7 gün geçmiş ve yedekten sonra değişiklik yapılmışsa.
7. **Örnek öneri üreticisi:** gerçek yapay zekâ yerine zararsız biçim düzeltmeleri yapıyor (madde başı büyük harf, nokta tutarlılığı, birkaç zayıf kalıp). Düzeltilecek bir şey yoksa özete örnek bir metin önerir. Ekranın gerçek CV'de denenebilmesi için böyle yaptım; "Örnek" rozeti taşır.
8. **Kaydı başka CV'ye ekle** çalışıyor (çevirmeden, aynı çeviri grubuyla). "Çevirerek ekle" ve "CV'yi diğer dile çevir" V3 olarak kapalı. *(sonradan yapıldı: ikisi de örnek çevirmenle çalışıyor.)*
9. **Eski CV içe aktarma (V1):** PDF seçilebiliyor ama okunmuyor; örnek kayıtlar gösteriliyor. Ekranda bu açıkça yazıyor. *(sonradan yapıldı: PDF tarayıcıda okunuyor, kayıtlar kuralla ayrılıyor.)*

## Bilinen eksikler / sonraki adımlar

- **DESIGN.md yok.** Referans siteleri verince arayüzü ona göre geçeriz. Şimdiki tasarım nottaki "AI slop yasak listesi" ve animasyon ilkesine göre yapıldı. *(sonradan yapıldı: DESIGN.md taslağı var.)*
- **PDF tek tuşla değil** (yazdır penceresi). Tek tuş V2'de (Playwright Chromium, aynı `src/render` paketi).
- **ATS okuma sırası testi** henüz PDF metni üzerinden yapılmıyor (V2). Şimdilik DOM sırası birim testiyle doğrulanıyor. *(sonradan yapıldı: `e2e/ats.spec.ts`.)*
- **JSON Resume içe/dışa eşleyici** yazılmadı (V1 listesinde yoktu). *(sonradan yapıldı.)*
- **Klavyeyle sürükleme** kod olarak açık, ama kaydırılabilir panelde ilk ok tuşu önce paneli kaydırıyor. Fareyle sorunsuz. *(sonradan yapıldı.)*
- `npm run build` ana parçası ~300 kB gzip; editör ayrı parça (~170 kB gzip).
- Uzaktaki GitHub reposuna **push yapılmadı**; commit'ler yerelde. Public repo olduğu için önce senin bakman daha doğru. İçinde gerçek kişisel veri yok; örnek kişi uydurma (Deniz Aksoy, example.com).
