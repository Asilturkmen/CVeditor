import { afterEach, describe, expect, it } from 'vitest'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { AnyItem, Cv } from '@/cv/schema'
import { templateSettingsFor } from '@/render/templates'
import { matchJobAd } from '@/review/keywords'
import { cvPlainText } from '@/review/text'
import { MOCK_FLAGS_KEY, mockProvider, resetMockSession } from './mockProvider'
import { mockMatchKeywords, mockReview } from './mockReview'
import type { PdfText } from './pdfText'
import { fold } from './places'
import { buildKeywordMatchRequest, buildReviewRequest, reviewNameFound, reviewSource } from './review'
import { AiError, type KeywordMatchRequest, type ReviewRequest } from './types'
import { parseKeywordMatchResult, parseReviewResult } from './validate'

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

function pdfOf(text: string): PdfText {
  const lines = text.split('\n').map((t, i) => ({ text: t, page: 1, x: 40, y: 40 + i * 14, size: i === 0 ? 22 : 10 }))
  return { pageCount: 1, lines, text, pageWidth: 595 }
}

const expectError = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(AiError)
  expect((error as AiError).code).toBe(code)
}

describe('inceleme yorumu: şema', () => {
  it('geçerli yanıtı kabul eder; puan gibi şemada olmayan alanlar atılır', () => {
    const result = parseReviewResult({
      score: 87,
      comments: [{ kind: 'improve', message: '  Maddelere sayı ekle.  ', target: { sectionId: 's1', itemId: 'i1' }, percent: 40 }],
    })
    expect(result).toEqual({ comments: [{ kind: 'improve', message: 'Maddelere sayı ekle.', target: { sectionId: 's1', itemId: 'i1' } }] })
    expect(JSON.stringify(result)).not.toMatch(/score|percent|87/)
  })

  it('kod bloğundaki JSON metni de okunur', () => {
    const raw = '```json\n{"comments":[{"kind":"strength","message":"Özet net."}]}\n```'
    expect(parseReviewResult(raw).comments).toHaveLength(1)
  })

  it('bilinmeyen tür, boş ileti ve eksik alan reddedilir', () => {
    for (const raw of [
      { comments: [{ kind: 'score', message: 'x' }] },
      { comments: [{ kind: 'improve', message: '   ' }] },
      { notes: [] },
      'bu bir JSON değil',
    ]) {
      expect(() => parseReviewResult(raw)).toThrow(AiError)
    }
  })
})

describe('ilan eşleşmesi: şema', () => {
  it('matched / missing / related biçimini kabul eder, eksik alanı reddeder', () => {
    const ok = parseKeywordMatchResult({ matched: ['React'], missing: ['Go'], related: [{ term: 'takım çalışması', cvTerm: 'ekip çalışması' }] })
    expect(ok.related[0].cvTerm).toBe('ekip çalışması')
    expect(() => parseKeywordMatchResult({ matched: [], missing: [] })).toThrow(AiError)
    expect(() => parseKeywordMatchResult({ matched: [''], missing: [], related: [] })).toThrow(AiError)
  })
})

describe('sınırı biraz aşan model çıktısı bütünüyle reddedilmez', () => {
  it('20\'den fazla yorum ilk 20\'ye iner, uzun ileti kısaltılır', () => {
    const long = 'Bu madde çok uzun bir açıklama içeriyor '.repeat(25)
    const result = parseReviewResult({
      comments: [{ kind: 'improve', message: long }, ...Array.from({ length: 24 }, (_, i) => ({ kind: 'strength', message: `Yorum ${i}` }))],
    })
    expect(result.comments).toHaveLength(20)
    expect(result.comments[0].message.length).toBeLessThanOrEqual(600)
    expect(result.comments[0].message.endsWith('…')).toBe(true)
    expect(result.comments[19].message).toBe('Yorum 18')
  })

  it('80 karakterden uzun terim atılır, gerisi kalır; 60\'tan fazla terim kesilir', () => {
    const tooLong = 'çok '.repeat(30).trim()
    const result = parseKeywordMatchResult({
      matched: ['React', tooLong, ...Array.from({ length: 70 }, (_, i) => `terim ${i}`)],
      missing: [tooLong, 'Go'],
      related: [
        { term: 'takım çalışması', cvTerm: tooLong },
        { term: 'JavaScript', cvTerm: 'JS' },
      ],
    })
    expect(result.matched).toHaveLength(60)
    expect(result.matched[0]).toBe('React')
    expect(result.matched).not.toContain(tooLong)
    expect(result.missing).toEqual(['Go'])
    expect(result.related).toEqual([{ term: 'JavaScript', cvTerm: 'JS' }])
  })
})

describe('inceleme isteği: gizlilik ve geri koyma', () => {
  it('kendi CV: ad, e-posta, telefon gitmez; gizli kayıt gitmez; yorum yer tutucusu geri konur', () => {
    const cv = sampleCv()
    const exp = cv.sections.find((s) => s.type === 'experience')!
    const items = exp.items as AnyItem[]
    items[1].hidden = true
    ;(items[0] as unknown as Record<string, string>).description = '<ul><li>deniz.aksoy@example.com adresinden destek verdim</li></ul>'
    const { request, finish } = buildReviewRequest({ kind: 'cv', cv }, 'React geliştirici arıyoruz', 'tr')
    const json = JSON.stringify(request)
    expect(json).not.toContain('Deniz Aksoy')
    expect(json).not.toContain('deniz.aksoy@example.com')
    expect(json).not.toContain('+90 555')
    expect(json).toContain('⟦EMAIL⟧')
    expect(request.placeholders).toContain('⟦EMAIL⟧')
    expect(request.jobAd).toBe('React geliştirici arıyoruz')
    expect(request.source.kind === 'cv' && request.source.sections.find((s) => s.id === exp.id)!.items.map((i) => i.id)).not.toContain(items[1].id)

    const comments = finish({
      comments: [
        { kind: 'improve', message: '⟦EMAIL⟧ yerine iş e-postanı yaz.', target: { sectionId: exp.id, itemId: items[0].id } },
        { kind: 'improve', message: 'Uydurma hedef', target: { sectionId: 'yok' } },
        { kind: 'improve', message: 'Yanlış bölüm', target: { sectionId: exp.id, itemId: 'baska-kayit' } },
        { kind: 'strength', message: '⟦PHONE_9⟧ uydurma yer tutucu' },
      ],
    })
    expect(comments[0]).toEqual({ kind: 'improve', message: 'deniz.aksoy@example.com yerine iş e-postanı yaz.', target: { sectionId: exp.id, itemId: items[0].id } })
    expect(comments[1].target).toBeUndefined()
    expect(comments[2].target).toEqual({ sectionId: exp.id })
    expect(comments).toHaveLength(3)
  })

  it('PDF metni: iletişim ve tahmin edilen ad maskeli gider; ilan yoksa jobAd alanı yok', () => {
    const pdf = pdfOf('Ayşe Kaya\nayse.kaya@example.com · +90 555 111 22 33\nDeneyim\n• Raporları hazırladım')
    const source = reviewSource(null, pdf, 'tr')!
    const { request } = buildReviewRequest(source, '  ', 'en')
    const json = JSON.stringify(request)
    expect(json).not.toContain('Ayşe Kaya')
    expect(json).not.toContain('ayse.kaya@example.com')
    expect(json).not.toContain('555 111')
    expect(request.language).toBe('en')
    expect('jobAd' in request).toBe(false)
  })

  it('PDF metni: konum parçaları her yazımıyla, ad biçimleri ve referans adları maskeli gider; geri konur', () => {
    const text = [
      'AYŞE YILMAZ',
      'ayse.yilmaz@example.com | 0555 111 22 33 | Kadıköy, İstanbul',
      'Deneyim',
      '• İstanbul ofisinde, ISTANBUL ve istanbul ekipleriyle çalıştım. Ayse Yilmaz olarak imzaladım; Ayşe’nin raporları.',
      '• github.com/ayseyilmaz/rapor deposunu kurdum.',
      'Referanslar',
      'Mehmet Demir, ABC A.Ş.',
      'Dr. Zeynep Kara – Proje Müdürü',
      'Proje Müdürü, XYZ Ltd.',
      'mehmet@example.com',
      'Beceriler',
      'Excel, Raporlama',
    ].join('\n')
    const source = reviewSource(null, pdfOf(text), 'tr')!
    expect(reviewNameFound(source)).toBe(true)
    const { request, finish, nameFound } = buildReviewRequest(source, '', 'tr')
    expect(nameFound).toBe(true)
    const sent = request.source.kind === 'text' ? request.source.text : ''
    const folded = fold(sent)
    for (const needle of ['ayse', 'yilmaz', 'istanbul', 'kadikoy', 'mehmet', 'demir', 'zeynep', 'kara', '555 111']) {
      expect(folded, needle).not.toContain(needle)
    }
    // Unvan satırı ve beceriler olduğu gibi
    expect(sent).toContain('Proje Müdürü, XYZ Ltd.')
    expect(sent).toContain('Excel, Raporlama')
    expect(request.placeholders.every((p) => sent.includes(p))).toBe(true)

    const refTag = /⟦REFNAME(?:_\d+)?⟧/.exec(sent)![0]
    const comments = finish({
      comments: [
        { kind: 'strength', message: `${refTag} referansı güçlü.` },
        // Uydurma yer tutucu (gönderilmedi): boşa çevrilip gösterilmez, yorum atılır.
        { kind: 'improve', message: 'Bana ⟦PHONE_9⟧ numarasından ulaşın.' },
      ],
    })
    expect(comments).toEqual([{ kind: 'strength', message: 'Mehmet Demir referansı güçlü.' }])
  })

  it('PDF\'te ad bulunamazsa nameFound: false (arayüz uyarır)', () => {
    const pdf = pdfOf('deneyimli bir yazılımcıyım\nraporlar hazırladım ve ekipler yönettim\nDeneyim\n• Raporları hazırladım')
    const source = reviewSource(null, pdf, 'tr')!
    expect(reviewNameFound(source)).toBe(false)
    expect(buildReviewRequest(source, '', 'tr').nameFound).toBe(false)
    expect(buildKeywordMatchRequest(source, 'React', matchJobAd('React', pdf.text, 'tr')).nameFound).toBe(false)
    expect(reviewNameFound({ kind: 'cv', cv: sampleCv() })).toBe(true)
  })

  it('ilan eşleşmesi (PDF): uydurma yer tutucu içeren terim atılır', () => {
    const pdf = pdfOf('Ayşe Kaya\nayse.kaya@example.com\nDeneyim\n• React ile arayüz geliştirdim')
    const { finish } = buildKeywordMatchRequest(reviewSource(null, pdf, 'tr')!, 'React', matchJobAd('React', pdf.text, 'tr'))
    expect(finish({ matched: ['React', '⟦NAME_7⟧ deneyimi'], missing: [], related: [{ term: 'UI', cvTerm: '⟦EMAIL_5⟧' }] })).toEqual({
      matched: ['React'],
      missing: [],
      related: [],
    })
  })

  it('ilan eşleşmesi: CV metni maskeli, kurallı terimler gider; yanıt tekrarları birleşir', () => {
    const cv = sampleCv()
    const ad = 'React, TypeScript ve takım çalışması bilen; Go ile backend yazabilen birini arıyoruz.'
    const rule = matchJobAd(ad, cvPlainText(cv), 'tr')
    const { request, finish } = buildKeywordMatchRequest({ kind: 'cv', cv }, ad, rule)
    expect(request.cvText).not.toContain('Deniz Aksoy')
    expect(request.cvText).not.toContain('deniz.aksoy@example.com')
    expect(request.cvText).toContain('React')
    expect(request.ruleKeywords.present).toEqual(rule.present.map((k) => k.term))
    expect(request.jobAd).toBe(ad)
    const out = finish({ matched: ['React', 'react', '⟦NAME_7⟧'], missing: ['Go'], related: [{ term: 'React', cvTerm: 'React.js' }] })
    expect(out).toEqual({ matched: ['React'], missing: ['Go'], related: [] })
  })
})

describe('örnek sağlayıcı: inceleme', () => {
  const cvRequest = (ad?: string): ReviewRequest => buildReviewRequest({ kind: 'cv', cv: sampleCv() }, ad ?? '', 'tr').request

  it('deterministik örnek yorum üretir; puan ya da yüzde yok', () => {
    const request = cvRequest('React ve TypeScript bilen frontend geliştirici')
    const a = mockReview(request)
    const b = mockReview(structuredClone(request))
    expect(a).toEqual(b)
    expect(a.comments.map((c) => c.kind)).toContain('job_fit')
    expect(parseReviewResult(a)).toEqual(a)
    expect(a.comments.map((c) => c.message).join(' ')).not.toMatch(/%|puan/i)
  })

  it('sayısız madde varsa ilgili kaydı hedef gösterir', () => {
    const request = cvRequest()
    const result = mockReview(request)
    const numbers = result.comments.find((c) => c.target)!
    expect(numbers.kind).toBe('improve')
    const ids = request.source.kind === 'cv' ? request.source.sections.flatMap((s) => s.items.map((i) => i.id)) : []
    expect(ids).toContain(numbers.target!.itemId)
  })

  it('PDF metninde madde işaretli satırları sayar, zayıf kalıbı bulur', () => {
    const request: ReviewRequest = { language: 'tr', cvLanguage: 'tr', source: { kind: 'text', text: 'Deneyim\n• Raporlama işlerinde görev aldım\n• 12 kişilik ekibi yönettim' }, placeholders: [] }
    const result = mockReview(request)
    expect(result.comments.some((c) => c.kind === 'improve' && c.message.includes('görev aldım'))).toBe(true)
    expect(result.comments.every((c) => !c.target)).toBe(true)
  })

  it('eş anlamlı tablosuyla "başka adla var" bulur, gerisi eksik kalır', () => {
    const request: KeywordMatchRequest = {
      language: 'tr',
      jobAd: '',
      cvText: 'Ekip çalışması ve JS ile arayüz geliştirdim.',
      ruleKeywords: { present: ['React'], missing: ['takım çalışması', 'JavaScript', 'Go'] },
      placeholders: [],
    }
    expect(mockMatchKeywords(request)).toEqual({
      matched: ['React'],
      related: [
        { term: 'takım çalışması', cvTerm: 'Ekip çalışması' },
        { term: 'JavaScript', cvTerm: 'JS' },
      ],
      missing: ['Go'],
    })
  })
})

describe('örnek sağlayıcı: iptal, parola ve hata bayrakları', () => {
  afterEach(() => {
    localStorage.removeItem(MOCK_FLAGS_KEY)
    resetMockSession()
  })

  const request = (): ReviewRequest => ({ language: 'tr', cvLanguage: 'tr', source: { kind: 'text', text: '' }, placeholders: [] })

  it('örnek sağlayıcı parola istemez ve isDemo taşır', async () => {
    expect(mockProvider.isDemo).toBe(true)
    expect(mockProvider.requiresAuth).toBe(false)
    const result = await mockProvider.review(request(), new AbortController().signal)
    expect(result.comments.length).toBeGreaterThan(0)
  })

  it('AbortSignal ile durdurulur', async () => {
    const controller = new AbortController()
    const pending = mockProvider.matchKeywords(
      { language: 'tr', jobAd: '', cvText: '', ruleKeywords: { present: [], missing: [] }, placeholders: [] },
      controller.signal,
    )
    controller.abort()
    await expectError(pending, 'aborted')
  })

  it('parola bayrağı: önce unauthorized, yanlış parola reddedilir, doğrusu oturumu açar', async () => {
    localStorage.setItem(MOCK_FLAGS_KEY, JSON.stringify({ password: 'deneme' }))
    const signal = new AbortController().signal
    expect(mockProvider.requiresAuth).toBe(true)
    await expectError(mockProvider.review(request(), signal), 'unauthorized')
    await expectError(mockProvider.authenticate!('yanlis', signal), 'unauthorized')
    await mockProvider.authenticate!('deneme', signal)
    await expect(mockProvider.review(request(), signal)).resolves.toHaveProperty('comments')
  })

  it('hata bayrağı: her çağrı o kodla döner', async () => {
    localStorage.setItem(MOCK_FLAGS_KEY, JSON.stringify({ fail: 'rate_limited' }))
    await expectError(mockProvider.review(request(), new AbortController().signal), 'rate_limited')
  })
})
