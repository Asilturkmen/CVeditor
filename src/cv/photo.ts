/**
 * Fotoğraf yalnız gömülü görsel (data URL) olabilir. Uzak bir adres her açılışta
 * dışarıya istek attırır ("veri tarayıcıdan çıkmaz" sözüne aykırı) ve sunucuda PDF
 * basılırken iç ağa istek yolu açar. Şema, çizim ve form aynı denetimi kullanır.
 */
export const SAFE_PHOTO_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/

export const isSafePhoto = (value: unknown): value is string => typeof value === 'string' && SAFE_PHOTO_RE.test(value)
