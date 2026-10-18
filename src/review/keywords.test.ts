import { describe, expect, it } from 'vitest'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import { templateSettingsFor } from '@/render/templates'
import { detectLanguage, extractKeywords, matchJobAd, stem, tokenize } from './keywords'
import { cvPlainText } from './text'

const AD_TR = `Frontend Geliştirici arıyoruz
Aranan Nitelikler
- React ve TypeScript ile en az 3 yıl deneyimli
- Node.js, GraphQL ve REST API deneyimi
- CI/CD süreçlerine hakim, Docker ve Kubernetes bilgisi
- Birim testleri ve uçtan uca testler yazabilen
- Erişilebilirlik standartlarına (WCAG) hakim
- Tercihen Next.js ve Tailwind CSS deneyimi
- C# ya da Java bilgisi artı`

const AD_EN = `We are looking for a Senior Backend Engineer to join our platform team.
Requirements:
- 5+ years of experience building distributed systems in Go or Python
- Strong knowledge of PostgreSQL, Redis and Kafka
- Experience with AWS (EC2, S3, Lambda) and Terraform
- Experience with CI/CD pipelines and observability tools (Prometheus, Grafana)
Nice to have: Machine Learning infrastructure, data pipelines, microservices architecture.
You will design microservices, mentor engineers and own data pipelines end to end.`

function sampleText(language: 'tr' | 'en') {
  const sections = sampleSections(language)
  const cv = createCv({ name: 'x', language, templateId: 'zarif', template: templateSettingsFor('zarif', sections), personal: samplePersonal(language), sections })
  return cvPlainText(cv)
}

const terms = (list: { term: string }[]) => list.map((k) => k.term)

describe('tokenize', () => {
  it('teknik yazılışları korur, kesme işaretinden sonraki eki atar', () => {
    const raw = tokenize("C#, C++ ve Node.js'te CI/CD; React'e .NET React/Vue UI/UX").map((t) => t.raw)
    expect(raw).toEqual(['C#', 'C++', 've', 'Node.js', 'CI/CD', 'React', 'NET', 'React', 'Vue', 'UI/UX'])
  })

  it('teknik terimleri işaretler ve sadeleştirir', () => {
    const [node, ts, sql, heading] = tokenize('Node.js TypeScript SQL NİTELİKLER')
    expect(node).toMatchObject({ tech: true, norm: 'nodejs' })
    expect(ts.tech).toBe(true)
    expect(sql.tech).toBe(true)
    expect(heading).toMatchObject({ tech: false, norm: 'nitelikler' })
  })

  it('cümle başını ve noktalama kırılımını bilir', () => {
    const [a, b, c] = tokenize('Machine Learning, Python')
    expect(a.sentenceStart).toBe(true)
    expect(b.breakBefore).toBe(false)
    expect(c.breakBefore).toBe(true)
  })
})

describe('stem', () => {
  it('Türkçe ekleri atar', () => {
    expect(stem('deneyimi', 'tr')).toBe('deneyim')
    expect(stem('deneyimli', 'tr')).toBe('deneyim')
    expect(stem('yazilimlari', 'tr')).toBe(stem('yazilim', 'tr'))
    expect(stem('testleri', 'tr')).toBe(stem('testler', 'tr'))
    expect(stem('java', 'tr')).toBe('java')
  })

  it('İngilizce çoğul ve yaygın sonekler', () => {
    expect(stem('databases', 'en')).toBe('database')
    expect(stem('technologies', 'en')).toBe('technology')
    expect(stem('pipelines', 'en')).toBe('pipeline')
    expect(stem('process', 'en')).toBe('process')
    expect(stem('testing', 'en')).toBe(stem('tests', 'en'))
  })
})

describe('detectLanguage', () => {
  it('ilanın dilini bağlaçlardan bulur', () => {
    expect(detectLanguage(AD_TR)).toBe('tr')
    expect(detectLanguage(AD_EN)).toBe('en')
    expect(detectLanguage('React TypeScript', 'en')).toBe('en')
  })
})

describe('extractKeywords', () => {
  it('Türkçe ilan: teknik terimler var, bağlaç ve kalıp kelimeler yok', () => {
    const list = terms(extractKeywords(AD_TR, 'tr'))
    for (const t of ['React', 'TypeScript', 'Node.js', 'GraphQL', 'CI/CD', 'Docker', 'Kubernetes', 'WCAG', 'C#', 'Java', 'Next.js'])
      expect(list).toContain(t)
    for (const t of ['ve', 'ile', 'deneyimli', 'deneyimi', 'hakim', 'Tercihen', 'yıl']) expect(list).not.toContain(t)
  })

  it('büyük harfli ikililer ve tekrar eden ikililer ifade olur', () => {
    const list = extractKeywords(AD_EN, 'en')
    expect(terms(list)).toContain('Machine Learning')
    expect(terms(list)).toContain('Senior Backend Engineer')
    const pipelines = list.find((k) => k.term === 'data pipelines')!
    expect(pipelines).toMatchObject({ kind: 'phrase', count: 2 })
    // Yalnız ifadede geçen kelime ayrıca listelenmez
    expect(terms(list)).not.toContain('Machine')
  })

  it('özel adlar tek geçse de alınır; sıradan tek kelime alınmaz', () => {
    const list = terms(extractKeywords(AD_EN, 'en'))
    for (const t of ['Redis', 'Kafka', 'Terraform', 'Python', 'Go', 'PostgreSQL', 'EC2']) expect(list).toContain(t)
    expect(list).not.toContain('infrastructure')
    expect(list).not.toContain('5+')
  })

  it('teknik terimler önce gelir, sayılar ilandaki geçişi gösterir', () => {
    const list = extractKeywords('React React React ile çalış. Ayrıca Vue ve Vue biliyor olmak. Takım ruhu, takım ruhu.', 'tr')
    expect(list[0]).toMatchObject({ term: 'React', count: 3, kind: 'tech' })
    expect(terms(extractKeywords('React Vue Angular bilen', 'tr'))).toEqual(expect.arrayContaining(['React', 'Vue', 'Angular']))
  })

  it('boş ilan', () => {
    expect(extractKeywords('   ', 'tr')).toEqual([])
  })
})

describe('matchJobAd', () => {
  it('Türkçe ilan ↔ örnek CV', () => {
    const r = matchJobAd(AD_TR, sampleText('tr'), 'tr')
    expect(r.language).toBe('tr')
    expect(terms(r.present)).toEqual(expect.arrayContaining(['React', 'TypeScript', 'Next.js', 'Tailwind CSS']))
    expect(terms(r.missing)).toEqual(expect.arrayContaining(['Docker', 'Kubernetes', 'GraphQL', 'CI/CD', 'Node.js']))
    expect(r.present.find((k) => k.term === 'React')!.cvCount).toBeGreaterThan(0)
    expect(r.missing.every((k) => k.cvCount === 0)).toBe(true)
  })

  it('İngilizce ilan, ek ve yazılış farkları', () => {
    const cv = 'Built microservices with Python and NodeJS. Data pipeline on AWS Lambda; Kubernetes in production.'
    const r = matchJobAd(AD_EN, cv, 'tr')
    expect(r.language).toBe('en')
    expect(terms(r.present)).toEqual(expect.arrayContaining(['Python', 'AWS', 'Lambda', 'microservices', 'data pipelines']))
    expect(terms(r.missing)).toEqual(expect.arrayContaining(['Kafka', 'Redis', 'Terraform', 'Machine Learning']))
    expect(matchJobAd('Node.js deneyimi şart ve Node.js bilen', 'NodeJS ile çalıştım', 'tr').present[0].term).toBe('Node.js')
  })

  it('Türkçe büyük/küçük harf ve ek farkını yok sayar', () => {
    const r = matchJobAd('YAZILIM testleri ve yazılım testleri için otomasyon, otomasyon', 'Yazılımların testlerini otomasyonla yaptım', 'tr')
    expect(r.missing).toEqual([])
    expect(r.present.map((k) => k.key)).toEqual(['yazilim test', 'otomasyon'])
  })
})
