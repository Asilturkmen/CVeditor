/**
 * Galeri ve şablon küçük resimlerindeki örnek CV'nin fotoğrafı: çizilmiş bir silüet
 * (gerçek ya da yapay üretilmiş yüz yok). Yalnız galeri örneğinde kullanılır; kullanıcının
 * CV'sine asla yazılmaz (örnekle başlayan CV de fotoğrafsız başlar).
 */
export const SAMPLE_SILHOUETTE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9b8a6"/><stop offset="1" stop-color="#8f7b69"/></linearGradient></defs><rect width="100" height="120" fill="url(#g)"/><circle cx="50" cy="46" r="21" fill="#f1dfcf"/><path d="M14 120c4-27 19-40 36-40s32 13 36 40z" fill="#3b4a5a"/><path d="M29 44c0-17 9-25 21-25s21 8 21 25c-4-8-10-12-21-12s-17 4-21 12z" fill="#3a2a22"/></svg>',
  )
