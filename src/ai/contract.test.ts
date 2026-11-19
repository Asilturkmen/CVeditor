import { describe, expect, it, vi } from 'vitest'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { Cv } from '@/cv/schema'
import { templateSettingsFor } from '@/render/templates'
import { matchJobAd } from '@/review/keywords'
import { unmaskImport } from './importText'
import { operationsToSuggestions } from './ops'
import { buildEditPayload } from './payload'
import { guessPdfName, maskPdfText } from './pdfMask'
import type { PdfText } from './pdfText'
import { checkedProvider } from './provider'
import { buildKeywordMatchRequest, buildReviewRequest, reviewSource } from './review'
import { AI_LIMITS, AiError, type AiProvider } from './types'
import { checkRequest, parseEditResult, parseImportResult, parseReviewResult, parseTranslateResult, stripScores } from './validate'

/**
 * Yapay zekâ sözleşmesi ve gizlilik (2026-11-19): PDF ad tahmini, içe aktarma
 * ile incelemenin ortak maskesi, bozuk yer tutucunun her yolda reddi, yanıt
 * şemalarında null / sınır, istek şemaları ve boyut sınırı, puan ayıklama.
 * Bütün kişiler uydurmadır.
 */

function sampleCv(): Cv {
  const sections = sampleSections('tr')
  return createCv({ name: 'Test', language: 'tr', templateId: 'zarif', template: templateSettingsFor('zarif', sections), personal: samplePersonal('tr'), sections })
}

/** Satırlar; `big` verilen satır(lar) büyük yazı (ad adayı) */
function pdfOf(lines: string[], big: number[] = []): PdfText {
  return {
    pageCount: 1,
    lines: lines.map((text, i) => ({ text, page: 1, x: 40, y: 40 + i * 14, size: big.includes(i) ? 22 : 10 })),
    text: lines.join('\n'),
    pageWidth: 595,
  }
}

const BODY = ['Deneyim', '• Raporları hazırladım ve ekipleri yönettim.', '• Süreçleri sadeleştirdim.', 'Eğitim', 'Örnek Üniversitesi']

describe('PDF ad tahmini', () => {
  it.each(['CURRICULUM VITAE', 'ÖZ GEÇMİŞ', 'ÖZGEÇMİŞ', 'RESUME', 'CV', 'Curriculum Vitae'])('"%s" ad sanılmaz; asıl ad bulunur', (title) => {
    const pdf = pdfOf([title, 'Ayşe Yılmaz', 'ayse.yilmaz@example.com', ...BODY], [0])
    const masked = maskPdfText(pdf, 'tr')
    expect(masked.name).toBe('Ayşe Yılmaz')
    expect(masked.nameFound).toBe(true)
    expect(masked.text).not.toMatch(/ay[sş]e|y[iı]lmaz/i)
    expect(masked.text).toContain(title)
  })

  it('bölüm başlığı ad sanılmaz; ad yoksa "bulunamadı"', () => {
    const pdf = pdfOf(['İŞ DENEYİMİ', 'Teknik Yetenekler', 'deneyimli bir yazılımcıyım', ...BODY], [0, 1])
    const masked = maskPdfText(pdf, 'tr')
    expect(masked.nameFound).toBe(false)
    expect(masked.name).toBeNull()
  })

  it('ilk satırlarda olmayan aday ancak e-posta/LinkedIn ile doğrulanırsa "emin" sayılır', () => {
    const filler = Array.from({ length: 6 }, (_, i) => `Satır ${i} bir cümle.`)
    const lines = [...filler, 'Deniz Aksoy', 'Proje Müdürü']
    const unsure = guessPdfName(pdfOf(lines), {}, lines.join('\n'), 'tr')
    expect(unsure.confident).toBe(false)
    const sure = guessPdfName(pdfOf(lines), { email: 'deniz.aksoy@example.com' }, lines.join('\n'), 'tr')
    expect(sure).toMatchObject({ name: 'Deniz Aksoy', confident: true })
    // Emin olunmasa da aday maskelenir (fazladan maske zararsızdır)
    const masked = maskPdfText(pdfOf([...lines, ...BODY]), 'tr')
    expect(masked.nameFound).toBe(false)
    expect(masked.text).not.toContain('Deniz Aksoy')
  })

  it('içe aktarma ile inceleme aynı maskeyi kullanır (aynı metin, aynı yer tutucular)', () => {
    const pdf = pdfOf(
      [
        'Ayşe Yılmaz',
        'ayse.yilmaz@example.com · 0(532) 123 45 67 · LinkedIn: aysecodes',
        'Doğum Tarihi: 12.03.1995',
        'Atatürk Mah. Çiçek Sok. No:12 D:4 Bornova / İzmir',
        ...BODY,
        'Referanslar',
        'Mehmet Demir, ABC A.Ş.',
      ],
      [0],
    )
    const imported = maskPdfText(pdf, 'tr')
    const review = buildReviewRequest(reviewSource(null, pdf, 'tr')!, '', 'tr').request
    expect(review.source).toEqual({ kind: 'text', text: imported.text })
    for (const needle of ['Ayşe', 'example.com', '532', 'aysecodes', '1995', 'Çiçek', 'Mehmet']) expect(imported.text, needle).not.toContain(needle)
    expect(imported.text).toContain('⟦BIRTHDATE⟧')
    expect(imported.text).toContain('⟦ADDRESS⟧')
  })
})

describe('bozuk yer tutucu her yolda reddedilir', () => {
  const BROKEN = ['⟦İSİM⟧', '⟦E-POSTA⟧', '⟦Name⟧', '⟦NAME 2⟧', '[EMAIL]', '⟦EMAIL']

  it.each(BROKEN)('düzenleme: %s içeren öneri atılır', (bad) => {
    const cv = sampleCv()
    const summary = cv.sections.find((s) => s.type === 'summary')!.items[0]
    summary.content = '<p>Ben Deniz Aksoy; deniz.aksoy@example.com</p>'
    const { payload, restore } = buildEditPayload(cv, { kind: 'all' }, 'Özeti düzelt')
    const result = operationsToSuggestions(cv, { operations: [{ op: 'set', target: summary.id, field: 'content', value: `<p>${bad} ⟦NAME⟧ ⟦EMAIL⟧</p>` }] }, restore, payload)
    expect(result.suggestions).toEqual([])
    expect(result.dropped).toBe(1)
  })

  it.each(BROKEN)('inceleme ve ilan eşleşmesi: %s içeren yorum/terim atılır', (bad) => {
    const pdf = pdfOf(['Ayşe Kaya', 'ayse.kaya@example.com', ...BODY], [0])
    const source = reviewSource(null, pdf, 'tr')!
    const review = buildReviewRequest(source, '', 'tr')
    expect(review.finish({ comments: [{ kind: 'improve', message: `${bad} ile ⟦NAME⟧ yazmış.` }, { kind: 'strength', message: '⟦NAME⟧ iyi.' }] })).toEqual([
      { kind: 'strength', message: 'Ayşe Kaya iyi.' },
    ])
    const kw = buildKeywordMatchRequest(source, 'React', matchJobAd('React', pdf.text, 'tr'))
    expect(kw.finish({ matched: [`${bad} React`, 'Excel'], missing: [], related: [] }).matched).toEqual(['Excel'])
  })

  it.each(BROKEN)('içe aktarma: %s içeren değer boş bırakılır ve sayılır', (bad) => {
    const map = { '⟦NAME⟧': 'Ayşe Kaya', '⟦EMAIL⟧': 'ayse@example.com' }
    const { result, dropped } = unmaskImport(
      { personal: { fullName: '⟦NAME⟧', email: `${bad}` }, sections: [{ type: 'summary', title: null, items: [{ fields: { content: `${bad} ⟦NAME⟧` } }] }] },
      map,
    )
    expect(result.personal.fullName).toBe('Ayşe Kaya')
    expect(result.personal.email).toBe('')
    expect(result.sections[0].items[0].fields.content).toBe('')
    expect(dropped).toBe(2)
  })

  it('kullanıcının metnindeki hazır ⟦…⟧ yanıtta kendi değerine döner (düzenleme)', () => {
    const cv = sampleCv()
    const summary = cv.sections.find((s) => s.type === 'summary')!.items[0]
    summary.content = '<p>Şablonda ⟦EMAIL⟧ yazıyor; gerçek adres deniz.aksoy@example.com</p>'
    const { payload, restore } = buildEditPayload(cv, { kind: 'all' }, 'Özeti düzelt')
    const sent = payload.sections.find((s) => s.type === 'summary')!.items[0].content as string
    expect(sent).toBe('<p>Şablonda ⟦RAW⟧ yazıyor; gerçek adres ⟦EMAIL⟧</p>')
    const result = operationsToSuggestions(cv, { operations: [{ op: 'set', target: summary.id, field: 'content', value: '<p>Şablonda ⟦RAW⟧ yazar; adres ⟦EMAIL⟧</p>' }] }, restore, payload)
    expect(result.suggestions[0]).toMatchObject({ after: '<p>Şablonda ⟦EMAIL⟧ yazar; adres deniz.aksoy@example.com</p>' })
  })
})

describe('yanıt şemaları: null, sınır, kırpma', () => {
  it('isteğe bağlı alanlarda null kabul edilir', () => {
    const edit = parseEditResult({
      operations: [
        { op: 'set', target: 'a', field: 'b', value: 'c', reason: null },
        { op: 'add', sectionId: 's', afterItemId: null, fields: { name: 'x', email: null }, reason: null },
        { op: 'add', sectionId: 's', fields: { name: 'y' } },
      ],
      message: null,
    })
    expect(edit.operations).toHaveLength(3)
    expect(edit.overflow).toBe(0)
    const imported = parseImportResult({
      personal: { fullName: 'A', email: null, phone: null },
      sections: [{ type: 'experience', title: null, items: [{ fields: { position: 'X', company: null }, start: null, end: null, bullets: null }] }],
    })
    expect(imported.sections[0].items[0].fields).toEqual({ position: 'X' })
    expect(parseImportResult({ personal: null, sections: [] }).personal).toEqual({})
  })

  it("40'tan fazla işlem: ilk 40 gösterilir, kalan sayılır", () => {
    const ops = Array.from({ length: 47 }, (_, i) => ({ op: 'remove', sectionId: 's', itemId: `i${i}` }))
    const result = parseEditResult({ operations: ops })
    expect(result.operations).toHaveLength(AI_LIMITS.operations)
    expect(result.overflow).toBe(7)
  })

  it('çeviri ve içe aktarma sonuçlarına sınır: fazlası kırpılır, aşırı uzun değer atılır', () => {
    const huge = 'x'.repeat(AI_LIMITS.field + 1)
    const tr = parseTranslateResult({ items: [{ key: 'a', text: huge }, { key: 'b', text: 'ok' }] })
    expect(tr.items).toEqual([{ key: 'b', text: 'ok' }])
    const many = parseTranslateResult({ items: Array.from({ length: AI_LIMITS.translateItems + 5 }, (_, i) => ({ key: `k${i}`, text: 't' })) })
    expect(many.items).toHaveLength(AI_LIMITS.translateItems)
    const imp = parseImportResult({
      sections: Array.from({ length: AI_LIMITS.importSections + 3 }, () => ({
        type: 'skills',
        items: Array.from({ length: AI_LIMITS.importItems + 2 }, () => ({ fields: { name: 'a', keywords: huge }, bullets: [huge, 'b'] })),
      })),
    })
    expect(imp.sections).toHaveLength(AI_LIMITS.importSections)
    expect(imp.sections[0].items).toHaveLength(AI_LIMITS.importItems)
    expect(imp.sections[0].items[0]).toMatchObject({ fields: { name: 'a' }, bullets: ['b'] })
  })

  it('yorumdaki puan ve yüzde kalıpları ayıklanır; CV’nin kendi sayıları kalır', () => {
    expect(stripScores('Genel puanın 82/100. Deneyim maddelerin güçlü.')).toBe('Deneyim maddelerin güçlü.')
    expect(stripScores('CV’n ATS uyumu açısından %87.')).toBe('')
    expect(stripScores('İlanla eşleşme oranı 87%. Becerileri öne al.')).toBe('Becerileri öne al.')
    expect(stripScores('Score: 8. Add metrics.')).toBe('Add metrics.')
    expect(stripScores('I would rate it 8 out of 10. Good structure.')).toBe('Good structure.')
    expect(stripScores('Yükleme süresini %30 kısalttığını yazman güçlü.')).toBe('Yükleme süresini %30 kısalttığını yazman güçlü.')
    expect(stripScores('03/2020 – 05/2022 arası boşluk yok.')).toBe('03/2020 – 05/2022 arası boşluk yok.')
    const parsed = parseReviewResult({ comments: [{ kind: 'strength', message: '82/100' }, { kind: 'improve', message: 'Puan: 7. Özet ekle.' }] })
    expect(parsed.comments).toEqual([{ kind: 'improve', message: 'Özet ekle.' }])
  })
})

describe('istek şemaları ve boyut sınırı', () => {
  it('geçerli istekler geçer; sınırı aşan istek too_large, biçim hatası bad_request', () => {
    const cv = sampleCv()
    const { payload } = buildEditPayload(cv, { kind: 'all' }, 'Özeti düzelt')
    expect(checkRequest('edit', payload)).toBe(payload)
    const code = (fn: () => unknown) => {
      try {
        fn()
        return null
      } catch (error) {
        return (error as AiError).code
      }
    }
    expect(code(() => checkRequest('edit', { ...payload, prompt: 'x'.repeat(AI_LIMITS.prompt + 1) }))).toBe('too_large')
    expect(code(() => checkRequest('import', { text: 'x'.repeat(AI_LIMITS.requestChars + 1), language: 'tr' }))).toBe('too_large')
    expect(code(() => checkRequest('edit', { ...payload, scope: { kind: 'bölüm' } }))).toBe('bad_request')
    // Kişisel bilgide ad alanı sözleşmede yok: gönderilemez
    expect(code(() => checkRequest('edit', { ...payload, personal: { fullName: 'Deniz Aksoy' } }))).toBe('bad_request')
  })

  it('checkedProvider sınırı aşan isteği sağlayıcıya hiç iletmez', async () => {
    const edit = vi.fn()
    const base = { id: 't', isDemo: false, requiresAuth: false, edit } as unknown as AiProvider
    const provider = checkedProvider(base)
    const cv = sampleCv()
    const { payload } = buildEditPayload(cv, { kind: 'all' }, 'x'.repeat(AI_LIMITS.prompt + 10))
    await expect(provider.edit(payload, new AbortController().signal)).rejects.toMatchObject({ code: 'too_large' })
    expect(edit).not.toHaveBeenCalled()
    expect(provider.isDemo).toBe(false)
  })

  it('düzenleme isteğinde her bölümün yazılabilir alanları (zengin/düz) gider', () => {
    const { payload } = buildEditPayload(sampleCv(), { kind: 'all' }, 'x')
    const exp = payload.sections.find((s) => s.type === 'experience')!
    expect(exp.fields).toEqual([
      { key: 'position', rich: false },
      { key: 'company', rich: false },
      { key: 'location', rich: false },
      { key: 'description', rich: true },
    ])
  })
})
