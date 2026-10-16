import type { Personal, SectionType } from './schema'

/**
 * Kayıtlardaki metin alanlarının arayüzden bağımsız tanımı. Yapay zekâ
 * katmanı (hangi alanı değiştirebilir), çeviri (hangi alan çevrilir) ve
 * CV İnceleme bu tabloyu kullanır; editördeki etiketler features katmanında.
 *
 * Çeviri kuralı (karar, 2026-10-14): kişi, şirket, ürün, teknoloji adları,
 * bağlantılar ve e-posta çevrilmez; unvan, açıklamalar, bölüm başlıkları
 * çevrilir; okul gibi resmi adı olan kurum resmi adıyla yazılır (bunu
 * yapay zekâ bilir, o yüzden okul adı "çevrilebilir" işaretli).
 */
export interface TextField {
  key: string
  rich: boolean
  translate: boolean
  /**
   * Üçüncü kişinin iletişim bilgisi (referansın e-postası/telefonu): yapay
   * zekâya yalnız istek o bilgiyle ilgiliyse gider (kişisel iletişim kuralıyla
   * aynı: e-posta → `email`, telefon → `phone`).
   */
  contact?: 'email' | 'phone'
}

const t = (key: string, translate = true): TextField => ({ key, rich: false, translate })
const c = (key: 'email' | 'phone'): TextField => ({ key, rich: false, translate: false, contact: key })
const r = (key: string): TextField => ({ key, rich: true, translate: true })

export const TEXT_FIELDS: Record<SectionType, TextField[]> = {
  summary: [r('content')],
  experience: [t('position'), t('company', false), t('location'), r('description')],
  education: [t('school'), t('degree'), t('field'), t('location'), t('grade', false), r('description')],
  projects: [t('name', false), t('role'), t('url', false), r('description')],
  skills: [t('name'), t('keywords', false)],
  languages: [t('name'), t('level')],
  certificates: [t('name', false), t('issuer', false), t('url', false)],
  awards: [t('title'), t('issuer', false), r('description')],
  volunteer: [t('role'), t('organization', false), t('location'), r('description')],
  references: [t('name', false), t('position'), t('organization', false), c('email'), c('phone')],
  custom: [t('title'), t('subtitle'), t('location'), t('url', false), r('description')],
}

/** İletişim alanları: yapay zekâya gerekmedikçe gönderilmez. */
export const CONTACT_FIELDS = ['email', 'phone', 'location', 'website', 'linkedin', 'github'] as const satisfies readonly (keyof Personal)[]

/** Kişisel bilgilerden yapay zekânın düzenleyip çevirebileceği alanlar. */
export const PERSONAL_TEXT_FIELDS: TextField[] = [t('headline')]

export function textField(type: SectionType, key: string): TextField | undefined {
  return TEXT_FIELDS[type].find((f) => f.key === key)
}
