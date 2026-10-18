import { describe, expect, it } from 'vitest'
import { createCv, createSection } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { AnyItem, Cv } from '@/cv/schema'
import { templateSettingsFor } from '@/render/templates'
import { mockEdit, mockProvider } from './mockProvider'
import { operationsToSuggestions } from './ops'
import { buildContactMasks, createMasker } from './mask'
import { buildEditPayload, contactFieldsForPrompt, hasPlaceholder } from './payload'
import { AiError, type EditResult } from './types'
import { parseEditResult, parseImportResult, parseTranslateResult } from './validate'

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

const sectionOf = (cv: Cv, type: string) => cv.sections.find((s) => s.type === type)!
const itemsOf = (cv: Cv, type: string) => sectionOf(cv, type).items as AnyItem[]
const rec = (item: AnyItem) => item as unknown as Record<string, unknown>
/** Payload'un kimliksiz JSON'u: içerik araması rastgele UUID'lere takılmasın. */
const payloadText = (payload: unknown) => JSON.stringify(payload, (key, value) => (key === 'id' || key === 'sectionId' || key === 'itemId' ? undefined : value))

describe('payload: kapsam', () => {
  it('Tüm CV: görünür bölümler, gizli kayıt ve bölüm yok, tarihler yalnız bağlam', () => {
    const cv = sampleCv()
    itemsOf(cv, 'experience')[1].hidden = true
    sectionOf(cv, 'certificates').hidden = true
    const { payload } = buildEditPayload(cv, { kind: 'all' }, 'Maddeleri düzelt')
    expect(payload.sections.map((s) => s.type)).not.toContain('certificates')
    const exp = payload.sections.find((s) => s.type === 'experience')!
    expect(exp.items.map((i) => i.id)).toEqual([itemsOf(cv, 'experience')[0].id, itemsOf(cv, 'experience')[2].id])
    expect(exp.items[0]).toMatchObject({ position: 'Frontend Geliştirici', start: '2024-02', end: 'present' })
    // Metin alanı olmayan alanlar (gizli bayrağı, çeviri grubu) gitmez.
    expect(exp.items[0]).not.toHaveProperty('translationGroupId')
    expect(exp.items[0]).not.toHaveProperty('hidden')
  })

  it('bölüm ve kayıt kapsamı yalnız o parçayı gönderir', () => {
    const cv = sampleCv()
    const projects = sectionOf(cv, 'projects')
    const section = buildEditPayload(cv, { kind: 'section', sectionId: projects.id }, 'x').payload
    expect(section.sections).toHaveLength(1)
    expect(section.sections[0].items).toHaveLength(2)
    const target = itemsOf(cv, 'projects')[1]
    const item = buildEditPayload(cv, { kind: 'item', sectionId: projects.id, itemId: target.id }, 'x').payload
    expect(item.sections).toHaveLength(1)
    expect(item.sections[0].items.map((i) => i.id)).toEqual([target.id])
    // Unvan yalnız Tüm CV kapsamında gider (yalnız orada değiştirilebilir).
    expect(item.personal).toEqual({})
    expect(section.personal).toEqual({})
    expect(buildEditPayload(cv, { kind: 'all' }, 'x').payload.personal).toEqual({ headline: 'Frontend Geliştirici' })
  })
})

describe('payload: gizlilik', () => {
  it('ad hiç gitmez, iletişim alanları istekle ilgili değilse gitmez', () => {
    const cv = sampleCv()
    const { payload } = buildEditPayload(cv, { kind: 'all' }, 'Deneyim maddelerini daha ölçülebilir yaz')
    const json = JSON.stringify(payload)
    expect(json).not.toContain(cv.personal.fullName)
    expect(json).not.toContain(cv.personal.email)
    expect(json).not.toContain(cv.personal.phone)
    expect(json).not.toContain(cv.personal.location)
    // Rakam araması kimliksiz metinde: rastgele UUID'ler "555" içerebilir.
    expect(payloadText(payload)).not.toMatch(/555/)
    expect(Object.keys(payload.personal)).toEqual(['headline'])
  })

  it('iletişim anahtar kelimeleri (TR/EN) yalnız ilgili alanları açar', () => {
    expect(contactFieldsForPrompt('E-posta adresimi düzelt')).toEqual(['email'])
    expect(contactFieldsForPrompt('fix my phone number')).toEqual(['phone'])
    expect(contactFieldsForPrompt('LinkedIn ve GitHub bağlantılarımı kontrol et')).toEqual(['linkedin', 'github'])
    expect(contactFieldsForPrompt('İletişim bilgilerimi gözden geçir')).toEqual(['email', 'phone', 'location', 'website', 'linkedin', 'github'])
    expect(contactFieldsForPrompt('Özeti kısalt')).toEqual([])
    const { payload } = buildEditPayload(sampleCv(), { kind: 'all' }, 'e-postamı güncelle')
    expect(payload.personal.email).toBe('deniz.aksoy@example.com')
    expect(payload.personal.phone).toBeUndefined()
  })

  it('metindeki ad, e-posta, telefon ve bağlantılar maskelenir ve geri konur', () => {
    const cv = sampleCv()
    const summary = itemsOf(cv, 'summary')[0]
    rec(summary).content =
      '<p>Ben deniz aksoy. Yaz: <a href="mailto:deniz.aksoy@example.com">deniz.aksoy@example.com</a>, ara: 0555 000 00 00 ya da +90 555 000 00 00. https://www.linkedin.com/in/deniz-aksoy-ornek/ · github.com/deniz-aksoy-ornek/rota</p>'
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'Özeti düzelt')
    const sent = payload.sections.find((s) => s.type === 'summary')!.items[0].content as string
    expect(sent).not.toMatch(/deniz|aksoy|555/i)
    expect(sent).toContain('⟦NAME⟧')
    expect(sent).toContain('mailto:⟦EMAIL⟧')
    expect(sent).toContain('⟦PHONE⟧')
    expect(sent).toContain('⟦PHONE_2⟧')
    expect(sent).toContain('⟦LINKEDIN⟧')
    expect(sent).toContain('⟦GITHUB⟧/rota')
    expect(payload.placeholders).toEqual(expect.arrayContaining(['⟦NAME⟧', '⟦EMAIL⟧', '⟦PHONE⟧', '⟦PHONE_2⟧', '⟦LINKEDIN⟧', '⟦GITHUB⟧']))
    expect(payload.placeholders).not.toContain('⟦WEBSITE⟧')
    // Geri koyma: her yazım özgün hâliyle döner.
    expect(unmask(sent)).toBe(rec(summary).content)
    // Model metinde geçmeyen bir yer tutucu yazarsa (istek o alanla ilgili değil) geri konmaz: uydurma.
    expect(unmask('Site: ⟦WEBSITE⟧')).toBe('Site: ⟦WEBSITE⟧')
    // İstek web sitesiyle ilgiliyse kişisel bilgideki değer konur (o değer zaten açıkça gitti).
    expect(buildEditPayload(cv, { kind: 'all' }, 'Web sitemi özete ekle').unmask('Site: ⟦WEBSITE⟧')).toBe('Site: denizaksoy.example.com')
    expect(unmask('⟦BILINMEYEN⟧')).toBe('⟦BILINMEYEN⟧')
    expect(hasPlaceholder(unmask('⟦BILINMEYEN⟧'))).toBe(true)
  })

  it('iletişim anahtar kelimeleri: yalnız açık ifadeler', () => {
    // Yanlış alarmlar: iletişim bilgisi gitmez
    for (const prompt of [
      'Web geliştirme deneyimimi öne çıkar',
      'Highlight my site reliability work',
      'Address the gaps in my experience',
      'Rewrite the mail order project description',
      'İletişim becerilerimi vurgula',
      'web geliştirici unvanını düzelt',
      'Mention my contact with customers',
      'Adresleme ve yönlendirme maddelerini kısalt',
    ]) {
      expect(contactFieldsForPrompt(prompt), prompt).toEqual([])
    }
    // Açık ifadeler
    expect(contactFieldsForPrompt('Web sitemi ekle')).toEqual(['website'])
    expect(contactFieldsForPrompt('web sitesi bağlantısını düzelt')).toEqual(['website'])
    expect(contactFieldsForPrompt('update my website link')).toEqual(['website'])
    expect(contactFieldsForPrompt('add my personal site')).toEqual(['website'])
    expect(contactFieldsForPrompt('kişisel siteyi güncelle')).toEqual(['website'])
    expect(contactFieldsForPrompt('portfolio site is outdated')).toEqual(['website'])
    expect(contactFieldsForPrompt('e-postamı değiştir')).toEqual(['email'])
    expect(contactFieldsForPrompt('eposta yanlış')).toEqual(['email'])
    expect(contactFieldsForPrompt('change my email')).toEqual(['email'])
    expect(contactFieldsForPrompt('e-mail adresimi düzelt')).toEqual(['email'])
    expect(contactFieldsForPrompt('mail adresim eski')).toEqual(['email'])
    expect(contactFieldsForPrompt('Telefonumu güncelle')).toEqual(['phone'])
    expect(contactFieldsForPrompt('numaram değişti')).toEqual(['phone'])
    expect(contactFieldsForPrompt('Adresimi İzmir yap')).toEqual(['location'])
    expect(contactFieldsForPrompt('update my address')).toEqual(['location'])
    expect(contactFieldsForPrompt('change location to Berlin')).toEqual(['location'])
    expect(contactFieldsForPrompt('Konumu düzelt')).toEqual(['location'])
    expect(contactFieldsForPrompt('Şehir bilgisini ekle')).toEqual(['location'])
    expect(contactFieldsForPrompt('LINKEDIN bağlantısı')).toEqual(['linkedin'])
    expect(contactFieldsForPrompt('Check my contact details')).toEqual(['email', 'phone', 'location', 'website', 'linkedin', 'github'])
    expect(contactFieldsForPrompt('İletişim kısmını düzenle')).toEqual(['email', 'phone', 'location', 'website', 'linkedin', 'github'])
  })

  it('ad Türkçe büyük/küçük harf ve boşluk farkına rağmen maskelenir', () => {
    const masker = createMasker(buildContactMasks({ fullName: 'Ayşe Yılmaz' }))
    const text = 'AYŞE YILMAZ · ayşe   yılmaz · AYSE YILMAZ · Ayşe\nYılmaz · ayşe yilmaz · Kayşe Yılmazlar'
    const masked = masker.mask(text)
    // Türkçe harfsiz yazım ("AYSE") da aynı ad; sözcük içi eşleşme yok. Her yazım ayrı yer tutucu alır.
    expect(masked).toBe('⟦NAME⟧ · ⟦NAME_2⟧ · ⟦NAME_3⟧ · ⟦NAME_4⟧ · ⟦NAME_5⟧ · Kayşe Yılmazlar')
    expect(masker.unmask(masked)).toBe(text)

    const ali = createMasker(buildContactMasks({ fullName: 'Ali İnce' }))
    // Türkçe dışı büyütme (ALI INCE) ve küçültme (birleşik noktalı i) de yakalanır
    const aliText = 'ALİ İNCE, ALI INCE, ali ince, ali̇ i̇nce'
    const aliMasked = ali.mask(aliText)
    expect(aliMasked).not.toMatch(/ali|ince/i)
    expect(ali.unmask(aliMasked)).toBe(aliText)
    // E-posta da büyük harfle yazılmışsa yakalanır
    const mail = createMasker(buildContactMasks({ email: 'deniz.aksoy@example.com' }))
    expect(mail.mask('DENIZ.AKSOY@EXAMPLE.COM')).toBe('⟦EMAIL⟧')
  })

  it('referansın e-posta ve telefonu yalnız istek onlarla ilgiliyse gider; değişikliği de ancak o zaman önerilir', () => {
    const cv = sampleCv()
    const refs = createSection('references', 1)
    const ref = refs.items[0]
    Object.assign(ref, { name: 'Ece Kaya', position: 'Takım Lideri', organization: 'Lacivert', email: 'ece@example.com', phone: '+90 555 111 22 33' })
    cv.sections.push(refs)

    const plain = buildEditPayload(cv, { kind: 'all' }, 'Referansları düzenle')
    const sentRef = plain.payload.sections.find((s) => s.type === 'references')!.items[0]
    // Referansın adı da maskeli gider.
    expect(sentRef).toMatchObject({ name: '⟦REFNAME⟧', position: 'Takım Lideri' })
    expect(JSON.stringify(plain.payload)).not.toContain('Ece Kaya')
    expect(sentRef).not.toHaveProperty('email')
    expect(sentRef).not.toHaveProperty('phone')
    expect(JSON.stringify(plain.payload)).not.toContain('ece@example.com')

    const ops: EditResult = {
      operations: [
        { op: 'set', target: ref.id, field: 'email', value: 'yeni@example.com' },
        { op: 'set', target: ref.id, field: 'phone', value: '+90 555 999 99 99' },
        { op: 'add', sectionId: refs.id, afterItemId: null, fields: { name: 'Yeni Kişi', email: 'uydurma@example.com' } },
      ],
    }
    const blocked = operationsToSuggestions(cv, ops, plain.unmask, plain.payload)
    expect(blocked.dropped).toBe(2)
    expect(blocked.suggestions).toHaveLength(1)
    const added = blocked.suggestions[0]
    if (added.kind !== 'addItem') throw new Error('tür')
    expect(rec(added.item).email).toBe('')

    const asked = buildEditPayload(cv, { kind: 'all' }, 'Referansların e-posta adreslerini kontrol et')
    const askedRef = asked.payload.sections.find((s) => s.type === 'references')!.items[0]
    expect(askedRef.email).toBe('ece@example.com')
    expect(askedRef).not.toHaveProperty('phone')
    const allowed = operationsToSuggestions(cv, ops, asked.unmask, asked.payload)
    expect(allowed.suggestions.map((s) => (s.kind === 'field' ? s.field : s.kind))).toEqual(['email', 'addItem'])
    expect(allowed.dropped).toBe(1)
  })

  it('kişisel bilgi boşsa maske yok', () => {
    const cv = sampleCv()
    cv.personal = { ...cv.personal, fullName: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '' }
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'x')
    expect(payload.placeholders).toEqual([])
    expect(unmask('aynı metin')).toBe('aynı metin')
  })
})

describe('payload: konum ve referans maskesi', () => {
  const summaryOf = (cv: Cv) => rec(itemsOf(cv, 'summary')[0])

  it('kişinin konumu (tamamı ve parçaları) metinlerde maskelenir; ülke tek başına ve başka şehir maskelenmez', () => {
    const cv = sampleCv() // konum: "İzmir, Türkiye"
    summaryOf(cv).content =
      "<p>İzmir, Türkiye'de yaşıyorum. IZMIR ve izmir merkezli ekiplerle, İstanbul'daki müşterilerle çalıştım. Türkiye'nin önde gelen ajanslarından birindeyim.</p>"
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'Özeti düzelt')
    const sent = payload.sections.find((s) => s.type === 'summary')!.items[0].content as string
    expect(sent).not.toMatch(/[iİı]zm[iİı]r/i)
    expect(sent).toContain("⟦LOCATION⟧'de yaşıyorum")
    expect(sent).toContain("İstanbul'daki")
    expect(sent).toContain("Türkiye'nin önde gelen")
    expect(unmask(sent)).toBe(summaryOf(cv).content)
    // Kaydın kendi konum alanı: kişinin şehriyle aynıysa maskeli, başka şehir olduğu gibi.
    const exp = payload.sections.find((s) => s.type === 'experience')!
    expect(exp.items[0].location).toMatch(/^⟦LOCATION(?:_\d+)?⟧$/)
    expect(unmask(exp.items[0].location as string)).toBe('İzmir')
    expect(exp.items[1].location).toBe('İstanbul')
    // Konum istenmedikçe kişisel bilgide de yok; hiçbir yerde açık metin olarak geçmez.
    expect(payload.personal).not.toHaveProperty('location')
    expect(payloadText(payload)).not.toMatch(/[iİı]zm[iİı]r/i)
    expect(payload.placeholders).toContain('⟦LOCATION⟧')
  })

  it('konum istendiğinde kişisel alanda özgün değeriyle gider; model yer tutucuyu yazarsa tam değer konur', () => {
    const cv = sampleCv()
    for (const type of ['experience', 'education']) for (const item of itemsOf(cv, type)) rec(item).location = ''
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'Adresimi güncelle')
    expect(payload.personal.location).toBe('İzmir, Türkiye')
    expect(unmask('⟦LOCATION⟧')).toBe('İzmir, Türkiye')
    const ops = operationsToSuggestions(cv, { operations: [{ op: 'set', target: 'personal', field: 'location', value: 'Bornova, ⟦LOCATION⟧' }] }, unmask, payload)
    expect(ops.suggestions[0]).toMatchObject({ kind: 'field', field: 'location', after: 'Bornova, İzmir, Türkiye' })
  })

  it('açık adres: sokak, ilçe, il parçaları; Türkçe harfsiz ve büyük harfli yazım da yakalanır', () => {
    const cv = sampleCv()
    cv.personal.location = 'Atatürk Cad. No:5 D:3, Kadıköy/İstanbul'
    summaryOf(cv).content = "<p>KADIKÖY'de, Kadikoy sahilinde, ATATURK CAD. NO:5 D:3 adresinde; istanbul ve İSTANBUL ofislerinde.</p>"
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'Özeti düzelt')
    const sent = payload.sections.find((s) => s.type === 'summary')!.items[0].content as string
    expect(sent).not.toMatch(/kad[iı]k[oö]y|atat[uü]rk|[iİ]stanbul/i)
    expect(unmask(sent)).toBe(summaryOf(cv).content)
    // Stajın konumu (İstanbul) artık kişinin şehri: maskeli gider, yerelde geri konur.
    const intern = payload.sections.find((s) => s.type === 'experience')!.items[1]
    expect(unmask(intern.location as string)).toBe('İstanbul')
    expect(intern.location).not.toBe('İstanbul')
  })

  it('kısa yer adı yalnız büyük harfle başlıyorsa; yalnız ülke ya da "Uzaktan" hiç maskelenmez', () => {
    const van = createMasker(buildContactMasks({ location: 'Van' }))
    expect(van.mask('Moved from Van; drove a van; VAN office')).toBe('Moved from ⟦LOCATION⟧; drove a van; ⟦LOCATION_2⟧ office')
    // Yalnız genel e-posta/telefon desenleri kalır; konum maskesi yok.
    const own = (location: string) => buildContactMasks({ location }).filter((m) => !m.generic)
    expect(own('Türkiye')).toEqual([])
    expect(own('Remote')).toEqual([])
    expect(own('Uzaktan, Türkiye')).toEqual([])
    // Ülke parçası tam değerin içinde maskelenir, tek başına değil.
    const izmir = createMasker(buildContactMasks({ location: 'İzmir, Türkiye' }))
    expect(izmir.mask('İzmir, Türkiye · Türkiye')).toBe('⟦LOCATION⟧ · Türkiye')
  })

  it('referans kişinin adı her yazımıyla (büyük harf, noktalı/noktasız i) maskelenir ve geri konur', () => {
    const cv = sampleCv()
    const refs = createSection('references', 2)
    Object.assign(refs.items[0], { name: 'Ece Kaya', position: 'Takım Lideri', email: 'ece@example.com', phone: '+90 555 111 22 33' })
    Object.assign(refs.items[1], { name: 'İpek Işık', position: 'Yönetici' })
    cv.sections.push(refs)
    summaryOf(cv).content =
      '<p>ECE KAYA ve ece kaya ile çalıştım; İPEK IŞIK, IPEK ISIK, ipek ışık, i̇pek işik bana rehberlik etti. Ulaşmak için ece@example.com ya da 0555 111 22 33.</p>'
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'Özeti düzelt')
    const sent = payload.sections.find((s) => s.type === 'summary')!.items[0].content as string
    expect(sent).not.toMatch(/ece|kaya|[iİı]pek|[iİı][sş][iİı]k|111 22 33/i)
    expect(sent).toContain('⟦REFNAME')
    expect(sent).toContain('⟦REFEMAIL⟧')
    expect(sent).toContain('⟦REFPHONE⟧')
    expect(unmask(sent)).toBe(summaryOf(cv).content)
    const sentRefs = payload.sections.find((s) => s.type === 'references')!.items
    expect(sentRefs.map((r) => unmask(r.name as string))).toEqual(['Ece Kaya', 'İpek Işık'])
    expect(sentRefs.every((r) => /^⟦REFNAME(?:_\d+)?⟧$/.test(r.name as string))).toBe(true)
    // Sözcük sınırıyla: "Beceriler" içindeki "ece" ad değildir.
    expect(payloadText(payload)).not.toMatch(/(?<!\p{L})(?:ece|kaya|[iİı]pek|[iİı][sş][iİı]k)(?!\p{L})/iu)

    // Yanıttaki yer tutucular geri konur; birden çok referans olduğu için bilinmeyen REFNAME geri konamaz → atılır.
    const ref = refs.items[0]
    const nameTag = sentRefs[0].name as string
    const result = operationsToSuggestions(
      cv,
      {
        operations: [
          { op: 'set', target: ref.id, field: 'position', value: `Kıdemli Takım Lideri (${nameTag} ekibi)` },
          { op: 'set', target: itemsOf(cv, 'summary')[0].id, field: 'content', value: '<p>⟦REFNAME_9⟧ ile çalıştım.</p>' },
        ],
      },
      unmask,
      payload,
    )
    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0]).toMatchObject({ field: 'position', after: 'Kıdemli Takım Lideri (Ece Kaya ekibi)' })
    expect(result.dropped).toBe(1)
  })

  it('kişinin adı büyük harf ve noktalı/noktasız i farkıyla maskelenir (düzenleme)', () => {
    const cv = sampleCv()
    cv.personal.fullName = 'Ayşe Yılmaz'
    summaryOf(cv).content = '<p>AYŞE YILMAZ · Ayşe YILMAZ · ayşe yilmaz · AYŞE YİLMAZ · ayşe yi̇lmaz</p>'
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'AYŞE YILMAZ adını özette kullanma')
    const sent = payload.sections.find((s) => s.type === 'summary')!.items[0].content as string
    expect(sent).not.toMatch(/ay[sş]e|y[iİı]̇?lmaz/i)
    expect(payload.prompt).toBe('⟦NAME⟧ adını özette kullanma')
    expect(unmask(sent)).toBe(summaryOf(cv).content)
  })
})

describe('doğrulama', () => {
  it('geçerli yanıtı (nesne ya da kod bloğundaki JSON) kabul eder', () => {
    const ok = { operations: [{ op: 'set', target: 'a', field: 'b', value: 'c' }] }
    expect(parseEditResult(ok).operations).toHaveLength(1)
    expect(parseEditResult('```json\n' + JSON.stringify(ok) + '\n```').operations).toHaveLength(1)
  })

  it('bozuk biçimi AiError(invalid_response) ile reddeder', () => {
    const bad: unknown[] = [
      null,
      'düz metin',
      { operations: 'yok' },
      { operations: [{ op: 'rename', target: 'a' }] },
      { operations: [{ op: 'set', target: 'a', field: 'b', value: 3 }] },
      { operations: [{ op: 'add', sectionId: 's', fields: {} }] },
      { operations: Array.from({ length: 41 }, () => ({ op: 'remove', sectionId: 's', itemId: 'i' })) },
    ]
    for (const raw of bad) {
      expect(() => parseEditResult(raw)).toThrow(AiError)
      try {
        parseEditResult(raw)
      } catch (error) {
        expect((error as AiError).code).toBe('invalid_response')
      }
    }
  })

  it('çeviri ve içe aktarma yanıtları da doğrulanır', () => {
    expect(parseTranslateResult({ items: [{ key: 'k', text: 't' }] }).items).toHaveLength(1)
    expect(() => parseTranslateResult({ items: [{ key: 'k' }] })).toThrow(AiError)
    expect(parseImportResult({ sections: [] }).personal).toEqual({})
    expect(() => parseImportResult({ sections: [{ type: 'hobiler', items: [] }] })).toThrow(AiError)
  })
})

describe('işlemler → öneriler', () => {
  const run = (cv: Cv, result: EditResult, scope: Parameters<typeof buildEditPayload>[1] = { kind: 'all' }, prompt = 'x') => {
    const { payload, unmask } = buildEditPayload(cv, scope, prompt)
    return operationsToSuggestions(cv, result, unmask, payload)
  }

  it('geçerli alan önerisi: zengin metin süzülür, yer tutucu geri konur', () => {
    const cv = sampleCv()
    const item = itemsOf(cv, 'experience')[0]
    // İstek e-postayla ilgili: metinde geçmeyen ⟦EMAIL⟧ kişisel bilgideki değerle doldurulur.
    const { suggestions, dropped } = run(cv, {
      operations: [
        {
          op: 'set',
          target: item.id,
          field: 'description',
          value: '<ul><li>Yeni <script>alert(1)</script><b>madde</b> ⟦EMAIL⟧</li></ul>',
          reason: 'Daha net',
        },
      ],
    }, { kind: 'all' }, 'E-posta adresimi deneyime ekle')
    expect(dropped).toBe(0)
    expect(suggestions).toHaveLength(1)
    const s = suggestions[0]
    if (s.kind !== 'field') throw new Error('tür')
    expect(s.after).toBe('<ul><li>Yeni madde deniz.aksoy@example.com</li></ul>')
    expect(s.before).toBe(rec(item).description)
    expect(s).toMatchObject({ rich: true, note: 'Daha net', sectionId: sectionOf(cv, 'experience').id })
  })

  it('düz metinden etiket atılır; değişiklik yaratmayan işlem öneri olmaz', () => {
    const cv = sampleCv()
    const item = itemsOf(cv, 'experience')[0]
    const { suggestions, dropped } = run(cv, {
      operations: [
        { op: 'set', target: item.id, field: 'position', value: '<b>Kıdemli</b> Frontend Geliştirici' },
        { op: 'set', target: item.id, field: 'company', value: 'Lacivert Yazılım' },
      ],
    })
    expect(dropped).toBe(0)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({ kind: 'field', field: 'position', after: 'Kıdemli Frontend Geliştirici' })
  })

  it('kapsam dışı, olmayan hedef, yasak alan ve geri konamayan yer tutucu atılır', () => {
    const cv = sampleCv()
    const exp = sectionOf(cv, 'experience')
    const target = itemsOf(cv, 'experience')[0]
    const other = itemsOf(cv, 'experience')[1]
    const { suggestions, dropped } = run(
      cv,
      {
        operations: [
          { op: 'set', target: other.id, field: 'position', value: 'Kapsam dışı' },
          { op: 'set', target: 'yok', field: 'position', value: 'x' },
          { op: 'set', target: target.id, field: 'dates', value: '2020' },
          { op: 'set', target: target.id, field: 'id', value: 'yeni-id' },
          { op: 'set', target: target.id, field: 'position', value: '⟦SAHTE⟧ Geliştirici' },
          { op: 'set', target: 'personal', field: 'headline', value: 'Kayıt kapsamında unvan' },
          { op: 'set', target: 'personal', field: 'fullName', value: 'Başka Ad' },
          { op: 'set', target: 'personal', field: 'email', value: 'a@b.co' },
          { op: 'add', sectionId: exp.id, afterItemId: null, fields: { position: 'Yeni' } },
          { op: 'remove', sectionId: exp.id, itemId: other.id },
        ],
      },
      { kind: 'item', sectionId: exp.id, itemId: target.id },
    )
    expect(suggestions).toEqual([])
    expect(dropped).toBe(10)
  })

  it('unvan Tüm CV kapsamında, iletişim alanı yalnız gönderildiyse önerilir', () => {
    const cv = sampleCv()
    const ops: EditResult = {
      operations: [
        { op: 'set', target: 'personal', field: 'headline', value: 'Kıdemli Frontend Geliştirici' },
        { op: 'set', target: 'personal', field: 'email', value: 'deniz@example.com' },
      ],
    }
    expect(run(cv, ops).suggestions.map((s) => s.kind === 'field' && s.field)).toEqual(['headline'])
    expect(run(cv, ops, { kind: 'all' }, 'e-posta adresimi değiştir').suggestions).toHaveLength(2)
  })

  it('aynı alana ikinci işlem ve aynı kayda ikinci kaldırma atılır', () => {
    const cv = sampleCv()
    const exp = sectionOf(cv, 'experience')
    const item = itemsOf(cv, 'experience')[0]
    const { suggestions, dropped } = run(cv, {
      operations: [
        { op: 'set', target: item.id, field: 'position', value: 'A' },
        { op: 'set', target: item.id, field: 'position', value: 'B' },
        { op: 'remove', sectionId: exp.id, itemId: itemsOf(cv, 'experience')[2].id },
        { op: 'remove', sectionId: exp.id, itemId: itemsOf(cv, 'experience')[2].id },
      ],
    })
    expect(suggestions).toHaveLength(2)
    expect(dropped).toBe(2)
  })

  it('ekleme: yalnız izinli metin alanları dolar, boş kayıt atılır, olmayan konum sona düşer', () => {
    const cv = sampleCv()
    const skills = sectionOf(cv, 'skills')
    const { suggestions, dropped } = run(cv, {
      operations: [
        {
          op: 'add',
          sectionId: skills.id,
          afterItemId: itemsOf(cv, 'skills')[0].id,
          fields: { name: 'Bulut', keywords: 'AWS, ⟦GITHUB⟧', id: 'sahte', hidden: 'true' },
        },
        { op: 'add', sectionId: skills.id, afterItemId: 'yok', fields: { name: 'Test' } },
        { op: 'add', sectionId: skills.id, afterItemId: null, fields: { bilinmeyen: 'x' } },
        { op: 'add', sectionId: sectionOf(cv, 'summary').id, afterItemId: null, fields: { content: '<p>İkinci özet</p>' } },
      ],
    })
    expect(dropped).toBe(2)
    expect(suggestions).toHaveLength(2)
    const [first, second] = suggestions
    if (first.kind !== 'addItem' || second.kind !== 'addItem') throw new Error('tür')
    expect(first.afterItemId).toBe(itemsOf(cv, 'skills')[0].id)
    expect(first.item).toMatchObject({ name: 'Bulut', keywords: 'AWS, github.com/deniz-aksoy-ornek', hidden: false })
    expect(first.item.id).not.toBe('sahte')
    expect(first.item.translationGroupId).toBeTruthy()
    expect(second.afterItemId).toBeNull()
  })

  it('kaldırma: kayıt anlık görüntüsü tutulur; aynı kayda alan önerisi kaldırmayla birlikte atılır', () => {
    const cv = sampleCv()
    const exp = sectionOf(cv, 'experience')
    const item = itemsOf(cv, 'experience')[2]
    const { suggestions, dropped } = run(cv, {
      operations: [
        { op: 'set', target: item.id, field: 'position', value: 'Yeni' },
        { op: 'remove', sectionId: exp.id, itemId: item.id, reason: 'Eski' },
      ],
    })
    expect(dropped).toBe(1)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({ kind: 'removeItem', itemId: item.id, snapshot: JSON.stringify(item), note: 'Eski' })
  })
})

describe('örnek sağlayıcı', () => {
  it('istekte geçen bölüme odaklanır (deneyim → özet değil)', () => {
    const cv = sampleCv()
    const { payload } = buildEditPayload(cv, { kind: 'all' }, 'Deneyim maddelerini daha ölçülebilir yaz')
    const result = mockEdit(payload)
    const expIds = new Set(itemsOf(cv, 'experience').map((i) => i.id))
    expect(result.operations.length).toBeGreaterThan(0)
    expect(result.operations.every((o) => o.op === 'set' && expIds.has(o.target))).toBe(true)
  })

  it('istekte bölüm yoksa ve düzeltilecek bir şey yoksa özete örnek öneri', () => {
    const { payload } = buildEditPayload(sampleCv(), { kind: 'all' }, 'Daha iyi yap')
    const ops = mockEdit(payload).operations
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ op: 'set', field: 'content' })
  })

  it('"ekle" ve "sil" isteklerine örnek ekleme ve kaldırma', () => {
    const cv = sampleCv()
    const { payload, unmask } = buildEditPayload(cv, { kind: 'all' }, 'Becerilere yeni bir grup ekle, son grubu sil')
    const result = mockEdit(payload)
    expect(result.operations.map((o) => o.op).sort()).toEqual(['add', 'remove'])
    const { suggestions, dropped } = operationsToSuggestions(cv, parseEditResult(result), unmask, payload)
    expect(dropped).toBe(0)
    expect(suggestions.map((s) => s.kind).sort()).toEqual(['addItem', 'removeItem'])
  })

  it('iptal edilince AiError(aborted) ile reddeder', async () => {
    const controller = new AbortController()
    const { payload } = buildEditPayload(sampleCv(), { kind: 'all' }, 'x')
    const pending = mockProvider.edit(payload, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'aborted', name: 'AbortError' })
  })
})
