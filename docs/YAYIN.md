# Yayına alma (VDS + Docker + Caddy)

Tek Docker imajı: derlenmiş site + Hono sunucusu + Chromium (tek tuşla PDF). Sunucu yalnız makinenin
kendisine (`127.0.0.1:8787`) açılır; dışarıya Caddy TLS ile yayınlar. Yapay zekâ bağlanmadan da her şey
çalışır (yapay zekâ ekranları örnek sağlayıcıyla); bağlamak için `docs/YAPAY-ZEKA.md`.

Gereken: Ubuntu/Debian bir VDS, en az 2 GB bellek (Chromium ~1 GB ister), alan adının DNS'ine erişim.

## 1. Docker'ı kur

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # sonra oturumu kapatıp yeniden aç
docker compose version           # v2.24 ya da üstü olmalı
```

## 2. Kodu al ve ayarları yaz

```sh
git clone https://github.com/<kullanıcı>/CVeditor.git cveditor
cd cveditor
cp .env.example .env
nano .env
```

`.env`'de her şey isteğe bağlı; boş bırakılanlar varsayılanla çalışır. Yapay zekâ bağlanana kadar
`AI_*` değişkenlerini boş bırak (uçlar kapalı kalır, arayüz örnek sağlayıcıyla çalışır).
`.env` git dışındadır ve imaja girmez (`.dockerignore`); yalnız çalışma anında kapsayıcıya verilir.

## 3. Derle ve başlat

```sh
docker compose up -d --build
docker compose ps                         # STATUS: healthy olmalı (≈20 sn)
curl -s http://127.0.0.1:8787/api/health  # {"ok":true,"pdf":true,...}
```

İlk derleme birkaç dakika sürer (bağımlılıklar, Chromium ve sistem kütüphaneleri).
`docker-compose.yml`: bellek sınırı 1.5 GB, çökerse yeniden başlar, root olmayan kullanıcı, `init`.

## 4. DNS ve TLS (Caddy)

1. DNS: alan adı için (örnekte `cv.asilturkmen.com`) bu sunucunun IPv4'ünü gösteren bir **A** kaydı
   (IPv6 varsa **AAAA**). Yayılmasını bekle: `dig +short cv.asilturkmen.com`.
2. Caddy'yi kur (sunucuda zaten varsa bu adımı atla):
   ```sh
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install -y caddy
   ```
3. `deploy/Caddyfile`'daki bloğu `/etc/caddy/Caddyfile`'a ekle (başka siteler varsa onların yanına).
   Alan adı `CV_DOMAIN` ortam değişkeninden gelir; yoksa bloktaki varsayılan kullanılır.
4. `sudo systemctl reload caddy`. Caddy sertifikayı kendisi alır ve yeniler; 80 ve 443 portları açık olmalı
   (`sudo ufw allow 80,443/tcp`). **8787'yi dışarıya açma**: kapsayıcı yalnız 127.0.0.1'e bağlı.
5. Dene: `https://cv.asilturkmen.com` açılır, bir CV'de "PDF al" doğrudan PDF indirir.

Caddy Docker'da çalışıyorsa `127.0.0.1:8787` ona görünmez: iki kapsayıcıyı aynı ağa koy ve
`reverse_proxy cveditor:8787` yaz.

## 5. Güncelleme

```sh
cd cveditor
git pull
docker compose up -d --build
docker image prune -f
```

Kesinti birkaç saniyedir (kapsayıcı yeniden başlar). Kullanıcıların CV'leri etkilenmez: tarayıcıda durur.

## Yedek uyarısı: CV verisi tarayıcıda

Sunucu CV saklamaz; PDF için gönderilen CV yalnız o istekte işlenir, diske ya da günlüğe yazılmaz.
CV'ler her kullanıcının kendi tarayıcısında (IndexedDB) durur ve adrese bağlıdır:

- `localhost:5173`'teki CV'ler yayındaki adrese **kendiliğinden geçmez**. Taşımak için yerelde
  **Ayarlar → Yedekle**, yayındaki adreste **Ayarlar → Geri yükle**.
- Tarayıcı verisini silmek CV'leri de siler. Düzenli olarak **Ayarlar → Yedekle** ile JSON yedek al.
- Safari 7 gün kullanılmayan sitelerin verisini silebilir (uygulama bunu uyarır).

## Ortam değişkenleri

Adlar, açıklamalar ve varsayılanlar `.env.example`'da. En çok gerekenler:

| Değişken | Ne işe yarar |
| --- | --- |
| `TRUST_PROXY` | Caddy arkasında 1 (compose verir); IP başına sınır için gerçek istemci adresi |
| `PUBLIC_ORIGIN` | İsteğe bağlı; `https://alan.adi` verilirse Origin denetimi buna göre yapılır |
| `PDF_CONCURRENCY`, `PDF_QUEUE_LIMIT` | Aynı anda basılan PDF ve sıradaki istek sayısı (bellek buna göre) |
| `PDF_RATE_LIMIT_PER_MINUTE` | IP başına dakikada PDF isteği |
| `VITE_AI_PROVIDER` | `http` → gerçek yapay zekâ (yeniden derleme ister); bkz. `docs/YAPAY-ZEKA.md` |

## Sorun giderme

| Belirti | Bak |
| --- | --- |
| `docker compose ps` "unhealthy" | `docker compose logs --tail=100 cveditor`. "Yazı tipi klasörü yok" → imaj eksik derlenmiş, `--build` ile yeniden derle. |
| "PDF al" yazdır penceresini açıyor | Sunucuya ulaşılamıyor: `curl https://alan.adi/api/health`. Caddy `reverse_proxy` adresini ve kapsayıcının çalıştığını denetle. Arayüz sunucu PDF üretemezse de (500/503/504) yazdır penceresine düşer ve bunu bildirir. |
| PDF isteği 503 `busy` | Sıra dolu: `PDF_QUEUE_LIMIT`/`PDF_CONCURRENCY`'yi artır (bellek izin veriyorsa). |
| PDF isteği 504 | Chromium yavaş ya da takıldı: `docker stats` ile belleğe bak; `PDF_TIMEOUT_MS`'i artır. |
| PDF isteği 429 | IP başına sınır. Herkes aynı IP'den görünüyorsa `TRUST_PROXY=1` eksik. |
| PDF isteği 403 | Origin uyuşmuyor: `PUBLIC_ORIGIN` sitenin gerçek adresi olmalı (şema dahil, sonda / yok). |
| Kapsayıcı sürekli yeniden başlıyor | Bellek sınırı (`docker inspect` → `OOMKilled`). `mem_limit`'i artır ya da `PDF_CONCURRENCY=1`. |
| Sertifika alınamıyor | DNS kaydı bu sunucuyu göstermiyor ya da 80/443 kapalı: `sudo journalctl -u caddy --since "10 min ago"`. |
| Yapay zekâ "hizmet kullanılamıyor" | Beklenen: bağlanmadı (503 `not_configured`). Bkz. `docs/YAPAY-ZEKA.md`. |

## Yerelde üretim kipini denemek

```sh
npm run build        # dist/ (istemci) + dist-server/ (sunucu)
npm start            # http://localhost:8787 (.env varsa okunur)
```

Geliştirmede sunucuyla: `npm run dev:server` (sunucu 8787'de izleme kipinde + Vite 5173'te, `/api` yönlendirilir).
Yalnız `npm run dev` sunucusuz çalışır; "PDF al" yazdır penceresini açar.
