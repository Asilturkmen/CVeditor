import { MAX_PDF_PAGES, type PdfText } from '@/ai/pdfText'
import { formatDateRange, isRangeInverted } from '@/cv/dates'
import { SECTION_TITLES, sectionTitle } from '@/cv/locale'
import type { AnyItem, Cv, DateRange, Section, SectionType } from '@/cv/schema'
import { itemLabel } from '@/features/editor/labels'
import { m } from '@/paraglide/messages'
import { isKnownHeading, standardTypeOf } from './headings'
import { fold, htmlToText, richParts, sectionText, visibleItems, wordCount } from './text'

/**
 * CV İnceleme kuralları. Ölçülebilir kontroller kuralla yapılır; içerik
 * yorumu (maddelerin etkisi, fiil seçimi) yapay zekâya kalır. Bilerek puan
 * yok: her kontrol ne gördüğünü ve neden önemli olduğunu söyler, geçen
 * kontroller de "ok" olarak listelenir.
 */

export type Category = 'okunabilirlik' | 'iletisim' | 'yapi' | 'tarihler' | 'icerik' | 'bicim'
export type Severity = 'ok' | 'info' | 'warn' | 'problem'

export interface FindingTarget {
  itemId?: string
  sectionId?: string
  personal?: boolean
  /** Düzeltme Görünüm sekmesinde (sütun, fotoğraf, sayfa sayısı) */
  tab?: 'appearance'
  /** Bölüm yok ya da kaydı yok: editör bu türde bölüm (gerekirse ilk kaydıyla) ekleyip ona gider */
  addSection?: SectionType
}

export interface Finding {
  id: string
  category: Category
  severity: Severity
  title: string
  detail: string
  target?: FindingTarget
}

export const CATEGORIES: Category[] = ['okunabilirlik', 'iletisim', 'yapi', 'tarihler', 'icerik', 'bicim']
export const SEVERITY_ORDER: Severity[] = ['problem', 'warn', 'info', 'ok']

/** Sınır değerler: testler ve arayüz metinleri aynı sayıları kullanır. */
export const LIMITS = {
  bulletChars: 220,
  paragraphChars: 250,
  summaryMinWords: 20,
  summaryMaxWords: 90,
  recentYears: 5,
  sideChars: 1200,
  pdfMinWords: 120,
} as const

const DATED_REQUIRED: SectionType[] = ['experience', 'education', 'volunteer']
const CHRONO: SectionType[] = ['experience', 'education', 'projects', 'volunteer']
/** Yan sütunda durmaması gereken bölümler */
const MAIN_ONLY: SectionType[] = ['summary', 'experience', 'education', 'projects']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const PHONE_CHARS_RE = /^\+?[\d\s().-]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export function isValidPhone(value: string): boolean {
  const v = value.trim()
  const digits = v.replace(/\D/g, '').length
  return PHONE_CHARS_RE.test(v) && digits >= 7 && digits <= 15
}

/** "site.com/yol", "https://site.com" biçiminde mi? Boşluk, eksik alan adı, garip protokol hatadır. */
export function isValidUrl(value: string): boolean {
  const v = value.trim()
  if (!v || /\s/.test(v)) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) return false
  const host = v.replace(/^https?:\/\//i, '').split(/[/?#]/)[0]
  return /^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?$/i.test(host) && !host.startsWith('-')
}

interface Ctx {
  cv: Cv
  out: Finding[]
  label: (section: Section, item: AnyItem) => string
}

function add(ctx: Ctx, f: Finding) {
  ctx.out.push(f)
}

/**
 * Görünmeyen (yok, gizli ya da kaydı boş) bölüm için hedef: kaydı olan bölüm
 * varsa ilk kaydı (gizliyse editörde "gizli" rozetiyle görünür), yoksa bölüm
 * eklenir.
 */
function sectionTarget(cv: Cv, type: SectionType): FindingTarget {
  const existing = cv.sections.find((s) => s.type === type && s.items.length > 0)
  return existing ? { sectionId: existing.id, itemId: (existing.items as AnyItem[])[0].id } : { addSection: type }
}

export interface ReviewCvOptions {
  /** Önizlemedeki sayfa sayısı (bilinmiyorsa sayfa kontrolü atlanır) */
  pageCount?: number
  /** Testler için sabit "bugün" */
  now?: Date
}

export function reviewCv(cv: Cv, options: ReviewCvOptions = {}): Finding[] {
  const ctx: Ctx = {
    cv,
    out: [],
    label: (section, item) => itemLabel(section.type, item) || sectionTitle(cv.language, section.type, section.title),
  }
  const now = options.now ?? new Date()
  const shown = cv.sections.filter((s) => !s.hidden && visibleItems(s).length > 0)

  checkLayout(ctx, shown)
  checkIdentity(ctx)
  checkLinks(ctx, shown)
  checkSectionTitles(ctx, shown)
  checkEssentials(ctx, shown)
  checkHidden(ctx)
  checkDates(ctx, shown)
  checkContent(ctx, shown, now)
  checkFormatting(ctx, shown)
  if (options.pageCount) checkPageCount(ctx.out, options.pageCount, { tab: 'appearance' })
  checkPhoto(ctx)
  return ctx.out
}

// ---------------------------------------------------------------- okunabilirlik

function checkLayout(ctx: Ctx, shown: Section[]) {
  const { cv } = ctx
  add(ctx, {
    id: 'text-selectable',
    category: 'okunabilirlik',
    severity: 'ok',
    title: m.rv_cv_text_ok(),
    detail: m.rv_cv_text_ok_d(),
  })
  if (cv.template.columns === 1) {
    add(ctx, { id: 'layout', category: 'okunabilirlik', severity: 'ok', title: m.rv_layout_single(), detail: m.rv_layout_single_d() })
    return
  }
  const sideIds = new Set(cv.template.sideSections)
  const side = shown.filter((s) => sideIds.has(s.id))
  const misplaced = side.filter((s) => MAIN_ONLY.includes(s.type))
  for (const s of misplaced) {
    add(ctx, {
      id: `layout-side-${s.id}`,
      category: 'okunabilirlik',
      severity: 'warn',
      title: m.rv_layout_side_main({ section: sectionTitle(cv.language, s.type, s.title) }),
      detail: m.rv_layout_side_main_d(),
      target: { sectionId: s.id, tab: 'appearance' },
    })
  }
  const sideChars = side.reduce((n, s) => n + sectionText(cv, s).length, 0)
  if (sideChars > LIMITS.sideChars) {
    add(ctx, {
      id: 'layout-side-long',
      category: 'okunabilirlik',
      severity: 'warn',
      title: m.rv_layout_side_long(),
      detail: m.rv_layout_side_long_d({ chars: sideChars }),
      target: { tab: 'appearance' },
    })
  }
  if (!misplaced.length && sideChars <= LIMITS.sideChars) {
    add(ctx, { id: 'layout', category: 'okunabilirlik', severity: 'info', title: m.rv_layout_two(), detail: m.rv_layout_two_d(), target: { tab: 'appearance' } })
  }
}

// ---------------------------------------------------------------- iletişim

function checkIdentity(ctx: Ctx) {
  const p = ctx.cv.personal
  const personal = { personal: true }
  add(ctx, p.fullName.trim()
    ? { id: 'name', category: 'iletisim', severity: 'ok', title: m.rv_name_ok(), detail: m.rv_name_ok_d() }
    : { id: 'name', category: 'iletisim', severity: 'problem', title: m.rv_name_missing(), detail: m.rv_name_missing_d(), target: personal })

  add(ctx, p.headline.trim()
    ? { id: 'headline', category: 'iletisim', severity: 'ok', title: m.rv_headline_ok({ value: p.headline.trim() }), detail: m.rv_headline_ok_d() }
    : { id: 'headline', category: 'iletisim', severity: 'warn', title: m.rv_headline_missing(), detail: m.rv_headline_missing_d(), target: personal })

  const email = p.email.trim()
  if (!email) add(ctx, { id: 'email', category: 'iletisim', severity: 'problem', title: m.rv_email_missing(), detail: m.rv_email_missing_d(), target: personal })
  else if (!isValidEmail(email))
    add(ctx, { id: 'email', category: 'iletisim', severity: 'problem', title: m.rv_email_bad({ value: email }), detail: m.rv_email_bad_d(), target: personal })
  else add(ctx, { id: 'email', category: 'iletisim', severity: 'ok', title: m.rv_email_ok(), detail: m.rv_email_ok_d() })

  const phone = p.phone.trim()
  if (!phone) add(ctx, { id: 'phone', category: 'iletisim', severity: 'warn', title: m.rv_phone_missing(), detail: m.rv_phone_missing_d(), target: personal })
  else if (!isValidPhone(phone))
    add(ctx, { id: 'phone', category: 'iletisim', severity: 'warn', title: m.rv_phone_bad({ value: phone }), detail: m.rv_phone_bad_d(), target: personal })
  else if (!phone.startsWith('+'))
    add(ctx, { id: 'phone', category: 'iletisim', severity: 'info', title: m.rv_phone_no_cc(), detail: m.rv_phone_no_cc_d(), target: personal })
  else add(ctx, { id: 'phone', category: 'iletisim', severity: 'ok', title: m.rv_phone_ok(), detail: m.rv_phone_ok_d() })

  add(ctx, p.location.trim()
    ? { id: 'location', category: 'iletisim', severity: 'ok', title: m.rv_location_ok(), detail: m.rv_location_ok_d() }
    : { id: 'location', category: 'iletisim', severity: 'info', title: m.rv_location_missing(), detail: m.rv_location_missing_d(), target: personal })
}

function checkLinks(ctx: Ctx, shown: Section[]) {
  const p = ctx.cv.personal
  let bad = 0
  let total = 0
  const badLink = (id: string, value: string, target: FindingTarget) => {
    bad++
    add(ctx, { id, category: 'iletisim', severity: 'warn', title: m.rv_link_bad({ value }), detail: m.rv_link_bad_d(), target })
  }
  for (const key of ['website', 'linkedin', 'github'] as const) {
    const value = p[key].trim()
    if (!value) continue
    total++
    if (!isValidUrl(value)) badLink(`link-${key}`, value, { personal: true })
    else if (key !== 'website' && !fold(value).includes(`${key}.com`)) {
      bad++
      add(ctx, {
        id: `link-${key}`,
        category: 'iletisim',
        severity: 'warn',
        title: key === 'linkedin' ? m.rv_link_not_linkedin({ value }) : m.rv_link_not_github({ value }),
        detail: m.rv_link_wrong_site_d(),
        target: { personal: true },
      })
    }
  }
  for (const s of shown) {
    for (const item of visibleItems(s)) {
      const url = (item as { url?: unknown }).url
      if (typeof url !== 'string' || !url.trim()) continue
      total++
      if (!isValidUrl(url)) badLink(`link-${item.id}`, url.trim(), { sectionId: s.id, itemId: item.id })
    }
  }
  if (!p.linkedin.trim()) {
    add(ctx, { id: 'linkedin', category: 'iletisim', severity: 'info', title: m.rv_linkedin_missing(), detail: m.rv_linkedin_missing_d(), target: { personal: true } })
  }
  if (total > 0 && bad === 0) {
    add(ctx, { id: 'links', category: 'iletisim', severity: 'ok', title: m.rv_links_ok({ count: total }), detail: m.rv_links_ok_d() })
  }
}

// ---------------------------------------------------------------- yapı

function checkSectionTitles(ctx: Ctx, shown: Section[]) {
  const { cv } = ctx
  let issues = 0
  for (const s of shown) {
    const custom = s.title?.trim()
    if (!custom) continue
    const first = visibleItems(s)[0]
    const target = { sectionId: s.id, itemId: first?.id }
    if (s.type === 'custom') {
      if (!isKnownHeading(custom)) {
        issues++
        add(ctx, { id: `title-${s.id}`, category: 'yapi', severity: 'info', title: m.rv_title_custom({ title: custom }), detail: m.rv_title_custom_d(), target })
      }
      continue
    }
    if (standardTypeOf(custom) !== s.type) {
      issues++
      add(ctx, {
        id: `title-${s.id}`,
        category: 'yapi',
        severity: 'warn',
        title: m.rv_title_unknown({ title: custom }),
        detail: m.rv_title_unknown_d({ suggestion: SECTION_TITLES[cv.language][s.type] }),
        target,
      })
    }
  }
  if (!issues) add(ctx, { id: 'titles', category: 'yapi', severity: 'ok', title: m.rv_titles_ok(), detail: m.rv_titles_ok_d() })
}

function checkEssentials(ctx: Ctx, shown: Section[]) {
  const has = (type: SectionType) => shown.some((s) => s.type === type)
  const names: string[] = []
  const lang = ctx.cv.language
  if (has('experience')) names.push(SECTION_TITLES[lang].experience)
  else add(ctx, { id: 'need-experience', category: 'yapi', severity: 'warn', title: m.rv_need_experience(), detail: m.rv_need_experience_d(), target: sectionTarget(ctx.cv, 'experience') })
  if (has('education')) names.push(SECTION_TITLES[lang].education)
  else add(ctx, { id: 'need-education', category: 'yapi', severity: 'warn', title: m.rv_need_education(), detail: m.rv_need_education_d(), target: sectionTarget(ctx.cv, 'education') })
  if (has('skills')) names.push(SECTION_TITLES[lang].skills)
  else add(ctx, { id: 'need-skills', category: 'yapi', severity: 'info', title: m.rv_need_skills(), detail: m.rv_need_skills_d(), target: sectionTarget(ctx.cv, 'skills') })
  if (names.length) {
    add(ctx, { id: 'essentials', category: 'yapi', severity: 'ok', title: m.rv_essentials_ok({ list: names.join(', ') }), detail: m.rv_essentials_ok_d() })
  }
}

function checkHidden(ctx: Ctx) {
  const { cv } = ctx
  let hiddenItems = 0
  let firstHidden: FindingTarget | undefined
  let any = false
  for (const s of cv.sections) {
    const items = s.items as AnyItem[]
    if (s.hidden) {
      if (!items.length) continue
      any = true
      add(ctx, {
        id: `hidden-${s.id}`,
        category: 'yapi',
        severity: 'info',
        title: m.rv_hidden_section({ title: sectionTitle(cv.language, s.type, s.title) }),
        detail: m.rv_hidden_d(),
        target: { sectionId: s.id, itemId: items[0]?.id },
      })
      continue
    }
    for (const item of items) {
      if (!item.hidden) continue
      hiddenItems++
      firstHidden ??= { sectionId: s.id, itemId: item.id }
    }
  }
  if (hiddenItems) {
    any = true
    add(ctx, { id: 'hidden-items', category: 'yapi', severity: 'info', title: m.rv_hidden_items({ count: hiddenItems }), detail: m.rv_hidden_d(), target: firstHidden })
  }
  if (!any) add(ctx, { id: 'hidden', category: 'yapi', severity: 'ok', title: m.rv_hidden_none(), detail: m.rv_hidden_none_d() })
}

// ---------------------------------------------------------------- tarihler

/** Sıralama anahtarı: devam eden en yeni; yoksa bitiş, o da yoksa başlangıç (ay sayısı). */
function recency(range: DateRange): number | null {
  if (range.current) return Number.POSITIVE_INFINITY
  const d = range.end ?? range.start
  return d ? d.year * 12 + (d.month ?? 12) : null
}

function checkDates(ctx: Ctx, shown: Section[]) {
  const { cv } = ctx
  let completeIssues = 0
  let orderIssues = 0
  let withMonth = 0
  let withoutMonth = 0
  let checked = 0
  let firstWithoutMonth: FindingTarget | undefined

  for (const s of shown) {
    if (!CHRONO.includes(s.type)) continue
    const items = visibleItems(s) as (AnyItem & { dates: DateRange })[]
    for (const item of items) {
      const range = item.dates
      const label = ctx.label(s, item)
      const target = { sectionId: s.id, itemId: item.id }
      for (const d of [range.start, range.end]) {
        if (!d) continue
        if (d.month == null) {
          withoutMonth++
          firstWithoutMonth ??= target
        } else withMonth++
      }
      if (!DATED_REQUIRED.includes(s.type)) {
        if (isRangeInverted(range)) {
          completeIssues++
          add(ctx, { id: `date-inverted-${item.id}`, category: 'tarihler', severity: 'problem', title: m.rv_date_inverted({ label }), detail: m.rv_date_inverted_d({ range: formatDateRange(range, cv.language) }), target })
        }
        continue
      }
      checked++
      if (!range.start) {
        completeIssues++
        add(ctx, { id: `date-start-${item.id}`, category: 'tarihler', severity: 'warn', title: m.rv_date_no_start({ label }), detail: m.rv_date_no_start_d(), target })
      } else if (!range.end && !range.current) {
        completeIssues++
        add(ctx, { id: `date-end-${item.id}`, category: 'tarihler', severity: 'warn', title: m.rv_date_no_end({ label }), detail: m.rv_date_no_end_d(), target })
      } else if (isRangeInverted(range)) {
        completeIssues++
        add(ctx, { id: `date-inverted-${item.id}`, category: 'tarihler', severity: 'problem', title: m.rv_date_inverted({ label }), detail: m.rv_date_inverted_d({ range: formatDateRange(range, cv.language) }), target })
      }
    }
    // Yeniden eskiye: her kayıt bir öncekinden yeni olmamalı (tarihsizler atlanır).
    const keys = items.map((i) => recency(i.dates))
    let prev: number | null = null
    let unordered = false
    for (const k of keys) {
      if (k == null) continue
      if (prev != null && k > prev) unordered = true
      prev = k
    }
    if (unordered) {
      orderIssues++
      add(ctx, {
        id: `date-order-${s.id}`,
        category: 'tarihler',
        severity: 'warn',
        title: m.rv_date_order({ section: sectionTitle(cv.language, s.type, s.title) }),
        detail: m.rv_date_order_d(),
        target: { sectionId: s.id, itemId: items[0]?.id },
      })
    }
  }

  if (checked && !completeIssues) add(ctx, { id: 'dates-complete', category: 'tarihler', severity: 'ok', title: m.rv_dates_complete(), detail: m.rv_dates_complete_d() })
  if (checked && !orderIssues) add(ctx, { id: 'dates-order', category: 'tarihler', severity: 'ok', title: m.rv_dates_ordered(), detail: m.rv_dates_ordered_d() })
  if (withMonth && withoutMonth) {
    // Öneri "hepsine ay ekle": ayı olmayan ilk tarihe gidilir.
    add(ctx, { id: 'dates-format', category: 'tarihler', severity: 'info', title: m.rv_dates_month_mixed(), detail: m.rv_dates_month_mixed_d({ withMonth, withoutMonth }), target: firstWithoutMonth })
  } else if (withMonth + withoutMonth > 0) {
    add(ctx, { id: 'dates-format', category: 'tarihler', severity: 'ok', title: m.rv_dates_format_ok(), detail: m.rv_dates_format_ok_d() })
  }
}

// ---------------------------------------------------------------- içerik

const PRONOUNS: Record<Cv['language'], RegExp> = {
  tr: /^(ben|benim|bana|beni|bizim|biz)\b/i,
  en: /^(i|my|me|i'm|i've|i'd|we|our)\b/i,
}

function checkContent(ctx: Ctx, shown: Section[], now: Date) {
  const { cv } = ctx
  const summary = shown.find((s) => s.type === 'summary')
  if (!summary) {
    add(ctx, { id: 'summary', category: 'icerik', severity: 'info', title: m.rv_summary_missing(), detail: m.rv_summary_missing_d(), target: sectionTarget(cv, 'summary') })
  } else {
    const words = wordCount(visibleItems(summary).map((i) => htmlToText((i as { content: string }).content)).join(' '))
    const target = { sectionId: summary.id, itemId: visibleItems(summary)[0]?.id }
    if (words < LIMITS.summaryMinWords) add(ctx, { id: 'summary', category: 'icerik', severity: 'info', title: m.rv_summary_short({ words }), detail: m.rv_summary_short_d(), target })
    else if (words > LIMITS.summaryMaxWords) add(ctx, { id: 'summary', category: 'icerik', severity: 'warn', title: m.rv_summary_long({ words }), detail: m.rv_summary_long_d(), target })
    else add(ctx, { id: 'summary', category: 'icerik', severity: 'ok', title: m.rv_summary_ok({ words }), detail: m.rv_summary_ok_d() })
  }

  const nowMonths = now.getFullYear() * 12 + now.getMonth() + 1
  let emptyIssues = 0
  let recentRoles = 0
  let longIssues = 0
  let paragraphIssues = 0
  let pronounIssues = 0
  let bulletTotal = 0
  let bulletNumbers = 0
  let describedRoles = 0
  let firstWithoutNumber: FindingTarget | undefined

  for (const s of shown) {
    if (!['experience', 'projects', 'volunteer'].includes(s.type)) continue
    const items = visibleItems(s) as (AnyItem & { dates: DateRange; description: string })[]
    items.forEach((item, index) => {
      const label = ctx.label(s, item)
      const target = { sectionId: s.id, itemId: item.id }
      const { bullets, paragraphs } = richParts(item.description)
      const text = [...bullets, ...paragraphs].join(' ')

      if (s.type === 'experience') {
        const key = recency(item.dates)
        const recent = key === Number.POSITIVE_INFINITY || (key != null ? nowMonths - key <= LIMITS.recentYears * 12 : index < 2)
        if (recent) {
          recentRoles++
          if (!text.trim()) {
            emptyIssues++
            add(ctx, { id: `empty-${item.id}`, category: 'icerik', severity: 'warn', title: m.rv_empty_desc({ label }), detail: m.rv_empty_desc_d(), target })
          }
        }
        if (text.trim()) describedRoles++
        if (!bullets.length && paragraphs.join(' ').length > LIMITS.paragraphChars) {
          paragraphIssues++
          add(ctx, { id: `paragraph-${item.id}`, category: 'icerik', severity: 'warn', title: m.rv_paragraph({ label }), detail: m.rv_paragraph_d(), target })
        }
      }

      const long = bullets.filter((b) => b.length > LIMITS.bulletChars).length
      if (long) {
        longIssues++
        add(ctx, { id: `long-${item.id}`, category: 'icerik', severity: 'warn', title: m.rv_long_bullets({ count: long, label }), detail: m.rv_long_bullets_d({ max: LIMITS.bulletChars }), target })
      }

      const starts = bullets.length ? bullets : paragraphs.flatMap((p) => p.split(/(?<=[.!?])\s+/))
      if (starts.some((b) => PRONOUNS[cv.language].test(b.trim()))) {
        pronounIssues++
        add(ctx, { id: `pronoun-${item.id}`, category: 'icerik', severity: 'info', title: m.rv_pronoun({ label }), detail: m.rv_pronoun_d(), target })
      }

      if (s.type !== 'volunteer') {
        const numbered = bullets.filter((b) => /\d|%/.test(b)).length
        bulletTotal += bullets.length
        bulletNumbers += numbered
        if (numbered < bullets.length) firstWithoutNumber ??= target
      }
    })
  }

  if (recentRoles && !emptyIssues) add(ctx, { id: 'empty', category: 'icerik', severity: 'ok', title: m.rv_empty_ok(), detail: m.rv_empty_ok_d() })
  if (describedRoles && !paragraphIssues) add(ctx, { id: 'paragraph', category: 'icerik', severity: 'ok', title: m.rv_paragraph_ok(), detail: m.rv_paragraph_ok_d() })
  if (bulletTotal && !longIssues) add(ctx, { id: 'long', category: 'icerik', severity: 'ok', title: m.rv_long_ok(), detail: m.rv_long_ok_d({ max: LIMITS.bulletChars }) })
  if ((bulletTotal || describedRoles) && !pronounIssues) add(ctx, { id: 'pronoun', category: 'icerik', severity: 'ok', title: m.rv_pronoun_ok(), detail: m.rv_pronoun_ok_d() })
  if (bulletTotal) {
    const enough = bulletNumbers * 3 >= bulletTotal
    add(ctx, {
      id: 'numbers',
      category: 'icerik',
      severity: enough ? 'ok' : 'info',
      title: m.rv_numbers({ count: bulletNumbers, total: bulletTotal }),
      detail: enough ? m.rv_numbers_ok_d() : m.rv_numbers_low_d(),
      target: enough ? undefined : firstWithoutNumber,
    })
  }
}

// ---------------------------------------------------------------- biçim

function isAllCaps(text: string, language: Cv['language']): boolean {
  const letters = text.replace(/[^\p{L}]/gu, '')
  return wordCount(text) >= 3 && letters.length >= 8 && text === text.toLocaleUpperCase(language) && text !== text.toLocaleLowerCase(language)
}

function checkFormatting(ctx: Ctx, shown: Section[]) {
  const { cv } = ctx
  let dot = 0
  let noDot = 0
  let doubleIssues = 0
  let capsIssues = 0
  let firstDot: FindingTarget | undefined
  let firstNoDot: FindingTarget | undefined

  const p = cv.personal
  const personalTexts = [p.fullName, p.headline, p.location]
  if (personalTexts.some((t) => / {2,}/.test(t.trim()))) {
    doubleIssues++
    add(ctx, { id: 'double-personal', category: 'bicim', severity: 'info', title: m.rv_double_space({ label: m.rv_personal_label() }), detail: m.rv_double_space_d(), target: { personal: true } })
  }
  if (isAllCaps(p.headline, cv.language)) {
    capsIssues++
    add(ctx, { id: 'caps-personal', category: 'bicim', severity: 'info', title: m.rv_all_caps({ label: p.headline.trim() }), detail: m.rv_all_caps_d(), target: { personal: true } })
  }

  for (const s of shown) {
    for (const item of visibleItems(s)) {
      const record = item as unknown as Record<string, unknown>
      const target = { sectionId: s.id, itemId: item.id }
      const label = ctx.label(s, item)
      const plain: string[] = []
      const lines: string[] = []
      for (const [key, value] of Object.entries(record)) {
        if (typeof value !== 'string' || key === 'id' || key === 'translationGroupId' || key === 'url') continue
        if (/<[a-z]/i.test(value) || key === 'description' || key === 'content') {
          const { bullets, paragraphs } = richParts(value)
          plain.push(...bullets, ...paragraphs)
          lines.push(...bullets, ...paragraphs)
          for (const b of bullets) {
            if (/[.!?…]$/.test(b)) {
              dot++
              firstDot ??= target
            } else {
              noDot++
              firstNoDot ??= target
            }
          }
        } else {
          plain.push(value.trim())
          if (key === 'position' || key === 'title' || key === 'role') lines.push(value.trim())
        }
      }
      if (plain.some((t) => / {2,}/.test(t))) {
        doubleIssues++
        add(ctx, { id: `double-${item.id}`, category: 'bicim', severity: 'info', title: m.rv_double_space({ label }), detail: m.rv_double_space_d(), target })
      }
      const caps = lines.find((t) => isAllCaps(t, cv.language))
      if (caps) {
        capsIssues++
        add(ctx, { id: `caps-${item.id}`, category: 'bicim', severity: 'info', title: m.rv_all_caps({ label }), detail: m.rv_all_caps_d(), target })
      }
    }
  }

  if (dot && noDot) {
    // Azınlıkta kalan biçimin ilk kaydına gidilir (eşitse noktasız olana).
    const target = dot < noDot ? firstDot : firstNoDot
    add(ctx, { id: 'bullet-end', category: 'bicim', severity: 'info', title: m.rv_bullet_end_mixed(), detail: m.rv_bullet_end_mixed_d({ dot, noDot }), target })
  } else if (dot + noDot > 1) {
    add(ctx, { id: 'bullet-end', category: 'bicim', severity: 'ok', title: m.rv_bullet_end_ok(), detail: m.rv_bullet_end_ok_d() })
  }
  if (!doubleIssues) add(ctx, { id: 'double', category: 'bicim', severity: 'ok', title: m.rv_double_ok(), detail: m.rv_double_ok_d() })
  if (!capsIssues) add(ctx, { id: 'caps', category: 'bicim', severity: 'ok', title: m.rv_caps_ok(), detail: m.rv_caps_ok_d() })
}

/** Kendi CV'de hedef Görünüm sekmesi (yazı boyutu, aralık); yüklenen PDF'te hedef yok. */
function checkPageCount(out: Finding[], pages: number, target?: FindingTarget) {
  if (pages > 2) out.push({ id: 'pages', category: 'bicim', severity: 'warn', title: m.rv_pages_many({ count: pages }), detail: m.rv_pages_many_d(), target })
  else if (pages === 2) out.push({ id: 'pages', category: 'bicim', severity: 'info', title: m.rv_pages_two(), detail: m.rv_pages_two_d(), target })
  else out.push({ id: 'pages', category: 'bicim', severity: 'ok', title: m.rv_pages_one(), detail: m.rv_pages_one_d() })
}

function checkPhoto(ctx: Ctx) {
  const { cv } = ctx
  const shown = cv.template.showPhoto && !!cv.personal.photo
  if (shown && cv.language === 'en') {
    add(ctx, { id: 'photo', category: 'bicim', severity: 'info', title: m.rv_photo_en(), detail: m.rv_photo_en_d(), target: { tab: 'appearance' } })
  } else {
    add(ctx, { id: 'photo', category: 'bicim', severity: 'ok', title: m.rv_photo_ok(), detail: shown ? m.rv_photo_ok_tr_d() : m.rv_photo_none_d() })
  }
}

// ================================================================ PDF

const EMAIL_FIND = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[a-z]{2,}/iu
const PHONE_FIND = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{3,4}\)?[\s.-]?)\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b|\+\d[\d\s().-]{8,}\d/
const LINKEDIN_FIND = /linkedin\.com\/(in|pub)\/[\w%-]+/i

const MONTHS = [
  'ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik',
  'oca', 'sub', 'mar', 'nis', 'may', 'haz', 'tem', 'agu', 'eyl', 'eki', 'kas', 'ara',
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
]

export type DateStyle = 'dd.mm.yyyy' | 'mm/yyyy' | 'mm.yyyy' | 'mm-yyyy' | 'yyyy-mm' | 'month yyyy' | 'yyyy'

/** Metindeki tarih biçimleri ve her birinden ilk örnek. */
export function detectDateStyles(text: string): Map<DateStyle, { count: number; example: string }> {
  const found = new Map<DateStyle, { count: number; example: string }>()
  // Harf harf katlanır ki konumlar özgün metinle aynı kalsın; örnek özgün yazılışla gösterilir.
  let rest = [...text].map((ch) => (fold(ch).length === ch.length ? fold(ch) : ch)).join('')
  const original = text
  const take = (style: DateStyle, re: RegExp) => {
    rest = rest.replace(re, (match, ...args) => {
      const at = args.find((a) => typeof a === 'number') as number
      const entry = found.get(style)
      if (entry) entry.count++
      else found.set(style, { count: 1, example: original.slice(at, at + match.length).trim() })
      return ' '.repeat(match.length)
    })
  }
  take('dd.mm.yyyy', /\b\d{1,2}[./]\d{1,2}[./](?:19|20)\d{2}\b/g)
  take('yyyy-mm', /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])\b/g)
  take('mm/yyyy', /\b(?:0?[1-9]|1[0-2])\s?\/\s?(?:19|20)\d{2}\b/g)
  take('mm.yyyy', /\b(?:0?[1-9]|1[0-2])\.(?:19|20)\d{2}\b/g)
  take('mm-yyyy', /\b(?:0?[1-9]|1[0-2])-(?:19|20)\d{2}\b/g)
  take('month yyyy', new RegExp(`\\b(?:${MONTHS.join('|')})\\.?,?\\s+(?:19|20)\\d{2}\\b`, 'g'))
  take('yyyy', /\b(?:19|20)\d{2}\b/g)
  return found
}

const TR_HINT = /\b(ve|ile|bir|için|olarak|bu|da|de|gibi|üzerinde|deneyim|eğitim)\b/giu

export function reviewPdfText(pdf: PdfText): Finding[] {
  const out: Finding[] = []
  const text = pdf.text
  const words = wordCount(text)

  // ---- okunabilirlik
  out.push({ id: 'pdf-text', category: 'okunabilirlik', severity: 'ok', title: m.rv_pdf_text_ok({ pages: pdf.pageCount, words }), detail: m.rv_pdf_text_ok_d() })
  if (words < LIMITS.pdfMinWords) {
    out.push({ id: 'pdf-little', category: 'okunabilirlik', severity: 'warn', title: m.rv_pdf_little({ words }), detail: m.rv_pdf_little_d() })
  }
  if (pdf.pageCount > 1) {
    for (let page = 1; page <= pdf.pageCount; page++) {
      const pageWords = wordCount(pdf.lines.filter((l) => l.page === page).map((l) => l.text).join(' '))
      if (pageWords < 15) out.push({ id: `pdf-empty-page-${page}`, category: 'okunabilirlik', severity: 'warn', title: m.rv_pdf_empty_page({ page }), detail: m.rv_pdf_empty_page_d() })
    }
  }
  checkGarbled(out, text)
  checkColumns(out, pdf)
  checkRepeated(out, pdf)

  // ---- iletişim
  const email = text.match(EMAIL_FIND)?.[0]
  if (email) {
    out.push({ id: 'pdf-email', category: 'iletisim', severity: 'ok', title: m.rv_pdf_email_ok({ value: email }), detail: m.rv_pdf_email_ok_d() })
    const line = pdf.lines.find((l) => l.text.includes(email))
    if (line && line.page > 1) out.push({ id: 'pdf-email-page', category: 'iletisim', severity: 'info', title: m.rv_pdf_contact_late(), detail: m.rv_pdf_contact_late_d() })
  } else {
    out.push({ id: 'pdf-email', category: 'iletisim', severity: 'problem', title: m.rv_pdf_email_missing(), detail: m.rv_pdf_email_missing_d() })
  }
  const phone = text.match(PHONE_FIND)?.[0]
  out.push(
    phone
      ? { id: 'pdf-phone', category: 'iletisim', severity: 'ok', title: m.rv_pdf_phone_ok({ value: phone.trim() }), detail: m.rv_pdf_phone_ok_d() }
      : { id: 'pdf-phone', category: 'iletisim', severity: 'warn', title: m.rv_pdf_phone_missing(), detail: m.rv_pdf_phone_missing_d() },
  )
  const linkedin = text.match(LINKEDIN_FIND)?.[0]
  out.push(
    linkedin
      ? { id: 'pdf-linkedin', category: 'iletisim', severity: 'ok', title: m.rv_pdf_linkedin_ok(), detail: m.rv_pdf_linkedin_ok_d({ value: linkedin }) }
      : { id: 'pdf-linkedin', category: 'iletisim', severity: 'info', title: m.rv_linkedin_missing(), detail: m.rv_linkedin_missing_d() },
  )

  // ---- yapı
  const headings = new Map<SectionType, string>()
  for (const l of pdf.lines) {
    const t = l.text.replace(/[:：]\s*$/, '').trim()
    if (!t || t.split(/\s+/).length > 5) continue
    const type = standardTypeOf(t)
    if (type && !headings.has(type)) headings.set(type, t)
  }
  if (headings.size) {
    out.push({ id: 'pdf-headings', category: 'yapi', severity: 'ok', title: m.rv_pdf_headings_ok(), detail: m.rv_pdf_headings_ok_d({ list: [...headings.values()].join(', ') }) })
  }
  if (!headings.has('experience')) out.push({ id: 'pdf-h-experience', category: 'yapi', severity: 'warn', title: m.rv_pdf_heading_missing({ name: 'Deneyim / Experience' }), detail: m.rv_pdf_heading_missing_d() })
  if (!headings.has('education')) out.push({ id: 'pdf-h-education', category: 'yapi', severity: 'warn', title: m.rv_pdf_heading_missing({ name: 'Eğitim / Education' }), detail: m.rv_pdf_heading_missing_d() })
  if (!headings.has('skills')) out.push({ id: 'pdf-h-skills', category: 'yapi', severity: 'info', title: m.rv_pdf_heading_missing({ name: 'Beceriler / Skills' }), detail: m.rv_need_skills_d() })

  // ---- tarihler
  const styles = detectDateStyles(text)
  const specific = [...styles.entries()].filter(([s]) => s !== 'yyyy')
  const yearOnly = styles.get('yyyy')
  if (!styles.size) {
    out.push({ id: 'pdf-dates', category: 'tarihler', severity: 'warn', title: m.rv_pdf_dates_none(), detail: m.rv_pdf_dates_none_d() })
  } else if (specific.length > 1) {
    out.push({
      id: 'pdf-dates',
      category: 'tarihler',
      severity: 'warn',
      title: m.rv_pdf_dates_mixed(),
      detail: m.rv_pdf_dates_mixed_d({ examples: specific.map(([, v]) => `“${v.example}”`).join(', ') }),
    })
  } else if (specific.length === 1 && yearOnly && yearOnly.count >= 2 && specific[0][1].count >= 2) {
    out.push({ id: 'pdf-dates', category: 'tarihler', severity: 'info', title: m.rv_dates_month_mixed(), detail: m.rv_pdf_dates_year_d({ example: specific[0][1].example }) })
  } else {
    const example = (specific[0]?.[1] ?? yearOnly)!.example
    out.push({ id: 'pdf-dates', category: 'tarihler', severity: 'ok', title: m.rv_dates_format_ok(), detail: m.rv_pdf_dates_ok_d({ example }) })
  }

  // ---- biçim
  checkPageCount(out, pdf.pageCount)
  return out
}

function checkGarbled(out: Finding[], text: string) {
  let issues = 0
  const chars = text.replace(/\s/g, '').length || 1
  // Denetim karakterleri bilerek aranıyor (bozuk yazı tipi eşlemesi)
  // oxlint-disable-next-line no-control-regex
  const bad = (text.match(/[�-\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length
  if (bad) {
    issues++
    out.push({ id: 'pdf-garbled', category: 'okunabilirlik', severity: bad / chars > 0.01 ? 'problem' : 'warn', title: m.rv_pdf_garbled({ count: bad }), detail: m.rv_pdf_garbled_d() })
  }
  const mojibake = text.match(/[ýþðÝÞÐ]|Ä±|Ä°|ÅŸ|Åž|ÄŸ|Äž|Ã§|Ã‡|Ã¶|Ã–|Ã¼|Ãœ/g) ?? []
  if (mojibake.length >= 2) {
    issues++
    out.push({ id: 'pdf-mojibake', category: 'okunabilirlik', severity: 'warn', title: m.rv_pdf_mojibake(), detail: m.rv_pdf_mojibake_d({ sample: [...new Set(mojibake)].slice(0, 4).join(' ') }) })
  }
  const trHints = (text.match(TR_HINT) ?? []).length
  const trLetters = (text.match(/[çşğöüÇŞĞÖÜİ]/g) ?? []).length
  if (wordCount(text) >= 80 && trHints >= 8 && trLetters >= 10 && !/[ıI]/.test(text)) {
    issues++
    out.push({ id: 'pdf-no-dotless', category: 'okunabilirlik', severity: 'warn', title: m.rv_pdf_no_dotless(), detail: m.rv_pdf_no_dotless_d() })
  }
  const tokens = text.split(/\s+/).filter(Boolean)
  const singles = tokens.filter((t) => /^\p{L}$/u.test(t)).length
  if (singles >= 20 && singles / tokens.length > 0.2) {
    issues++
    out.push({ id: 'pdf-spaced', category: 'okunabilirlik', severity: 'warn', title: m.rv_pdf_spaced(), detail: m.rv_pdf_spaced_d() })
  }
  if (!issues) out.push({ id: 'pdf-chars', category: 'okunabilirlik', severity: 'ok', title: m.rv_pdf_chars_ok(), detail: m.rv_pdf_chars_ok_d() })
}

/**
 * İki sütun tespiti: sayfada sola yaslı iki ayrı satır başlangıcı kümesi
 * (aralarında sayfanın en az %25'i) varsa iki sütun var demektir. Satırlar
 * akış sırasında bu iki küme arasında sık sık gidip geliyorsa ATS metni
 * karışık okur. Sağa yaslı kısa öğeler (tarih) kümelere girmez.
 */
export function columnInterleaving(pdf: PdfText): { twoColumn: boolean; switches: number } {
  let twoColumn = false
  let switches = 0
  const pages = new Set(pdf.lines.map((l) => l.page))
  for (const page of pages) {
    const lines = pdf.lines.filter((l) => l.page === page && l.text.length >= 3)
    const bins = new Map<number, number>()
    for (const l of lines) {
      const b = Math.round(l.x / 4)
      bins.set(b, (bins.get(b) ?? 0) + 1)
    }
    const starts = [...bins.entries()].filter(([, n]) => n >= 4).map(([b]) => b * 4).sort((a, b) => a - b)
    if (starts.length < 2) continue
    const left = starts[0]
    const right = starts.find((x) => x - left > pdf.pageWidth * 0.25)
    if (right == null) continue
    // Sağ kümedeki satırlar gerçek metin mi (ortalama uzunluk), yoksa tarih gibi kısa öğeler mi?
    const rightLines = lines.filter((l) => Math.abs(l.x - right) <= 4)
    const avg = rightLines.reduce((n, l) => n + l.text.length, 0) / (rightLines.length || 1)
    if (rightLines.length < 4 || avg < 12) continue
    twoColumn = true
    let prev: 'L' | 'R' | null = null
    for (const l of lines) {
      const col = l.x >= right - 4 && l.x <= right + 40 ? 'R' : l.x >= left - 4 && l.x <= left + 40 ? 'L' : null
      if (!col) continue
      if (prev && col !== prev) switches++
      prev = col
    }
  }
  return { twoColumn, switches }
}

function checkColumns(out: Finding[], pdf: PdfText) {
  const { twoColumn, switches } = columnInterleaving(pdf)
  if (!twoColumn) out.push({ id: 'pdf-columns', category: 'okunabilirlik', severity: 'ok', title: m.rv_layout_single(), detail: m.rv_layout_single_d() })
  else if (switches > 6) out.push({ id: 'pdf-columns', category: 'okunabilirlik', severity: 'warn', title: m.rv_pdf_interleaved(), detail: m.rv_pdf_interleaved_d({ switches }) })
  else out.push({ id: 'pdf-columns', category: 'okunabilirlik', severity: 'info', title: m.rv_layout_two(), detail: m.rv_pdf_columns_d() })
}

/** Birden çok sayfada aynen tekrar eden satır: üst/alt bilgi belirtisi. */
function checkRepeated(out: Finding[], pdf: PdfText) {
  if (pdf.pageCount < 2) return
  const pagesOf = new Map<string, Set<number>>()
  for (const l of pdf.lines) {
    if (l.text.length < 4) continue
    const set = pagesOf.get(l.text) ?? new Set<number>()
    set.add(l.page)
    pagesOf.set(l.text, set)
  }
  const repeated = [...pagesOf.entries()].filter(([, set]) => set.size >= 2).map(([t]) => t)
  if (repeated.length) {
    out.push({ id: 'pdf-repeated', category: 'okunabilirlik', severity: 'info', title: m.rv_pdf_repeated({ text: repeated[0] }), detail: m.rv_pdf_repeated_d() })
  } else {
    out.push({ id: 'pdf-repeated', category: 'okunabilirlik', severity: 'ok', title: m.rv_pdf_repeated_ok(), detail: m.rv_pdf_repeated_ok_d() })
  }
}

/** extractPdfText hatası için tek bulgu (metin yoksa ATS hiçbir şey okuyamaz). */
export function pdfErrorFinding(code: 'not_pdf' | 'encrypted' | 'no_text' | 'unreadable' | 'too_long' | 'too_large'): Finding {
  const map = {
    not_pdf: [m.rv_pdf_err_not_pdf(), m.rv_pdf_err_not_pdf_d()],
    encrypted: [m.rv_pdf_err_encrypted(), m.rv_pdf_err_encrypted_d()],
    no_text: [m.rv_pdf_err_no_text(), m.rv_pdf_err_no_text_d()],
    unreadable: [m.rv_pdf_err_unreadable(), m.rv_pdf_err_unreadable_d()],
    too_long: [m.fix_pdf_too_long_title(), m.fix_pdf_too_long_body({ max: MAX_PDF_PAGES })],
    too_large: [m.imp_err_too_large_title(), m.imp_err_too_large_body()],
  } as const
  const [title, detail] = map[code]
  return { id: `pdf-error-${code}`, category: 'okunabilirlik', severity: 'problem', title, detail }
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
}
