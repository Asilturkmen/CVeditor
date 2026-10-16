import { describe, expect, it } from 'vitest'
import { templateSettingsFor } from '@/render/templates'
import { createCv, createSection } from './factory'
import { fromJsonResume, toJsonResume } from './jsonResume'
import { samplePersonal, sampleSections } from './sample'
import { CvSchema } from './schema'
import type { Personal, Section, SectionOf, SectionType } from './schema'

function sampleCv(language: 'tr' | 'en' = 'tr') {
  const sections = sampleSections(language)
  return createCv({
    name: 'Örnek',
    language,
    templateId: 'modern',
    template: templateSettingsFor('modern', sections),
    personal: samplePersonal(language),
    sections,
  })
}

function wrap(result: { personal: Personal; sections: Section[] }) {
  return createCv({
    name: 'İçe aktarılan',
    language: 'tr',
    templateId: 'klasik',
    template: templateSettingsFor('klasik', result.sections),
    personal: result.personal,
    sections: result.sections,
  })
}

const find = <T extends SectionType>(sections: Section[], type: T) =>
  sections.find((s): s is SectionOf<T> => s.type === type)

/** Madde metinleri, biçim etiketleri atılmış */
const bullets = (html: string) =>
  Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('li')).map((li) =>
    (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
  )

const plain = (html: string) => (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').trim()

describe('JSON Resume dışa aktarım', () => {
  it('örnek CV standart alanlara eşlenir', () => {
    const json = toJsonResume(sampleCv('en'))
    expect(json.basics.name).toBe('Deniz Aksoy')
    expect(json.basics.label).toBe('Frontend Developer')
    expect(json.basics.url).toBe('https://denizaksoy.example.com')
    expect(json.basics.location).toEqual({ city: 'Izmir', region: 'Türkiye' })
    expect(json.basics.image).toBeUndefined()
    expect(json.basics.summary).toMatch(/^Frontend developer building/)
    expect(json.basics.profiles).toEqual([
      { network: 'LinkedIn', username: 'deniz-aksoy-ornek', url: 'https://linkedin.com/in/deniz-aksoy-ornek' },
      { network: 'GitHub', username: 'deniz-aksoy-ornek', url: 'https://github.com/deniz-aksoy-ornek' },
    ])
    expect(json.work[0]).toMatchObject({ name: 'Lacivert Yazılım', position: 'Frontend Developer', startDate: '2024-02' })
    expect(json.work[0].endDate).toBeUndefined()
    expect(json.work[0].highlights?.[0]).toBe(
      'Rewrote the customer dashboard with React 19 and TypeScript, cutting initial load time by 38%.',
    )
    expect(json.work[1]).toMatchObject({ startDate: '2023-06', endDate: '2023-09' })
    expect(json.education[0]).toMatchObject({ institution: 'Ege University', studyType: "Bachelor's degree", score: '3.42 / 4.00', courses: [] })
    expect(json.projects[0]).toMatchObject({ name: 'Rota', roles: ['Creator'], url: 'https://github.com/deniz-aksoy-ornek/rota' })
    expect(json.skills[0]).toEqual({ name: 'Languages', keywords: ['TypeScript', 'JavaScript', 'HTML', 'CSS', 'SQL'] })
    expect(json.languages[1]).toEqual({ language: 'English', fluency: 'Advanced (C1)' })
    expect(json.certificates[0]).toEqual({ name: 'Web Accessibility Fundamentals', issuer: 'Example Academy', date: '2023-11' })
    expect(json.meta).toMatchObject({ version: 'v1.0.0', cveditor: { language: 'en', customSections: [] } })
  })

  it('gizli kayıt ve bölümler dışarı çıkmaz', () => {
    const cv = sampleCv()
    find(cv.sections, 'experience')!.items[1].hidden = true
    find(cv.sections, 'skills')!.hidden = true
    const json = toJsonResume(cv)
    expect(json.work.map((w) => w.name)).toEqual(['Lacivert Yazılım', 'Serbest'])
    expect(json.skills).toEqual([])
  })

  it('başvuru ve özel bölümleri taşır', () => {
    const cv = sampleCv()
    const refs = createSection('references', 1)
    Object.assign(refs.items[0], { name: 'Ece Kaya', position: 'CTO', organization: 'Lacivert', email: 'ece@example.com', phone: '+90 555 111 22 33' })
    const custom = createSection('custom', 2)
    custom.title = 'Konuşmalar'
    Object.assign(custom.items[0], { title: 'DevFest', dates: { start: { year: 2024, month: 11 }, end: null, current: false }, description: '<p>Erişilebilirlik</p>' })
    custom.items[1].hidden = true
    custom.items[1].title = 'Gizli'
    cv.sections.push(refs, custom)

    const json = toJsonResume(cv)
    expect(json.references[0]).toEqual({ name: 'Ece Kaya', reference: 'CTO, Lacivert · ece@example.com · +90 555 111 22 33' })
    expect(json.meta.cveditor.customSections).toEqual([
      { title: 'Konuşmalar', items: [{ title: 'DevFest', startDate: '2024-11', current: false, description: '<p>Erişilebilirlik</p>' }] },
    ])

    const back = fromJsonResume(json, { language: 'tr' })
    expect(find(back.sections, 'references')!.items[0]).toMatchObject({
      name: 'Ece Kaya',
      position: 'CTO',
      organization: 'Lacivert',
      email: 'ece@example.com',
      phone: '+90 555 111 22 33',
    })
    const customBack = find(back.sections, 'custom')!
    expect(customBack.title).toBe('Konuşmalar')
    expect(customBack.items).toHaveLength(1)
    expect(customBack.items[0]).toMatchObject({ title: 'DevFest', description: '<p>Erişilebilirlik</p>' })
    expect(customBack.items[0].dates).toEqual({ start: { year: 2024, month: 11 }, end: null, current: false })
    expect(back.sections.at(-1)!.type).toBe('custom')
  })
})

describe('JSON Resume gidiş-dönüş', () => {
  it.each(['tr', 'en'] as const)('örnek CV (%s) korunur', (language) => {
    const cv = sampleCv(language)
    const result = fromJsonResume(toJsonResume(cv), { language })
    expect(result.warnings).toEqual([])

    const p = cv.personal
    expect(result.personal).toMatchObject({
      fullName: p.fullName,
      headline: p.headline,
      email: p.email,
      phone: p.phone,
      location: p.location,
      photo: null,
    })
    expect(result.personal.linkedin).toContain('linkedin.com/in/deniz-aksoy-ornek')

    expect(result.sections.map((s) => s.type)).toEqual(cv.sections.map((s) => s.type))

    const orig = find(cv.sections, 'experience')!.items
    const back = find(result.sections, 'experience')!.items
    expect(back.map((i) => [i.position, i.company, i.location])).toEqual(orig.map((i) => [i.position, i.company, i.location]))
    expect(back.map((i) => i.dates)).toEqual(orig.map((i) => i.dates))
    expect(back.map((i) => bullets(i.description))).toEqual(orig.map((i) => bullets(i.description)))

    const edu = find(result.sections, 'education')!.items[0]
    const eduOrig = find(cv.sections, 'education')!.items[0]
    expect([edu.school, edu.degree, edu.field, edu.grade]).toEqual([eduOrig.school, eduOrig.degree, eduOrig.field, eduOrig.grade])
    expect(edu.dates).toEqual(eduOrig.dates)

    const projects = find(result.sections, 'projects')!.items
    const projectsOrig = find(cv.sections, 'projects')!.items
    expect(projects.map((i) => [i.name, i.role, plain(i.description)])).toEqual(
      projectsOrig.map((i) => [i.name, i.role, plain(i.description)]),
    )
    expect(projects.map((i) => i.dates)).toEqual(projectsOrig.map((i) => i.dates))

    expect(find(result.sections, 'skills')!.items.map((i) => [i.name, i.keywords])).toEqual(
      find(cv.sections, 'skills')!.items.map((i) => [i.name, i.keywords]),
    )
    expect(find(result.sections, 'languages')!.items.map((i) => [i.name, i.level])).toEqual(
      find(cv.sections, 'languages')!.items.map((i) => [i.name, i.level]),
    )
    expect(find(result.sections, 'certificates')!.items[0].date).toEqual({ year: 2023, month: 11 })
    expect(plain(find(result.sections, 'summary')!.items[0].content)).toBe(
      plain(find(cv.sections, 'summary')!.items[0].content),
    )

    expect(CvSchema.safeParse(wrap(result)).success).toBe(true)
  })

  it('her kayıt yeni ve benzersiz kimlik alır', () => {
    const result = fromJsonResume(toJsonResume(sampleCv()), { language: 'tr' })
    const ids = result.sections.flatMap((s) => [s.id, ...s.items.flatMap((i) => [i.id, i.translationGroupId])])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('JSON Resume içe aktarım', () => {
  const fixture = {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: 'Jane Örnek',
      label: 'Backend Engineer',
      email: 'jane@example.com',
      url: 'https://jane.example.com',
      summary: 'Builds reliable APIs.\n\nLikes Go & Postgres.',
      location: { address: '1 Main St', postalCode: '94110', city: 'San Francisco', region: 'California', countryCode: 'US' },
      profiles: [
        { network: 'Twitter', username: 'jane' },
        { network: 'LinkedIn', url: 'https://www.linkedin.com/in/jane-ornek' },
        { network: 'github', username: 'janeornek' },
      ],
    },
    work: [
      {
        name: 'Acme Corp',
        position: 'Senior Engineer',
        url: 'https://acme.example.com',
        startDate: '2019-03-15',
        summary: 'Payments team.',
        highlights: ['Cut p99 latency by 40%', 'Led migration to Kubernetes'],
      },
    ],
    education: [
      { institution: 'State University', area: 'Computer Science', studyType: 'Bachelor', startDate: '2011', endDate: '2015', score: '3.8', courses: ['CS101 Algorithms'] },
    ],
    skills: [{ name: 'Backend', level: 'Master', keywords: ['Go', 'PostgreSQL'] }],
    interests: [{ name: 'Running', keywords: ['Trail', 'Marathon'] }],
  }

  it('gerçekçi bir JSON Resume içe aktarılır', () => {
    const { personal, sections, warnings } = fromJsonResume(fixture, { language: 'en' })
    expect(warnings).toEqual([])
    expect(personal).toMatchObject({
      fullName: 'Jane Örnek',
      headline: 'Backend Engineer',
      email: 'jane@example.com',
      website: 'https://jane.example.com',
      location: 'San Francisco, California, US',
      linkedin: 'https://www.linkedin.com/in/jane-ornek',
      github: 'github.com/janeornek',
    })
    expect(sections.map((s) => s.type)).toEqual(['summary', 'experience', 'education', 'skills', 'custom'])
    expect(find(sections, 'summary')!.items[0].content).toBe('<p>Builds reliable APIs.</p><p>Likes Go &amp; Postgres.</p>')

    const work = find(sections, 'experience')!.items[0]
    expect(work).toMatchObject({ company: 'Acme Corp', position: 'Senior Engineer' })
    expect(work.dates).toEqual({ start: { year: 2019, month: 3 }, end: null, current: true })
    expect(work.description).toBe('<p>Payments team.</p><ul><li>Cut p99 latency by 40%</li><li>Led migration to Kubernetes</li></ul>')

    const edu = find(sections, 'education')!.items[0]
    expect(edu).toMatchObject({ school: 'State University', degree: 'Bachelor', field: 'Computer Science', grade: '3.8' })
    expect(edu.dates).toEqual({ start: { year: 2011, month: null }, end: { year: 2015, month: null }, current: false })
    expect(bullets(edu.description)).toEqual(['CS101 Algorithms'])

    expect(find(sections, 'skills')!.items[0]).toMatchObject({ name: 'Backend', keywords: 'Go, PostgreSQL' })
    expect(find(sections, 'custom')!.title).toBe('Interests')
    expect(CvSchema.safeParse(wrap({ personal, sections })).success).toBe(true)
  })

  it('metin HTML olarak yorumlanmaz', () => {
    const { personal, sections } = fromJsonResume(
      {
        basics: { name: '<img src=x onerror=alert(1)>', summary: '<script>alert(1)</script> & <b>kalın</b>' },
        work: [{ name: 'A', highlights: ['<script>alert(1)</script>', 'a < b'] }],
      },
      { language: 'tr' },
    )
    expect(personal.fullName).toBe('<img src=x onerror=alert(1)>') // düz metin alanı; çizimde kaçışlanır
    const summary = find(sections, 'summary')!.items[0].content
    const work = find(sections, 'experience')!.items[0].description
    for (const html of [summary, work]) {
      expect(html).not.toMatch(/<script|<b>|<img/i)
    }
    expect(summary).toContain('&lt;script&gt;')
    expect(bullets(work)).toEqual(['<script>alert(1)</script>', 'a < b'])

    // Dışa aktarıp geri alınca da metin olarak kalır
    const cv = wrap({ personal, sections })
    const again = fromJsonResume(toJsonResume(cv), { language: 'tr' })
    const workAgain = find(again.sections, 'experience')!.items[0].description
    expect(workAgain).not.toMatch(/<script/i)
    expect(bullets(workAgain)).toEqual(['<script>alert(1)</script>', 'a < b'])
  })

  it('geçersiz girdi Türkçe hatayla reddedilir', () => {
    expect(() => fromJsonResume(null, { language: 'tr' })).toThrow(/JSON Resume okunamadı/)
    expect(() => fromJsonResume('metin', { language: 'tr' })).toThrow(/JSON Resume okunamadı/)
    expect(() => fromJsonResume([], { language: 'tr' })).toThrow(/JSON Resume okunamadı/)
    expect(() => fromJsonResume({ foo: 1 }, { language: 'tr' })).toThrow(/JSON Resume değil/)
  })

  it('kısmi ve hatalı türler uyarıyla atlanır', () => {
    const result = fromJsonResume(
      {
        basics: { name: 'Ali', email: { bad: true }, image: 'https://example.com/me.jpg', location: 'İzmir', profiles: 'x' },
        work: ['metin', { name: 'Co', position: ['dizi'], startDate: 'dün', endDate: 'Present', highlights: ['iyi', 42, null] }, {}],
        education: { institution: 'nesne' },
        skills: [{ name: 'Go', keywords: 'Go, Rust' }],
        projects: [{ name: 'P', startDate: '2020-13' }],
      },
      { language: 'tr' },
    )
    expect(result.personal.fullName).toBe('Ali')
    expect(result.personal.email).toBe('')
    expect(result.personal.photo).toBeNull()
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'basics.email: metin bekleniyordu, atlandı',
        'basics.location: nesne bekleniyordu, atlandı',
        'basics.profiles: liste bekleniyordu, atlandı',
        'work[0]: nesne bekleniyordu, atlandı',
        'work[1].position: metin bekleniyordu, atlandı',
        'work[1].startDate: tarih okunamadı ("dün")',
        'work[1].highlights[2]: metin bekleniyordu, atlandı',
        'education: liste bekleniyordu, atlandı',
        'projects[0].startDate: tarih okunamadı ("2020-13")',
      ]),
    )
    expect(result.warnings.some((w) => w.startsWith('basics.image'))).toBe(true)

    const work = find(result.sections, 'experience')!.items
    expect(work).toHaveLength(1) // boş kayıt atlanır
    expect(work[0]).toMatchObject({ company: 'Co', position: '' })
    expect(work[0].dates).toEqual({ start: null, end: null, current: true })
    expect(bullets(work[0].description)).toEqual(['iyi', '42'])
    expect(find(result.sections, 'education')).toBeUndefined()
    expect(find(result.sections, 'skills')!.items[0].keywords).toBe('Go, Rust')
    expect(find(result.sections, 'projects')!.items[0].dates).toEqual({ start: null, end: null, current: false })
    expect(CvSchema.safeParse(wrap(result)).success).toBe(true)
  })

  it('bitişsiz eğitim devam ediyor sayılmaz, fotoğraf data URL ise alınır', () => {
    const photo = 'data:image/jpeg;base64,AAAA'
    const { personal, sections } = fromJsonResume(
      { basics: { image: photo }, education: [{ institution: 'Okul', startDate: '2022-09' }] },
      { language: 'tr' },
    )
    expect(personal.photo).toBe(photo)
    expect(find(sections, 'education')!.items[0].dates).toEqual({ start: { year: 2022, month: 9 }, end: null, current: false })
  })
})
