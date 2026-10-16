import { describe, expect, it } from 'vitest'
import { createCv, createSection } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import { CvSchema, type AnyItem, type Cv } from '@/cv/schema'
import { templateSettingsFor } from '@/render/templates'
import { mockTranslate, translateText } from './mockTranslate'
import {
  applyToItem,
  buildTranslateRequest,
  collectCvTexts,
  collectItemTexts,
  createTranslatedCv,
  itemKey,
  mergeTranslations,
  personalKey,
  sectionTitleKey,
  suggestTranslatedName,
} from './translate'

function sampleCv(): Cv {
  const sections = sampleSections('tr')
  const custom = createSection('custom', 1)
  custom.title = 'Yayınlar'
  Object.assign(custom.items[0], { title: 'Erişilebilir Formlar', url: 'example.com/yazi', subtitle: 'Blog yazısı' })
  sections.push(custom)
  // Varsayılan başlıkla aynı özel başlık çevrilmez; hedefte otomatik başlığa döner
  sections[1].title = 'Deneyim'
  return createCv({
    name: 'Genel TR',
    language: 'tr',
    templateId: 'modern',
    template: templateSettingsFor('modern', sections),
    personal: samplePersonal('tr'),
    sections,
  })
}

const byType = (cv: Cv, type: string) => cv.sections.find((s) => s.type === type)!
const items = (cv: Cv, type: string) => byType(cv, type).items as unknown as Record<string, string>[]

describe('örnek çevirmen', () => {
  it('sözlükteki kalıpları çevirir, uzun kalıbı önce dener', () => {
    expect(translateText('Yazılım Geliştirici', 'tr', 'en')).toBe('Software Developer')
    expect(translateText('Frontend Geliştirici', 'tr', 'en')).toBe('Frontend Developer')
    expect(translateText('Yüksek Lisans', 'tr', 'en')).toBe("Master's degree")
    expect(translateText('Lisans', 'tr', 'en')).toBe("Bachelor's degree")
    expect(translateText('İleri (C1)', 'tr', 'en')).toBe('Advanced (C1)')
    expect(translateText('Ana dil', 'tr', 'en')).toBe('Native')
    expect(translateText("Bachelor's degree", 'en', 'tr')).toBe('Lisans')
    expect(translateText('Software Intern', 'en', 'tr')).toBe('Yazılım Stajyeri')
    expect(translateText('Intern', 'en', 'tr')).toBe('Stajyer')
  })

  it('Türkçe İ/ı ve büyük-küçük harf biçimini korur', () => {
    expect(translateText('İngilizce', 'tr', 'en')).toBe('English')
    expect(translateText('İNGİLİZCE', 'tr', 'en')).toBe('ENGLISH')
    expect(translateText('Ingilizce', 'tr', 'en')).toBe('English')
    expect(translateText('ingilizce ve almanca', 'tr', 'en')).toBe('English ve German')
    expect(translateText('yazılım geliştirici', 'tr', 'en')).toBe('software developer')
    expect(translateText('ENGLISH', 'en', 'tr')).toBe('İNGİLİZCE')
    expect(translateText('Advanced', 'en', 'tr')).toBe('İleri')
  })

  it('kelimenin parçasını çevirmez, sözlükte olmayanı bırakır', () => {
    expect(translateText('Lisansüstü', 'tr', 'en')).toBe('Lisansüstü')
    expect(translateText('Interns', 'en', 'tr')).toBe('Interns')
  })

  it('HTML etiketlerine ve özniteliklerine dokunmaz', () => {
    const html = '<ul><li><a href="https://example.com/Stajyer">Stajyer</a> &amp; <strong>Geliştirici</strong></li></ul>'
    expect(translateText(html, 'tr', 'en')).toBe(
      '<ul><li><a href="https://example.com/Stajyer">Intern</a> &amp; <strong>Developer</strong></li></ul>',
    )
    expect(translateText('<p title="Lisans">x</p>', 'tr', 'en')).toBe('<p title="Lisans">x</p>')
  })

  it('istekteki her anahtarı döndürür', () => {
    const result = mockTranslate({ from: 'tr', to: 'en', items: [{ key: 'a', text: 'Araçlar', rich: false }] })
    expect(result.items).toEqual([{ key: 'a', text: 'Tools' }])
  })
})

describe('çevrilecek metinleri toplama', () => {
  it('yalnız çevrilebilir alanları toplar', () => {
    const cv = sampleCv()
    const entries = collectCvTexts(cv)
    const keys = new Set(entries.map((e) => e.key))
    const exp = byType(cv, 'experience').items[0]
    expect(keys.has(personalKey('headline'))).toBe(true)
    expect(keys.has(itemKey(exp.id, 'position'))).toBe(true)
    expect(keys.has(itemKey(exp.id, 'description'))).toBe(true)
    expect(keys.has(itemKey(exp.id, 'company'))).toBe(false)
    expect(entries.some((e) => e.field === 'keywords' || e.field === 'url' || e.field === 'email')).toBe(false)
    // Ad, e-posta gibi kişisel alanlar gitmez
    expect(entries.some((e) => e.text === cv.personal.fullName || e.text === cv.personal.email)).toBe(false)
    // Proje ve sertifika adları çevrilmez
    expect(entries.some((e) => e.text === 'Rota')).toBe(false)
    // Boş alanlar gitmez
    expect(entries.every((e) => e.text.trim() !== '')).toBe(true)
    expect(entries.find((e) => e.key === itemKey(exp.id, 'description'))?.rich).toBe(true)
  })

  it('özel bölüm başlığını toplar; varsayılanla aynı başlığı ve otomatik başlığı toplamaz', () => {
    const cv = sampleCv()
    const keys = collectCvTexts(cv).map((e) => e.key)
    expect(keys).toContain(sectionTitleKey(byType(cv, 'custom').id))
    expect(keys).not.toContain(sectionTitleKey(byType(cv, 'experience').id))
    expect(keys).not.toContain(sectionTitleKey(byType(cv, 'education').id))
  })

  it('tek kayıt için anahtarları kayıt id + alanla kurar', () => {
    const cv = sampleCv()
    const section = byType(cv, 'languages')
    const item = section.items[0] as AnyItem
    const entries = collectItemTexts(section.id, 'languages', item)
    expect(entries.map((e) => e.key)).toEqual([itemKey(item.id, 'name'), itemKey(item.id, 'level')])
  })
})

describe('çeviriyi uygulama', () => {
  function translate(cv: Cv) {
    const entries = collectCvTexts(cv)
    const prepared = buildTranslateRequest('tr', 'en', entries, cv.personal)
    const merged = mergeTranslations(entries, mockTranslate(prepared.request), prepared)
    return Object.fromEntries(merged.map((e) => [e.key, e.translated]))
  }

  it('yeni İngilizce CV kurar; kaynak değişmez, bağ korunur', () => {
    const cv = sampleCv()
    const before = JSON.stringify(cv)
    const values = translate(cv)
    values[sectionTitleKey(byType(cv, 'custom').id)] = 'Publications'
    const en = createTranslatedCv(cv, values, { name: 'Genel EN', language: 'en' })

    expect(JSON.stringify(cv)).toBe(before)
    expect(CvSchema.safeParse(en).success).toBe(true)
    expect(en.id).not.toBe(cv.id)
    expect(en.language).toBe('en')
    expect(en.name).toBe('Genel EN')
    expect(en.templateId).toBe(cv.templateId)
    expect(en.template.accentColor).toBe(cv.template.accentColor)
    expect(en.personal.headline).toBe('Frontend Developer')
    expect(en.personal.fullName).toBe(cv.personal.fullName)

    const exp = items(en, 'experience')
    expect(exp[1].position).toBe('Software Intern')
    expect(exp[1].company).toBe('Martı Teknoloji')
    expect(items(en, 'education')[0].degree).toBe("Bachelor's degree")
    expect(items(en, 'education')[0].field).toBe('Computer Engineering')
    expect(items(en, 'skills')[2].name).toBe('Tools')
    expect(items(en, 'skills')[2].keywords).toBe('Git, Playwright, Vitest, Figma')
    expect(items(en, 'languages')[0]).toMatchObject({ name: 'Turkish', level: 'Native' })
    expect(exp[0].description).toContain('<ul><li>')
    expect(exp[0].description).toContain('<strong>%38</strong>')

    // Başlıklar: varsayılanla aynı olan otomatiğe döner, özel başlık çevrilir
    expect(byType(en, 'experience').title).toBeNull()
    expect(byType(en, 'custom').title).toBe('Publications')

    // Kayıt id'leri yeni, çeviri grubu aynı; yan sütun yeni bölüm id'lerine eşlenir
    const srcItem = byType(cv, 'experience').items[0]
    const newItem = byType(en, 'experience').items[0]
    expect(newItem.id).not.toBe(srcItem.id)
    expect(newItem.translationGroupId).toBe(srcItem.translationGroupId)
    const sideIds = new Set(en.sections.map((s) => s.id))
    expect(en.template.sideSections.every((id) => sideIds.has(id))).toBe(true)
  })

  it('eksik anahtarda kaynak metin kalır ve işaretlenir; bozuk yanıt reddedilir', () => {
    const cv = sampleCv()
    const entries = collectCvTexts(cv).slice(0, 2)
    const prepared = buildTranslateRequest('tr', 'en', entries, cv.personal)
    const merged = mergeTranslations(entries, { items: [{ key: entries[0].key, text: 'X' }, { key: 'yok', text: 'Y' }] }, prepared)
    expect(merged[0]).toMatchObject({ translated: 'X', missing: false, unrestored: false })
    expect(merged[1]).toMatchObject({ translated: entries[1].text, missing: true, unrestored: false })
    expect(() => mergeTranslations(entries, { items: [{ key: 1 }] } as never, prepared)).toThrow()
  })

  it('zengin metin yanıtı süzülür', () => {
    const cv = sampleCv()
    const entry = collectCvTexts(cv).find((e) => e.rich)!
    const prepared = buildTranslateRequest('tr', 'en', [entry], cv.personal)
    const [merged] = mergeTranslations([entry], { items: [{ key: entry.key, text: '<p>Hi<script>x()</script></p>' }] }, prepared)
    expect(merged.translated).toBe('<p>Hi</p>')
  })

  it('kaydı çevirir, kimliklere dokunmaz', () => {
    const cv = sampleCv()
    const item = byType(cv, 'experience').items[1]
    const translated = applyToItem(item, { [itemKey(item.id, 'position')]: 'Software Intern' })
    expect(translated).toMatchObject({ id: item.id, translationGroupId: item.translationGroupId, position: 'Software Intern', company: 'Martı Teknoloji' })
    expect((item as Record<string, unknown>).position).toBe('Yazılım Stajyeri')
  })
})

describe('çeviri gizliliği', () => {
  const summaryOf = (cv: Cv) => byType(cv, 'summary').items[0] as unknown as Record<string, string>

  it('metindeki ad ve iletişim bilgileri maskelenir, yanıtta geri konur', () => {
    const cv = sampleCv()
    summaryOf(cv).content =
      '<p>DENİZ AKSOY olarak çalışıyorum. Yaz: <a href="mailto:deniz.aksoy@example.com">deniz.aksoy@example.com</a>, ara: 0555 000 00 00. github.com/deniz-aksoy-ornek</p>'
    const entries = collectCvTexts(cv)
    const prepared = buildTranslateRequest('tr', 'en', entries, cv.personal)
    const sent = JSON.stringify(prepared.request)
    expect(sent).not.toMatch(/deniz|aksoy|555 000/i)
    const key = itemKey(byType(cv, 'summary').items[0].id, 'content')
    expect(prepared.request.items.find((i) => i.key === key)!.text).toContain('⟦NAME⟧')

    const merged = mergeTranslations(entries, mockTranslate(prepared.request), prepared)
    const summary = merged.find((e) => e.key === key)!
    expect(summary).toMatchObject({ missing: false, unrestored: false })
    expect(summary.translated).toContain('DENİZ AKSOY')
    expect(summary.translated).toContain('href="mailto:deniz.aksoy@example.com"')
    expect(summary.translated).toContain('0555 000 00 00')
    expect(summary.translated).toContain('github.com/deniz-aksoy-ornek')
  })

  it('yer tutucu kaybolur ya da uydurulursa kaynak metin kalır ve işaretlenir', () => {
    const cv = sampleCv()
    summaryOf(cv).content = '<p>Deniz Aksoy, deniz.aksoy@example.com</p>'
    const entries = collectCvTexts(cv)
    const key = itemKey(byType(cv, 'summary').items[0].id, 'content')
    const entry = entries.filter((e) => e.key === key)
    const prepared = buildTranslateRequest('tr', 'en', entry, cv.personal)
    const lost = mergeTranslations(entry, { items: [{ key, text: '<p>⟦NAME⟧ here</p>' }] }, prepared)[0]
    expect(lost).toMatchObject({ translated: entry[0].text, missing: true, unrestored: true })
    const invented = mergeTranslations(entry, { items: [{ key, text: '<p>⟦NAME⟧, ⟦EMAIL⟧, ⟦PHONE⟧</p>' }] }, prepared)[0]
    expect(invented).toMatchObject({ translated: entry[0].text, unrestored: true })
    const bogus = mergeTranslations(entry, { items: [{ key, text: '<p>⟦NAME⟧, ⟦EMAIL⟧ ⟦FOO⟧</p>' }] }, prepared)[0]
    expect(bogus.unrestored).toBe(true)
    const ok = mergeTranslations(entry, { items: [{ key, text: '<p>⟦EMAIL⟧ — ⟦NAME⟧</p>' }] }, prepared)[0]
    expect(ok).toMatchObject({ translated: '<p>deniz.aksoy@example.com — Deniz Aksoy</p>', unrestored: false })
  })

  it("gizli bölüm ve kayıtlar gönderilmez; yeni CV'ye olduğu gibi kopyalanır", () => {
    const cv = sampleCv()
    const hiddenItem = byType(cv, 'experience').items[1] as AnyItem
    hiddenItem.hidden = true
    const custom = byType(cv, 'custom')
    custom.hidden = true
    const entries = collectCvTexts(cv)
    expect(entries.some((e) => e.itemId === hiddenItem.id)).toBe(false)
    expect(entries.some((e) => e.sectionId === custom.id)).toBe(false)
    const prepared = buildTranslateRequest('tr', 'en', entries, cv.personal)
    const values = Object.fromEntries(mergeTranslations(entries, mockTranslate(prepared.request), prepared).map((e) => [e.key, e.translated]))
    const en = createTranslatedCv(cv, values, { name: 'Genel EN', language: 'en' })
    const copied = byType(en, 'experience').items[1] as AnyItem
    expect(copied).toMatchObject({ hidden: true, position: 'Yazılım Stajyeri', translationGroupId: hiddenItem.translationGroupId })
    expect(byType(en, 'custom')).toMatchObject({ hidden: true, title: 'Yayınlar' })
    expect((byType(en, 'experience').items[0] as unknown as Record<string, string>).position).toBe('Frontend Developer')
  })

  it('referansın e-posta ve telefonu çeviriye hiç girmez', () => {
    const cv = sampleCv()
    const refs = createSection('references', 1)
    Object.assign(refs.items[0], { name: 'Ece Kaya', position: 'Takım lideri', email: 'ece@example.com', phone: '+90 555 111 22 33' })
    cv.sections.push(refs)
    const entries = collectCvTexts(cv).filter((e) => e.sectionId === refs.id)
    expect(entries.map((e) => e.field)).toEqual(['position'])
    const sent = JSON.stringify(buildTranslateRequest('tr', 'en', entries, cv.personal).request)
    expect(sent).not.toContain('ece@example.com')
    expect(sent).not.toContain('111 22 33')
  })
})

describe('çeviri CV adı', () => {
  it('dil ekini değiştirir ya da ekler', () => {
    expect(suggestTranslatedName('Genel TR', 'en')).toBe('Genel EN')
    expect(suggestTranslatedName('Genel (tr)', 'en')).toBe('Genel (EN)')
    expect(suggestTranslatedName('Backend EN', 'tr')).toBe('Backend TR')
    expect(suggestTranslatedName('Staj başvurusu', 'en')).toBe('Staj başvurusu EN')
    expect(suggestTranslatedName('Centre', 'en')).toBe('Centre EN')
  })
})
