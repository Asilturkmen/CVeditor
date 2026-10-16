import { createSection } from './factory'
import type { CvLanguage, Personal, Section } from './schema'

/**
 * Uydurma örnek CV. Şablon galerisi, içe aktarma önizlemesi ve testler
 * bunu kullanır. Gerçek kişi verisi DEĞİLDİR; repoya gerçek CV girmez.
 */
export function samplePersonal(language: CvLanguage): Personal {
  return {
    fullName: 'Deniz Aksoy',
    headline: language === 'tr' ? 'Frontend Geliştirici' : 'Frontend Developer',
    email: 'deniz.aksoy@example.com',
    phone: '+90 555 000 00 00',
    location: language === 'tr' ? 'İzmir, Türkiye' : 'Izmir, Türkiye',
    website: 'denizaksoy.example.com',
    linkedin: 'linkedin.com/in/deniz-aksoy-ornek',
    github: 'github.com/deniz-aksoy-ornek',
    photo: null,
  }
}

const ym = (year: number, month: number | null) => ({ year, month })

export function sampleSections(language: CvLanguage): Section[] {
  const tr = language === 'tr'

  const summary = createSection('summary', 1)
  summary.items[0].content = tr
    ? '<p>Erişilebilir ve hızlı web arayüzleri geliştiren frontend geliştirici. React ve TypeScript ile tasarım sistemleri kurdum; ürün ekipleriyle yakın çalışıp karmaşık iş akışlarını sade ekranlara dönüştürmeyi seviyorum.</p>'
    : '<p>Frontend developer building accessible, fast web interfaces. I have built design systems with React and TypeScript and enjoy working closely with product teams to turn complex workflows into simple screens.</p>'

  const experience = createSection('experience', 3)
  Object.assign(experience.items[0], {
    position: tr ? 'Frontend Geliştirici' : 'Frontend Developer',
    company: 'Lacivert Yazılım',
    location: tr ? 'İzmir' : 'Izmir',
    dates: { start: ym(2024, 2), end: null, current: true },
    description: tr
      ? '<ul><li>Müşteri panelini React 19 ve TypeScript ile yeniden yazdım; ilk yükleme süresi <strong>%38</strong> kısaldı.</li><li>12 bileşenlik bir tasarım sistemi kurup üç ürün ekibine yaydım.</li><li>Erişilebilirlik denetimlerini CI hattına ekledim; kritik hataları sıfıra indirdim.</li></ul>'
      : '<ul><li>Rewrote the customer dashboard with React 19 and TypeScript, cutting initial load time by <strong>38%</strong>.</li><li>Built a 12-component design system and rolled it out to three product teams.</li><li>Added accessibility audits to the CI pipeline and brought critical issues to zero.</li></ul>',
  })
  Object.assign(experience.items[1], {
    position: tr ? 'Yazılım Stajyeri' : 'Software Intern',
    company: 'Martı Teknoloji',
    location: tr ? 'İstanbul' : 'Istanbul',
    dates: { start: ym(2023, 6), end: ym(2023, 9), current: false },
    description: tr
      ? '<ul><li>Rezervasyon akışındaki form doğrulamalarını tek bir şema kütüphanesine taşıdım.</li><li>Uçtan uca testlerle kayıt akışındaki üç gerilemeyi yayından önce yakaladım.</li></ul>'
      : '<ul><li>Moved booking-flow form validation into a single schema library.</li><li>Caught three regressions in the sign-up flow before release with end-to-end tests.</li></ul>',
  })
  Object.assign(experience.items[2], {
    position: tr ? 'Serbest Web Geliştirici' : 'Freelance Web Developer',
    company: tr ? 'Serbest' : 'Self-employed',
    location: tr ? 'Uzaktan' : 'Remote',
    dates: { start: ym(2021, 9), end: ym(2023, 5), current: false },
    description: tr
      ? '<ul><li>Yerel işletmeler için 9 web sitesi tasarlayıp yayına aldım.</li></ul>'
      : '<ul><li>Designed and launched 9 websites for local businesses.</li></ul>',
  })

  const education = createSection('education', 1)
  Object.assign(education.items[0], {
    school: tr ? 'Ege Üniversitesi' : 'Ege University',
    degree: tr ? 'Lisans' : "Bachelor's degree",
    field: tr ? 'Bilgisayar Mühendisliği' : 'Computer Engineering',
    location: tr ? 'İzmir' : 'Izmir',
    dates: { start: ym(2020, 9), end: ym(2024, 6), current: false },
    grade: '3.42 / 4.00',
    description: '',
  })

  const projects = createSection('projects', 2)
  Object.assign(projects.items[0], {
    name: 'Rota',
    role: tr ? 'Kurucu geliştirici' : 'Creator',
    url: 'github.com/deniz-aksoy-ornek/rota',
    dates: { start: ym(2023, 1), end: null, current: true },
    description: tr
      ? '<p>Toplu taşıma aktarmalarını çevrimdışı hesaplayan açık kaynak PWA. Ayda 2.000 etkin kullanıcı.</p>'
      : '<p>Open-source PWA that plans public transport transfers offline. 2,000 monthly active users.</p>',
  })
  Object.assign(projects.items[1], {
    name: tr ? 'Kampüs Etkinlik Takvimi' : 'Campus Events Calendar',
    role: tr ? 'Ekip lideri' : 'Team lead',
    url: '',
    dates: { start: ym(2022, 2), end: ym(2022, 6), current: false },
    description: tr
      ? '<p>Dört kişilik ekiple öğrenci kulüplerinin etkinliklerini tek takvimde toplayan web uygulaması.</p>'
      : '<p>Web app built with a team of four that brings student club events into one calendar.</p>',
  })

  const skills = createSection('skills', 3)
  Object.assign(skills.items[0], { name: tr ? 'Diller' : 'Languages', keywords: 'TypeScript, JavaScript, HTML, CSS, SQL' })
  Object.assign(skills.items[1], { name: tr ? 'Çatılar' : 'Frameworks', keywords: 'React, Next.js, Vite, Tailwind CSS' })
  Object.assign(skills.items[2], { name: tr ? 'Araçlar' : 'Tools', keywords: 'Git, Playwright, Vitest, Figma' })

  const languages = createSection('languages', 2)
  Object.assign(languages.items[0], { name: tr ? 'Türkçe' : 'Turkish', level: tr ? 'Ana dil' : 'Native' })
  Object.assign(languages.items[1], { name: tr ? 'İngilizce' : 'English', level: tr ? 'İleri (C1)' : 'Advanced (C1)' })

  const certificates = createSection('certificates', 1)
  Object.assign(certificates.items[0], {
    name: tr ? 'Web Erişilebilirliği Temelleri' : 'Web Accessibility Fundamentals',
    issuer: tr ? 'Örnek Akademi' : 'Example Academy',
    date: ym(2023, 11),
    url: '',
  })

  return [summary, experience, education, projects, skills, languages, certificates]
}

/** İki sütunlu düzende varsayılan olarak yan sütuna giden bölüm türleri */
export const DEFAULT_SIDE_TYPES = ['skills', 'languages', 'certificates', 'awards', 'references'] as const
