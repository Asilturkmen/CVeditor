import { describe, expect, it } from 'vitest'
import { importResultToCv, parseImportDate, toRichText } from './importConvert'
import { findDates, headingOf, heuristicImport, looksLikeName } from './importHeuristics'
import {
  completeImportResult,
  detectLanguage,
  extractContacts,
  maskContacts,
  maskName,
  unmaskImportResult,
  unmaskText,
} from './importText'
import { buildPageLines, largestLine, type RawTextItem } from './pdfText'
import type { ImportResult } from './types'

// Testlerdeki kişiler ve kurumlar uydurmadır.

const TR_CV = `Ece Yıldırım
Kıdemli Frontend Geliştirici
İstanbul, Türkiye · ece.yildirim@example.com · +90 532 000 12 34 · linkedin.com/in/ece-yildirim-ornek ·
github.com/eceornek
ÖZET
Erişilebilir ve hızlı web arayüzleri geliştiren, 6 yıllık deneyime sahip bir frontend geliştiriciyim. Tasarım
sistemleri kurmayı ve ekip içinde bilgi paylaşmayı seviyorum.
İŞ DENEYİMİ
Kıdemli Frontend Geliştirici   Şub 2022 – Günümüz
Örnek Teknoloji A.Ş. · İstanbul
• React ve TypeScript ile müşteri paneli yeniden yazıldı; sayfa açılış süresi %40 kısaldı ve destek
• talepleri belirgin şekilde azaldı.
• Ortak bileşen kütüphanesi kurdum; 4 ekip aynı tasarım sistemini kullanıyor.
Frontend Geliştirici   Haz 2019 – Oca 2022
Deneme Yazılım Ltd. · Ankara
• Vue ile e-ticaret vitrini geliştirdim.
• Birim test kapsamını %20'den %75'e çıkardım.
EĞİTİM
Orta Anadolu Üniversitesi   2015 – 2019
Lisans, Bilgisayar Mühendisliği
Not ortalaması: 3,4/4
BECERİLER
Diller: TypeScript, JavaScript, Python
Çatılar: React, Vue, Node.js
Araçlar: Git, Docker, Figma
DİLLER
Türkçe — Ana dil
İngilizce — İleri (C1)
SERTİFİKALAR
AWS Certified Cloud Practitioner – Amazon Web Services, 2023`

/** Canva benzeri iki sütun: yan sütun (iletişim, beceriler, diller) akışta önce geliyor. */
const EN_CANVA = `CONTACT
alex.morgan@example.com
+44 20 7946 0958
London, United Kingdom
linkedin.com/in/alex-morgan-
sample
SKILLS
Languages: Go, TypeScript,
SQL
Cloud: AWS, Terraform,
Kubernetes
LANGUAGES
English (Native)
German (B2)
Alex Morgan
Backend Engineer
PROFILE
Backend engineer with 7 years of experience building reliable payment and data
services. I care about clear APIs and the people who maintain them.
WORK EXPERIENCE
Senior Backend Engineer
Sample Payments Ltd | London
Jan 2021 – Present
Designed an idempotent payment API that handles 3 million requests per day.
Software Engineer
Example Analytics GmbH | Berlin
03/2017 – 12/2020
• Built the ingestion pipeline for event data.
• Mentored two junior engineers.
EDUCATION
University of Northfield
BSc Computer Science
2013 – 2016`

const section = (r: ImportResult, type: string) => r.sections.find((s) => s.type === type)

describe('bölüm başlıkları', () => {
  it('Türkçe büyük harf, harf aralıklı ve eş anlamlı başlıkları tanır', () => {
    expect(headingOf('DENEYİM')?.kind).toBe('experience')
    expect(headingOf('İŞ DENEYİMİ')?.kind).toBe('experience')
    expect(headingOf('İş Deneyimi:')?.kind).toBe('experience')
    expect(headingOf('D E N E Y İ M')?.kind).toBe('experience')
    expect(headingOf('WORK EXPERIENCE')?.kind).toBe('experience')
    expect(headingOf('EĞİTİM')?.kind).toBe('education')
    expect(headingOf('YETENEKLER')?.kind).toBe('skills')
    expect(headingOf('Sertifikalar ve Kurslar')?.kind).toBe('certificates')
    expect(headingOf('Licenses & Certifications')?.kind).toBe('certificates')
    expect(headingOf('HAKKIMDA')?.kind).toBe('summary')
    expect(headingOf('GÖNÜLLÜLÜK')?.kind).toBe('volunteer')
    expect(headingOf('REFERANSLAR')?.kind).toBe('references')
    expect(headingOf('ÖDÜLLER')?.kind).toBe('awards')
    expect(headingOf('Stajlar')).toEqual({ kind: 'experience', keepTitle: true })
    expect(headingOf('HOBİLER')).toEqual({ kind: 'custom', keepTitle: true })
  })

  it('başlığa benzeyen içerik satırlarını başlık saymaz', () => {
    expect(headingOf('Deneyim tasarımı üzerine çalıştım')).toBeNull()
    expect(headingOf('Languages: Go, TypeScript')).toBeNull()
    expect(headingOf('Eğitim 2015 – 2019')).toBeNull()
  })
})

describe('tarihler', () => {
  it.each([
    ['Şub 2024 – Günümüz', '2024-02', 'present'],
    ['2019 - 2023', '2019', '2023'],
    ['01/2020 – 06/2021', '2020-01', '2021-06'],
    ['Jan 2024 – Present', '2024-01', 'present'],
    ['Eylül 2018 - Haziran 2019', '2018-09', '2019-06'],
    ['2020.03 – 2021.11', '2020-03', '2021-11'],
    ['Sept. 2015 to May 2019', '2015-09', '2019-05'],
    ['Haziran 2019 - Halen', '2019-06', 'present'],
  ])('%s', (line, start, end) => {
    expect(findDates(line)).toMatchObject({ start, end, rest: '' })
  })

  it('satırdaki unvanı tarihten ayırır', () => {
    expect(findDates('Kıdemli Geliştirici   Şub 2022 – Günümüz')).toEqual({
      start: '2022-02',
      end: 'present',
      rest: 'Kıdemli Geliştirici',
    })
    expect(findDates('AWS Certified – Amazon, 2023')).toMatchObject({ start: '2023', rest: 'AWS Certified – Amazon' })
  })

  it('cümle içindeki yılı tarih saymaz', () => {
    expect(findDates('2023 yılında ekibi 4 kişiden 12 kişiye büyüttüm ve yeni ürünü yayınladım')).toBeNull()
    expect(findDates('Since moving to Go in 2019 our latency dropped significantly over the years')).toBeNull()
  })

  it('içe aktarma tarihini modele çevirir', () => {
    expect(parseImportDate('2024-02')).toEqual({ year: 2024, month: 2 })
    expect(parseImportDate('2019')).toEqual({ year: 2019, month: null })
    expect(parseImportDate('06/2021')).toEqual({ year: 2021, month: 6 })
    expect(parseImportDate('Şub 2024')).toEqual({ year: 2024, month: 2 })
    expect(parseImportDate('Present')).toBe('present')
    expect(parseImportDate('günümüz')).toBe('present')
    expect(parseImportDate('2024-13')).toBeNull()
    expect(parseImportDate('')).toBeNull()
  })
})

describe('iletişim bilgileri', () => {
  it('TR CV başlığından iletişim bilgilerini çıkarır', () => {
    expect(extractContacts(TR_CV)).toEqual({
      email: 'ece.yildirim@example.com',
      phone: '+90 532 000 12 34',
      linkedin: 'linkedin.com/in/ece-yildirim-ornek',
      github: 'github.com/eceornek',
      location: 'İstanbul, Türkiye',
    })
  })

  it('satır sonunda bölünmüş LinkedIn adresini birleştirir', () => {
    const c = extractContacts(EN_CANVA)
    expect(c.linkedin).toBe('linkedin.com/in/alex-morgan-sample')
    expect(c.phone).toBe('+44 20 7946 0958')
    expect(c.location).toBe('London, United Kingdom')
  })

  it.each([
    ['Tel: 0532 123 45 67', '0532 123 45 67'],
    ['GSM (0532) 123-45-67', '(0532) 123-45-67'],
    ['+90-532-123-4567', '+90-532-123-4567'],
    ['Phone: +1 (415) 555-0132', '+1 (415) 555-0132'],
    ['5321234567', '5321234567'],
  ])('telefon: %s', (text, phone) => {
    expect(extractContacts(text).phone).toBe(phone)
  })

  it('tarih aralıklarını telefon sanmaz', () => {
    expect(extractContacts('01/2020 – 06/2021\n2015 2016 2017 2018').phone).toBeUndefined()
  })

  it('web sitesine LinkedIn, GitHub ve e-posta alan adını almaz', () => {
    const c = extractContacts('Ada Kaya\nada@kaya.example.com · github.com/adakaya · https://www.adakaya.dev/')
    expect(c.website).toBe('adakaya.dev')
    expect(extractContacts('Ada Kaya\nada@example.com · linkedin.com/in/ada').website).toBeUndefined()
  })

  it('proje bağlantısını kişisel site saymaz', () => {
    const lines = ['Ada Kaya', 'ada@example.com', ...Array.from({ length: 14 }, (_, i) => `Satır ${i}`), 'Proje: acme-demo.com']
    expect(extractContacts(lines.join('\n')).website).toBeUndefined()
  })

  it('etiketli LinkedIn kullanıcı adını adrese çevirir', () => {
    expect(extractContacts('LinkedIn: ada-kaya').linkedin).toBe('linkedin.com/in/ada-kaya')
  })
})

describe('dil algılama', () => {
  it('Türkçe ve İngilizce CV metnini ayırır', () => {
    expect(detectLanguage(TR_CV)).toMatchObject({ language: 'tr' })
    expect(detectLanguage(TR_CV).confidence).toBeGreaterThan(0.8)
    expect(detectLanguage(EN_CANVA)).toMatchObject({ language: 'en' })
    expect(detectLanguage(EN_CANVA).confidence).toBeGreaterThan(0.8)
  })

  it('İngilizce metindeki Türkçe özel adlar dili değiştirmez', () => {
    const text = 'Software Engineer at Örnek Teknoloji in İstanbul. I built the payments platform and led the migration to Go with the team.'
    expect(detectLanguage(text).language).toBe('en')
  })

  it('çok kısa metinde güven düşük', () => {
    expect(detectLanguage('Ada Kaya').confidence).toBeLessThan(0.6)
  })
})

describe('maskeleme', () => {
  it('iletişim bilgilerini (referanslarınki dahil) yer tutucuya çevirir ve geri koyar', () => {
    const text = `${TR_CV}\nREFERANSLAR\nMert Aydın\nMühendislik Müdürü, Örnek Teknoloji\nmert.aydin@example.com · 0533 000 11 22`
    const contacts = extractContacts(text)
    const masked = maskContacts(text, contacts)
    expect(masked.text).not.toContain('@example.com')
    expect(masked.text).not.toContain('532 000')
    expect(masked.text).not.toContain('0533 000 11 22')
    expect(masked.text).not.toContain('linkedin.com')
    expect(masked.text).toContain('⟦EMAIL⟧')
    expect(masked.text).toContain('⟦EMAIL_2⟧')
    expect(masked.text).toContain('⟦PHONE_2⟧')
    expect(masked.map['⟦EMAIL⟧']).toBe('ece.yildirim@example.com')
    expect(unmaskText(masked.text, masked.map)).toBe(text)
  })

  it('yanıttaki yer tutucuları yerelde açar', () => {
    const result: ImportResult = {
      personal: { fullName: 'Ece', email: '⟦EMAIL⟧' },
      sections: [{ type: 'references', title: null, items: [{ fields: { name: 'Mert', email: '⟦EMAIL_2⟧' } }] }],
    }
    const out = unmaskImportResult(result, { '⟦EMAIL⟧': 'e@example.com', '⟦EMAIL_2⟧': 'm@example.com' })
    expect(out.personal.email).toBe('e@example.com')
    expect(out.sections[0].items[0].fields.email).toBe('m@example.com')
  })

  it('ad satırı ve metindeki ad ⟦NAME⟧ ile maskelenir; ayrıştırıcı adı yer tutucudan alır ve geri konur', () => {
    const text = TR_CV.replace('Ece Yıldırım', 'ECE YILDIRIM') + '\nREFERANSLAR\nMert Aydın\nEce Yıldırım ile iki yıl çalıştı.'
    const contacts = extractContacts(text)
    const masked = maskName(maskContacts(text, contacts), 'ECE YILDIRIM')
    expect(masked.text).not.toMatch(/ece\s+yıldırım/i)
    expect(masked.text.split('\n')[0]).toBe('⟦NAME⟧')
    expect(masked.text).toContain('⟦NAME_2⟧ ile iki yıl')
    expect(masked.map['⟦NAME⟧']).toBe('ECE YILDIRIM')
    expect(unmaskText(masked.text, masked.map)).toBe(text)

    const raw = heuristicImport({ text: masked.text, language: 'tr' })
    expect(raw.personal.fullName).toBe('⟦NAME⟧')
    expect(raw.personal.headline).toBe('Kıdemli Frontend Geliştirici')
    const out = unmaskImportResult(raw, masked.map)
    expect(out.personal.fullName).toBe('ECE YILDIRIM')
    // Referans adı yanlışlıkla kişinin adı sayılmaz
    expect(out.sections.find((s) => s.type === 'references')?.items[0].fields.name).toBe('Mert Aydın')
    // Ad yoksa metin değişmez
    expect(maskName({ text: 'x', map: {} }, null)).toEqual({ text: 'x', map: {} })
  })

  it('eksik alanları yerel bulgularla tamamlar', () => {
    const out = completeImportResult(
      { personal: { email: 'model@example.com' }, sections: [] },
      { contacts: { email: 'yerel@example.com', phone: '0532 000 00 00' }, nameHint: 'Ece Yıldırım' },
    )
    expect(out.personal).toEqual({ email: 'model@example.com', phone: '0532 000 00 00', fullName: 'Ece Yıldırım' })
  })
})

describe('kurallı ayrıştırma — Türkçe CV', () => {
  const masked = maskContacts(TR_CV, extractContacts(TR_CV))
  const result = unmaskImportResult(heuristicImport({ text: masked.text, language: 'tr' }), masked.map)

  it('ad, unvan ve iletişim', () => {
    expect(result.personal).toEqual({
      fullName: 'Ece Yıldırım',
      headline: 'Kıdemli Frontend Geliştirici',
      email: 'ece.yildirim@example.com',
      phone: '+90 532 000 12 34',
      linkedin: 'linkedin.com/in/ece-yildirim-ornek',
      github: 'github.com/eceornek',
      location: 'İstanbul, Türkiye',
    })
  })

  it('bölümler PDF sırasıyla', () => {
    expect(result.sections.map((s) => s.type)).toEqual([
      'summary',
      'experience',
      'education',
      'skills',
      'languages',
      'certificates',
    ])
    expect(section(result, 'summary')!.items[0].fields.content).toMatch(/^Erişilebilir .* seviyorum\.$/)
  })

  it('deneyim kayıtları: unvan, şirket, konum, tarih, birleşmiş maddeler', () => {
    const [first, second] = section(result, 'experience')!.items
    expect(first).toEqual({
      fields: { position: 'Kıdemli Frontend Geliştirici', company: 'Örnek Teknoloji A.Ş.', location: 'İstanbul' },
      start: '2022-02',
      end: 'present',
      bullets: [
        'React ve TypeScript ile müşteri paneli yeniden yazıldı; sayfa açılış süresi %40 kısaldı ve destek talepleri belirgin şekilde azaldı.',
        'Ortak bileşen kütüphanesi kurdum; 4 ekip aynı tasarım sistemini kullanıyor.',
      ],
    })
    expect(second.fields).toEqual({ position: 'Frontend Geliştirici', company: 'Deneme Yazılım Ltd.', location: 'Ankara' })
    expect([second.start, second.end]).toEqual(['2019-06', '2022-01'])
  })

  it('eğitim: okul, derece, bölüm, not', () => {
    expect(section(result, 'education')!.items[0]).toEqual({
      fields: { school: 'Orta Anadolu Üniversitesi', degree: 'Lisans', field: 'Bilgisayar Mühendisliği', grade: '3,4/4' },
      start: '2015',
      end: '2019',
    })
  })

  it('beceri grupları, diller ve sertifika', () => {
    expect(section(result, 'skills')!.items.map((i) => i.fields)).toEqual([
      { name: 'Diller', keywords: 'TypeScript, JavaScript, Python' },
      { name: 'Çatılar', keywords: 'React, Vue, Node.js' },
      { name: 'Araçlar', keywords: 'Git, Docker, Figma' },
    ])
    expect(section(result, 'languages')!.items.map((i) => i.fields)).toEqual([
      { name: 'Türkçe', level: 'Ana dil' },
      { name: 'İngilizce', level: 'İleri (C1)' },
    ])
    expect(section(result, 'certificates')!.items[0]).toEqual({
      fields: { name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services' },
      start: '2023',
    })
  })
})

describe('kurallı ayrıştırma — Canva benzeri iki sütun (İngilizce)', () => {
  const result = heuristicImport({ text: EN_CANVA, language: 'en' })

  it('yan sütun önce gelse de adı ve unvanı bulur, dil listesine karıştırmaz', () => {
    expect(result.personal.fullName).toBe('Alex Morgan')
    expect(result.personal.headline).toBe('Backend Engineer')
    expect(section(result, 'languages')!.items.map((i) => i.fields)).toEqual([
      { name: 'English', level: 'Native' },
      { name: 'German', level: 'B2' },
    ])
  })

  it('iletişim bölümünü kişisel bilgilere yazar, ayrı bölüm açmaz', () => {
    expect(result.personal.email).toBe('alex.morgan@example.com')
    expect(result.personal.location).toBe('London, United Kingdom')
    expect(result.sections.some((s) => s.type === 'custom')).toBe(false)
  })

  it('satır sonunda bölünmüş beceri listelerini birleştirir', () => {
    expect(section(result, 'skills')!.items.map((i) => i.fields)).toEqual([
      { name: 'Languages', keywords: 'Go, TypeScript, SQL' },
      { name: 'Cloud', keywords: 'AWS, Terraform, Kubernetes' },
    ])
  })

  it('tarih başlıktan sonra gelen düzende kayıtları doğru böler', () => {
    const items = section(result, 'experience')!.items
    expect(items).toHaveLength(2)
    expect(items[0].fields).toEqual({
      position: 'Senior Backend Engineer',
      company: 'Sample Payments Ltd',
      location: 'London',
      // Madde işareti olmayan satır açıklama paragrafı olur
      description: 'Designed an idempotent payment API that handles 3 million requests per day.',
    })
    expect(items[0].start).toBe('2021-01')
    expect(items[1].fields.company).toBe('Example Analytics GmbH')
    expect(items[1].bullets).toEqual(['Built the ingestion pipeline for event data.', 'Mentored two junior engineers.'])
    expect(section(result, 'education')!.items[0].fields).toEqual({
      school: 'University of Northfield',
      degree: 'BSc',
      field: 'Computer Science',
    })
  })
})

describe('kurallı ayrıştırma — başka düzenler', () => {
  it('tarih önce, şirket unvandan önce; Word madde işaretleri ve harf aralıklı başlık', () => {
    const text = `ZEYNEP KARA
Veri Analisti
zeynep@example.com
D E N E Y İ M
01/2020 – 06/2021
Örnek Bankası A.Ş.
Veri Analisti
 Haftalık raporları otomatikleştirdim.
 SQL sorgularını hızlandırdım; rapor süresi
yarıya indi.
2018 – 2019
Deneme Danışmanlık
Stajyer
- Pazar araştırması yaptım.`
    const r = heuristicImport({ text, language: 'tr' })
    expect(r.personal.fullName).toBe('Zeynep Kara')
    expect(r.personal.headline).toBe('Veri Analisti')
    const items = section(r, 'experience')!.items
    expect(items.map((i) => i.fields)).toEqual([
      { position: 'Veri Analisti', company: 'Örnek Bankası A.Ş.' },
      { position: 'Stajyer', company: 'Deneme Danışmanlık' },
    ])
    expect(items[0].bullets).toEqual([
      'Haftalık raporları otomatikleştirdim.',
      'SQL sorgularını hızlandırdım; rapor süresi yarıya indi.',
    ])
    expect(items[1].bullets).toEqual(['Pazar araştırması yaptım.'])
  })

  it('"Position at Company" satırı ve paragraf açıklama', () => {
    const text = `Sam Rivera
EXPERIENCE
Product Designer at Sample Studio   Jan 2024 – Present
Led the redesign of the onboarding flow. Interviewed 30 customers and turned the findings into a
prototype that shipped in six weeks.
EDUCATION
Bachelor of Science in Computer Science, University of Northfield, 2019`
    const r = heuristicImport({ text, language: 'en' })
    const exp = section(r, 'experience')!.items[0]
    expect(exp.fields.position).toBe('Product Designer')
    expect(exp.fields.company).toBe('Sample Studio')
    expect(exp.fields.description).toMatch(/^Led the redesign .* six weeks\.$/)
    expect(exp.end).toBe('present')
    const edu = section(r, 'education')!.items[0]
    expect(edu.fields).toMatchObject({ school: 'University of Northfield', degree: 'Bachelor of Science', field: 'Computer Science' })
    expect(edu.start).toBe('2019')
  })

  it('tarihsiz projeler, tek satırda çok dil, iki satırlı dil, madde listesi beceriler', () => {
    const text = `Deniz Aksoy
PROJELER
Kitap Takas Uygulaması
• React Native ile mobil uygulama.
• 2.000 kullanıcıya ulaştı.
Hava Durumu Botu
github.com/denizaksoy/hava-botu
• Telegram botu.
YABANCI DİLLER
Türkçe (ana dil), İngilizce (C1)
Almanca
Başlangıç (A2)
YETENEKLER
• Figma
• Photoshop
• Illustrator`
    const r = heuristicImport({ text, language: 'tr' })
    const projects = section(r, 'projects')!.items
    expect(projects.map((p) => p.fields.name)).toEqual(['Kitap Takas Uygulaması', 'Hava Durumu Botu'])
    expect(projects[0].bullets).toHaveLength(2)
    expect(projects[1].fields.url).toBe('github.com/denizaksoy/hava-botu')
    expect(section(r, 'languages')!.items.map((i) => i.fields)).toEqual([
      { name: 'Türkçe', level: 'ana dil' },
      { name: 'İngilizce', level: 'C1' },
      { name: 'Almanca', level: 'Başlangıç (A2)' },
    ])
    expect(section(r, 'skills')!.items.map((i) => i.fields)).toEqual([{ keywords: 'Figma, Photoshop, Illustrator' }])
  })

  it('referanslar (maskeli) ve "istendiğinde verilir" notu', () => {
    const text = `Ece Yıldırım
REFERANSLAR
Mert Aydın
Mühendislik Müdürü, Örnek Teknoloji
⟦EMAIL_2⟧ · ⟦PHONE_2⟧
Selin Koç
Takım Lideri at Deneme Yazılım`
    const r = heuristicImport({ text, language: 'tr' })
    expect(section(r, 'references')!.items.map((i) => i.fields)).toEqual([
      { name: 'Mert Aydın', position: 'Mühendislik Müdürü', organization: 'Örnek Teknoloji', email: '⟦EMAIL_2⟧', phone: '⟦PHONE_2⟧' },
      { name: 'Selin Koç', position: 'Takım Lideri', organization: 'Deneme Yazılım' },
    ])
    const none = heuristicImport({ text: 'Ece Yıldırım\nREFERANSLAR\nReferanslar talep edildiğinde verilecektir.', language: 'tr' })
    expect(section(none, 'references')).toBeUndefined()
  })

  it('kişisel bilgiler ve tanınmayan metin kaybolmaz', () => {
    const text = `Ali Veli
Muhasebe Uzmanı
Ankara
Sayfa 1/2
Kısa not: Seyahat engelim yoktur
KİŞİSEL BİLGİLER
Askerlik: Tamamlandı
Ehliyet: B
HOBİLER
Satranç, fotoğrafçılık, koşu`
    const r = heuristicImport({ text, language: 'tr' })
    expect(r.personal.location).toBe('Ankara')
    const customs = r.sections.filter((s) => s.type === 'custom')
    expect(customs.map((s) => s.title)).toEqual(['Kişisel Bilgiler', 'Hobiler', 'Diğer'])
    expect(customs[0].items.map((i) => i.fields)).toEqual([
      { title: 'Askerlik', subtitle: 'Tamamlandı' },
      { title: 'Ehliyet', subtitle: 'B' },
    ])
    expect(customs[1].items[0].fields.title).toBe('Satranç, fotoğrafçılık, koşu')
    expect(customs[2].items[0].fields.description).toBe('Kısa not: Seyahat engelim yoktur')
  })

  it('başlık bölgesindeki uzun paragraf özet olur; staj başlığı korunur', () => {
    const text = `Ece Yıldırım
Erişilebilir web arayüzleri geliştiren, ekip çalışmasını seven bir geliştiriciyim ve tasarım sistemleri kuruyorum.
STAJLAR
Yazılım Stajyeri   Tem 2018 – Eyl 2018
Örnek Teknoloji`
    const r = heuristicImport({ text, language: 'tr' })
    expect(section(r, 'summary')!.items[0].fields.content).toMatch(/^Erişilebilir/)
    const interns = section(r, 'experience')!
    expect(interns.title).toBe('Stajlar')
    expect(interns.items[0]).toMatchObject({ fields: { position: 'Yazılım Stajyeri', company: 'Örnek Teknoloji' }, start: '2018-07', end: '2018-09' })
  })

  it('boş ya da başlıksız metin', () => {
    expect(heuristicImport({ text: '', language: 'tr' })).toEqual({ personal: {}, sections: [] })
  })

  it('ad tahmini', () => {
    expect(looksLikeName('Deniz Aksoy')).toBe(true)
    expect(looksLikeName('AYŞE NUR KAYA-DEMİR')).toBe(true)
    expect(looksLikeName('İngilizce İleri')).toBe(false)
    expect(looksLikeName('deniz@example.com')).toBe(false)
    expect(looksLikeName('EĞİTİM')).toBe(false)
  })
})

describe('içe aktarma sonucu → CV modeli', () => {
  it('kayıtları, tarihleri ve maddeleri (kaçışlı) çevirir', () => {
    const { personal, sections } = importResultToCv({
      personal: { fullName: ' Ece  Yıldırım ', email: 'ece@example.com' },
      sections: [
        {
          type: 'experience',
          title: 'İş Deneyimi',
          items: [
            {
              fields: { position: 'Geliştirici', company: 'Örnek <A.Ş.>', description: 'Ekip & ürün' },
              start: '2022-02',
              end: 'present',
              bullets: ['<script>x</script> ilk', 'ikinci'],
            },
            { fields: {} },
          ],
        },
        { type: 'certificates', title: null, items: [{ fields: { name: 'AWS' }, start: '2023' }] },
        { type: 'skills', title: null, items: [{ fields: { name: 'Araçlar' }, bullets: ['Git', 'Docker'] }] },
        { type: 'custom', title: 'Hobiler', items: [{ fields: { title: 'Satranç' } }] },
        { type: 'awards', title: null, items: [] },
      ],
    })
    expect(personal.fullName).toBe('Ece Yıldırım')
    expect(personal.photo).toBeNull()
    expect(sections.map((s) => [s.type, s.title])).toEqual([
      ['experience', null],
      ['certificates', null],
      ['skills', null],
      ['custom', 'Hobiler'],
    ])
    const exp = sections[0].items[0] as Record<string, unknown>
    expect(exp.company).toBe('Örnek <A.Ş.>')
    expect(exp.dates).toEqual({ start: { year: 2022, month: 2 }, end: null, current: true })
    expect(exp.description).toBe('<p>Ekip &amp; ürün</p><ul><li>&lt;script&gt;x&lt;/script&gt; ilk</li><li>ikinci</li></ul>')
    expect(sections[0].items).toHaveLength(1)
    expect(new Set(sections.flatMap((s) => s.items.map((i) => i.id))).size).toBe(4)
    expect((sections[1].items[0] as Record<string, unknown>).date).toEqual({ year: 2023, month: null })
    expect((sections[2].items[0] as Record<string, unknown>).keywords).toBe('Git, Docker')
  })

  it('özet içeriğini paragraf olarak yazar', () => {
    expect(toRichText('Bir\nİki', [])).toBe('<p>Bir</p><p>İki</p>')
    const { sections } = importResultToCv({ personal: {}, sections: [{ type: 'summary', items: [{ fields: { content: 'Merhaba' } }] }] })
    expect((sections[0].items[0] as Record<string, unknown>).content).toBe('<p>Merhaba</p>')
  })

  it('Türkçe fikstürün tamamı geçerli CV bölümlerine dönüşür', () => {
    const { sections } = importResultToCv(heuristicImport({ text: TR_CV, language: 'tr' }))
    const exp = sections.find((s) => s.type === 'experience')!.items[1] as Record<string, unknown>
    expect(exp.dates).toEqual({ start: { year: 2019, month: 6 }, end: { year: 2022, month: 1 }, current: false })
  })
})

describe('PDF satır kurma', () => {
  const item = (str: string, x: number, y: number, size = 10, hasEOL = false): RawTextItem => ({
    str,
    x,
    y,
    width: str.length * size * 0.5,
    size,
    hasEOL,
  })

  it('aynı satırdaki unvan ve tarihi geniş boşlukla birleştirir, sütun sanmaz', () => {
    const items = [
      item('Ada Kaya', 50, 60, 22),
      item('Kıdemli Geliştirici', 50, 100),
      item('Şub 2022 – Günümüz', 440, 100),
      item('Örnek Teknoloji', 50, 114),
      item('Kısa madde bir', 62, 128),
      item('Kısa madde iki', 62, 142),
      item('Geliştirici', 50, 170),
      item('2019 – 2022', 440, 170),
      item('Deneme Yazılım', 50, 184),
      item('Başka madde', 62, 198),
    ]
    const lines = buildPageLines(items, 1, 595).map((l) => l.text)
    expect(lines).toEqual([
      'Ada Kaya',
      'Kıdemli Geliştirici   Şub 2022 – Günümüz',
      'Örnek Teknoloji',
      '• Kısa madde bir',
      '• Kısa madde iki',
      'Geliştirici   2019 – 2022',
      'Deneme Yazılım',
      '• Başka madde',
    ])
  })

  it('satır satır karışmış iki sütunu ayırır; adın olduğu sütun önce', () => {
    // Akış sırası satır satır: yan sütun (sol) ile ana sütun (sağ) iç içe
    const rows: [string, string][] = [
      ['İLETİŞİM', 'Ada Kaya'],
      ['ada@example.com', 'Kıdemli Geliştirici ve ekip lideri'],
      ['0532 000 00 00', 'DENEYİM'],
      ['BECERİLER', 'Kıdemli Geliştirici Örnek Teknoloji'],
      ['React, Vue, Node.js', 'Müşteri panelini baştan yazdım ve hızlandırdım'],
      ['TypeScript ve Go', 'Ortak bileşen kütüphanesini kurdum'],
    ]
    const items: RawTextItem[] = []
    rows.forEach(([left, right], i) => {
      items.push(item(left, 20, 80 + i * 20))
      items.push(item(right, 220, 75 + i * 20, i === 0 ? 24 : 10))
    })
    const lines = buildPageLines(items, 1, 595).map((l) => l.text)
    expect(lines.slice(0, 6)).toEqual(rows.map((r) => r[1]))
    expect(lines.slice(6)).toEqual(rows.map((r) => r[0]))
  })

  it('en büyük yazılı satırı ad adayı olarak verir', () => {
    const lines = buildPageLines([item('Ada Kaya', 50, 60, 22), item('Geliştirici', 50, 90, 12), item('Metin', 50, 110)], 1, 595)
    expect(largestLine(lines)).toBe('Ada Kaya')
    expect(largestLine(buildPageLines([item('A', 50, 60), item('B', 50, 80)], 1, 595))).toBeNull()
  })
})
