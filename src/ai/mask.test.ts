import { describe, expect, it } from 'vitest'
import { createCv, createSection } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { AnyItem, Cv } from '@/cv/schema'
import { templateSettingsFor } from '@/render/templates'
import { matchJobAd } from '@/review/keywords'
import { cvPlainText } from '@/review/text'
import { buildContactMasks, createMasker, hasPlaceholder, loosePattern, maskSourceOf } from './mask'
import { operationsToSuggestions } from './ops'
import { buildEditPayload } from './payload'
import { buildKeywordMatchRequest, buildReviewRequest } from './review'
import { buildTranslateRequest, collectCvTexts, mergeTranslations } from './translate'
import { fold } from './places'

/**
 * Gizlilik sızıntısı denetimleri (bağımsız incelemenin bulduğu yollar):
 * kişisel bilgide olmayan e-posta/telefon, ad yazım biçimleri, NFD metin,
 * bağlantıdaki ad ve uydurma yer tutucunun geri konması.
 */

function sampleCv(): Cv {
  const sections = sampleSections('tr')
  return createCv({
    name: 'Test',
    language: 'tr',
    templateId: 'zarif',
    template: templateSettingsFor('zarif', sections),
    personal: samplePersonal('tr'),
    sections,
  })
}

const summaryOf = (cv: Cv) => (cv.sections.find((s) => s.type === 'summary')!.items as AnyItem[])[0] as unknown as Record<string, string>
const sentSummary = (payload: ReturnType<typeof buildEditPayload>['payload']) =>
  payload.sections.find((s) => s.type === 'summary')!.items[0].content as string
/** Türkçe/şapkalı harf ve büyük/küçük farkı olmadan arama */
const foldedHas = (text: string, needle: string) => fold(text).includes(fold(needle))

const OTHER_MAIL = 'kamil.ozturk@firma.example.com'
const OTHER_PHONE = '0216 000 00 00'
const LEAKY = `<p>İş: ${OTHER_MAIL}, eski tel ${OTHER_PHONE} ya da +90 555 012 34 56.</p>`

describe('genel e-posta ve telefon maskesi', () => {
  it('kişisel bilgide olmayan e-posta ve telefon da düzenlemede maskelenir; numaralı yer tutucu alır, geri konur', () => {
    const cv = sampleCv()
    summaryOf(cv).content = LEAKY
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'Özeti düzelt')
    const sent = sentSummary(payload)
    expect(sent).not.toContain('firma.example.com')
    expect(sent).not.toMatch(/0216|012 34 56/)
    // Çıplak ⟦EMAIL⟧/⟦PHONE⟧ kişinin kendi değerine ayrılır; genel olanlar hep numaralı.
    expect(sent).toMatch(/İş: ⟦EMAIL_\d+⟧, eski tel ⟦PHONE_\d+⟧ ya da ⟦PHONE_\d+⟧\./)
    expect(payload.placeholders.filter((p) => /EMAIL|PHONE/.test(p)).every((p) => /_\d+⟧$/.test(p))).toBe(true)
    expect(unmask(sent)).toBe(LEAKY)
    // Genel yer tutucu, gönderilmediyse uydurmadır: geri konmaz.
    expect(hasPlaceholder(unmask('⟦EMAIL_9⟧'))).toBe(true)
  })

  it('tarih aralıkları, yıllar ve sıradan sayılar telefon sayılmaz', () => {
    const masker = createMasker(buildContactMasks({}))
    const text = '2019 - 2023 2024 arası; ilk yükleme %38 kısaldı; ayda 2.000 kullanıcı; sipariş no 1234567890.'
    expect(masker.mask(text)).toBe(text)
  })

  it('çeviri, inceleme ve anahtar kelime istekleri de aynı genel maskeyi kullanır', () => {
    const cv = sampleCv()
    summaryOf(cv).content = LEAKY
    const translate = buildTranslateRequest('tr', 'en', collectCvTexts(cv), maskSourceOf(cv))
    const review = buildReviewRequest({ kind: 'cv', cv }, '', 'tr').request
    const ad = 'React ve TypeScript bilen biri'
    const keywords = buildKeywordMatchRequest({ kind: 'cv', cv }, ad, matchJobAd(ad, cvPlainText(cv), 'tr')).request
    for (const json of [JSON.stringify(translate.request), JSON.stringify(review), JSON.stringify(keywords)]) {
      expect(json).not.toContain('firma.example.com')
      expect(json).not.toMatch(/0216|012 34 56/)
    }
  })
})

describe('ad: yazım biçimleri', () => {
  it('â/î/ê/û harfsiz yazımla da eşleşir (iki yönde)', () => {
    const re = (value: string) => new RegExp(loosePattern(value, { ascii: true }), 'iu')
    expect(re('Kâmil Îlhan Ênver Ûmit').test('Kamil Ilhan Enver Umit')).toBe(true)
    expect(re('Kamil Ilhan').test('KÂMİL ÎLHAN')).toBe(true)
    const masker = createMasker(buildContactMasks({ fullName: 'Kâmil Öztürk' }))
    expect(masker.mask('Kamil Ozturk · KAMIL OZTURK · kâmil öztürk')).toBe('⟦NAME⟧ · ⟦NAME_2⟧ · ⟦NAME_3⟧')
  })

  it('ayrıştırılmış (NFD) metinde ad ve konum maskelenir; geri koyma birebir aynı metni verir', () => {
    const masker = createMasker(buildContactMasks({ fullName: 'Ayşe Yılmaz', location: 'Kadıköy, İstanbul' }))
    for (const value of ['Ayşe Yılmaz', 'AYŞE YILMAZ', 'Kadıköy', 'İstanbul ofisi']) {
      const nfd = value.normalize('NFD')
      const masked = masker.mask(nfd)
      expect(masked, value).not.toMatch(/ay[sş]|y[iı]lmaz|kad[iı]k|stanbul/i)
      expect(masker.unmask(masked)).toBe(nfd)
    }
    // Değerin kendisi NFD yazılmışsa da
    const nfdSource = createMasker(buildContactMasks({ fullName: 'Ayşe Yılmaz'.normalize('NFD') }))
    expect(nfdSource.mask('Ayşe Yılmaz')).toBe('⟦NAME⟧')
  })

  it('"Soyad, Ad", baş harfli biçim ve tek başına ad ya da soyad (büyük harfle, ≥ 3 harf) maskelenir', () => {
    const masker = createMasker(buildContactMasks({ fullName: 'Kâmil Öztürk' }))
    const text = 'Öztürk, Kâmil (2023). Öztürk, K. ve K. Öztürk yazdı. Kâmil ekibi kurdu; ÖZTÜRK imzası. Öztürk’ün projesi.'
    const masked = masker.mask(text)
    expect(foldedHas(masked, 'ozturk')).toBe(false)
    expect(foldedHas(masked, 'kamil')).toBe(false)
    expect(masked).toContain('’ün projesi')
    expect(masker.unmask(masked)).toBe(text)
  })

  it('küçük harfli sıradan sözcük, sözcük içi ve listedeki ardışık tam adlar doğru ayrılır', () => {
    const masker = createMasker(buildContactMasks({ fullName: 'Deniz Kaya' }))
    // "deniz" (sıradan sözcük) küçük harfle maskelenmez; "Kayalar", "Denizli" sözcük içi eşleşme değil.
    expect(masker.mask('deniz kenarı, Kayalar Sokak, Denizli')).toBe('deniz kenarı, Kayalar Sokak, Denizli')
    // "Kaya, DENIZ" ters ad sanılmaz: iki tam ad ayrı maskelenir.
    expect(masker.mask('Deniz Kaya, DENIZ KAYA')).toBe('⟦NAME⟧, ⟦NAME_2⟧')
    // Bilinen bedel: adla aynı yazılan büyük harfli özel ad da maskelenir (kayıpsız).
    const masked = masker.mask('Kaya Yapı A.Ş.')
    expect(masked).toBe('⟦NAME_3⟧ Yapı A.Ş.')
    expect(masker.unmask(masked)).toBe('Kaya Yapı A.Ş.')
  })

  it('bağlantı ve e-postadaki bitişik ad maskelenir; adı içermeyen bağlantı olduğu gibi gider', () => {
    const cv = sampleCv()
    cv.personal = { ...cv.personal, fullName: 'Kâmil Öztürk', website: '', github: '', linkedin: '' }
    const text =
      '<p>Site: https://kamilozturk.dev · github.com/kamilozturk/proje · gitlab.com/kamil-ozturk · ozturk_kamil.example.com · Kamil.Ozturk92 · k.ozturk@firma.example.com · github.com/vercel/next.js</p>'
    summaryOf(cv).content = text
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'Özeti düzelt')
    const sent = sentSummary(payload)
    expect(foldedHas(sent, 'ozturk')).toBe(false)
    expect(foldedHas(sent, 'kamil')).toBe(false)
    expect(sent).toContain('github.com/⟦NAME')
    expect(sent).toContain('.dev')
    expect(sent).toContain('github.com/vercel/next.js')
    expect(unmask(sent)).toBe(text)
  })

  it('referans kişinin adı da aynı kurallarla (soyad tek başına, bitişik biçim)', () => {
    const cv = sampleCv()
    const refs = createSection('references', 1)
    Object.assign(refs.items[0], { name: 'Mehmet Demir', position: 'Yönetici' })
    cv.sections.push(refs)
    summaryOf(cv).content = '<p>Demir, M. ve Mehmet Bey ile çalıştım: linkedin.com/in/mehmet-demir</p>'
    const { payload } = buildEditPayload(cv, { kind: 'all' }, 'Özeti düzelt')
    const sent = sentSummary(payload)
    expect(sent).not.toMatch(/mehmet|demir/i)
    expect(sent).toContain('⟦REFNAME')
  })
})

describe('uydurma yer tutucu geri konmaz', () => {
  it('istekte gönderilmeyen ⟦PHONE⟧/⟦EMAIL⟧/⟦NAME⟧ değeri yerelde doldurulmaz; işlem atılır', () => {
    const cv = sampleCv()
    const summary = cv.sections.find((s) => s.type === 'summary')!.items[0]
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'Özeti düzelt')
    expect(payload.placeholders).not.toContain('⟦PHONE⟧')
    for (const p of ['⟦PHONE⟧', '⟦EMAIL⟧', '⟦NAME⟧', '⟦LOCATION_4⟧']) expect(unmask(`Ara: ${p}`)).toBe(`Ara: ${p}`)
    const result = operationsToSuggestions(
      cv,
      {
        operations: [
          { op: 'set', target: summary.id, field: 'content', value: '<p>Bana ⟦PHONE⟧ numarasından ulaşın.</p>' },
          { op: 'set', target: 'personal', field: 'headline', value: '⟦NAME⟧ — Frontend Geliştirici' },
        ],
      },
      unmask,
      payload,
    )
    expect(result.suggestions).toEqual([])
    expect(result.dropped).toBe(2)
  })

  it('istek iletişim alanıyla ilgiliyse o alanın yer tutucusu kişisel değerle doldurulur (yalnız o alan)', () => {
    const cv = sampleCv()
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'Telefonumu özete ekle')
    expect(payload.personal.phone).toBe(cv.personal.phone)
    expect(unmask('⟦PHONE⟧')).toBe(cv.personal.phone)
    expect(unmask('⟦EMAIL⟧')).toBe('⟦EMAIL⟧')
    expect(unmask('⟦NAME⟧')).toBe('⟦NAME⟧')
  })

  it('çeviri yanıtında uydurma yer tutucu alanı kaynak metinle bırakır', () => {
    const cv = sampleCv()
    const entries = collectCvTexts(cv)
    const prepared = buildTranslateRequest('tr', 'en', entries, maskSourceOf(cv))
    const first = entries[0]
    const merged = mergeTranslations([first], { items: [{ key: first.key, text: 'Call ⟦PHONE⟧' }] }, prepared)
    expect(merged[0]).toMatchObject({ translated: first.text, unrestored: true })
  })
})
