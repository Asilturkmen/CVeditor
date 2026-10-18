import { cloneElement, Fragment, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { formatDateRange, formatYearMonth } from '@/cv/dates'
import { isItemEmpty } from '@/cv/factory'
import { NAME_PLACEHOLDER, sectionTitle } from '@/cv/locale'
import type { AnyItem, Cv, CvLanguage, Section } from '@/cv/schema'
import { diffHtml, diffText } from './diff'
import { displayUrl, isRichTextEmpty, sanitizeDiffHtml, sanitizeRichText, toHref } from './richtext'
import { nameMetrics } from './nameMetrics'
import { getTemplate, supportedColumns } from './templates'
import { visibleSections } from './visibleSections'

/**
 * CV'nin "kaynak" HTML'i. Sayfalama (paginate.ts) bu kaynaktaki blokları
 * ([data-block]) A4 sayfalarına dağıtır. Aynı HTML önizlemede ve PDF'te
 * kullanılır; DOM sırası okuma sırasıdır (ATS), CSS ile yer değiştirme yok.
 */

export interface FieldSuggestion {
  id: string
  before: string
  after: string
  rich: boolean
}
export interface AddedItemSuggestion {
  id: string
  afterItemId: string | null
  item: AnyItem
}

/** Önizlemede işaretlenecek bekleyen öneriler. */
export interface SuggestionMap {
  /** Anahtar: `${itemId|'personal'}:${alan}` */
  fields: Map<string, FieldSuggestion>
  /** Bölüm id'si → eklenecek kayıtlar (geçici, yeşil) */
  added?: Map<string, AddedItemSuggestion[]>
  /** Kayıt id'si → kaldırma önerisinin id'si (üstü çizili, kırmızı) */
  removed?: Map<string, string>
}

interface Ctx {
  lang: CvLanguage
  suggestions?: SuggestionMap
}

function Text({ ctx, target, field, value }: { ctx: Ctx; target: string; field: string; value: string }) {
  const sg = ctx.suggestions?.fields.get(`${target}:${field}`)
  if (sg) {
    return (
      <span className="sg" data-sg-id={sg.id} dangerouslySetInnerHTML={{ __html: diffText(sg.before, sg.after) }} />
    )
  }
  return <>{value}</>
}

function Rich({ ctx, target, field, value }: { ctx: Ctx; target: string; field: string; value: string }) {
  const sg = ctx.suggestions?.fields.get(`${target}:${field}`)
  if (sg) {
    const html = sanitizeDiffHtml(diffHtml(sanitizeRichText(sg.before), sanitizeRichText(sg.after)))
    return <div className="entry-body rich sg sg-block" data-sg-id={sg.id} dangerouslySetInnerHTML={{ __html: html }} />
  }
  if (isRichTextEmpty(value)) return null
  return <div className="entry-body rich" dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }} />
}

function hasSuggestion(ctx: Ctx, target: string, field: string) {
  return ctx.suggestions?.fields.has(`${target}:${field}`) ?? false
}

/** Boş olmayan parçaları " · " ile birleştirir; ayırıcı metin olarak kalır (ATS okur). */
function Joined({ parts }: { parts: ReactNode[] }) {
  const present = parts.filter((p) => p !== null && p !== false && p !== '')
  return (
    <>
      {present.map((p, i) => (
        <span key={i} className="part">
          {i > 0 && <span className="sep">{' ·'} </span>}
          {p}
        </span>
      ))}
    </>
  )
}

/**
 * Virgülle ayrılmış anahtar kelimeler: her biri `.kw`, ayırıcı `.kw-sep` (", " metin olarak
 * kalır; ATS "TypeScript, JavaScript" okur). Şablon kelimeleri çip gibi çizebilir; ayırıcıyı
 * gizlemek yerine görünür bırakmalı ya da zemin rengine boyamalı (metin silinmez).
 */
function Keywords({ value }: { value: string }) {
  const parts = value.split(/(,\s*)/)
  if (parts.length === 1) return <>{value}</>
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="kw-sep">
            {part}
          </span>
        ) : part.trim() ? (
          <span key={i} className="kw">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  )
}

function Link({ value }: { value: string }) {
  if (!value.trim()) return null
  return <a href={toHref(value)}>{displayUrl(value)}</a>
}

/** Bağlantı alanı; bekleyen öneri varsa bağlantı yerine fark gösterilir. */
function UrlField({ ctx, target, field, value }: { ctx: Ctx; target: string; field: string; value: string }) {
  return hasSuggestion(ctx, target, field) ? <Text ctx={ctx} target={target} field={field} value={value} /> : <Link value={value} />
}

function EntryHead({ title, date }: { title: ReactNode; date: string }) {
  return (
    <div className="entry-head">
      <div className="entry-title">{title}</div>
      {date && <div className="entry-date">{date}</div>}
    </div>
  )
}

function Sub({ children }: { children: ReactNode }) {
  return <div className="entry-sub">{children}</div>
}

function entryAttrs(section: Section, item: AnyItem, type: string) {
  return {
    className: `entry entry-${type}`,
    'data-block': '',
    'data-section-id': section.id,
    'data-item-id': item.id,
  }
}

function ItemBlock({ section, item, ctx }: { section: Section; item: AnyItem; ctx: Ctx }) {
  const { lang } = ctx
  const t = (field: string, value: string) => <Text ctx={ctx} target={item.id} field={field} value={value} />
  const v = (field: string, value: string) => (value || hasSuggestion(ctx, item.id, field) ? t(field, value) : null)
  const rich = (value: string) => <Rich ctx={ctx} target={item.id} field={section.type === 'summary' ? 'content' : 'description'} value={value} />

  switch (section.type) {
    case 'summary': {
      const it = item as Extract<Section, { type: 'summary' }>['items'][number]
      return <div {...entryAttrs(section, item, 'summary')}>{rich(it.content)}</div>
    }
    case 'experience': {
      const it = item as Extract<Section, { type: 'experience' }>['items'][number]
      return (
        <div {...entryAttrs(section, item, 'experience')}>
          <EntryHead title={<strong>{t('position', it.position)}</strong>} date={formatDateRange(it.dates, lang)} />
          {(it.company || it.location) && (
            <Sub>
              <Joined parts={[v('company', it.company), v('location', it.location)]} />
            </Sub>
          )}
          {rich(it.description)}
        </div>
      )
    }
    case 'education': {
      const it = item as Extract<Section, { type: 'education' }>['items'][number]
      const degreeSg = hasSuggestion(ctx, item.id, 'degree') || hasSuggestion(ctx, item.id, 'field')
      const degree = degreeSg ? (
        <>
          {v('degree', it.degree)}
          {(it.degree || hasSuggestion(ctx, item.id, 'degree')) && (it.field || hasSuggestion(ctx, item.id, 'field')) && ', '}
          {v('field', it.field)}
        </>
      ) : (
        [it.degree, it.field].filter(Boolean).join(', ')
      )
      return (
        <div {...entryAttrs(section, item, 'education')}>
          <EntryHead title={<strong>{t('school', it.school)}</strong>} date={formatDateRange(it.dates, lang)} />
          {(degree || it.location || it.grade) && (
            <Sub>
              <Joined parts={[degree, v('location', it.location), v('grade', it.grade)]} />
            </Sub>
          )}
          {rich(it.description)}
        </div>
      )
    }
    case 'projects': {
      const it = item as Extract<Section, { type: 'projects' }>['items'][number]
      return (
        <div {...entryAttrs(section, item, 'projects')}>
          <EntryHead
            title={
              <Joined parts={[<strong key="n">{t('name', it.name)}</strong>, v('role', it.role)]} />
            }
            date={formatDateRange(it.dates, lang)}
          />
          {(it.url || hasSuggestion(ctx, item.id, 'url')) && (
            <Sub>
              <UrlField ctx={ctx} target={item.id} field="url" value={it.url} />
            </Sub>
          )}
          {rich(it.description)}
        </div>
      )
    }
    case 'skills': {
      const it = item as Extract<Section, { type: 'skills' }>['items'][number]
      return (
        <div {...entryAttrs(section, item, 'skills')}>
          <div className="entry-line">
            {it.name && <strong className="line-label">{t('name', it.name)}: </strong>}
            <span className="line-value">
              {hasSuggestion(ctx, item.id, 'keywords') ? t('keywords', it.keywords) : <Keywords value={it.keywords} />}
            </span>
          </div>
        </div>
      )
    }
    case 'languages': {
      const it = item as Extract<Section, { type: 'languages' }>['items'][number]
      return (
        <div {...entryAttrs(section, item, 'languages')}>
          <div className="entry-line">
            <strong className="line-label">{t('name', it.name)}</strong>
            {it.level && (
              <span className="line-value">
                <span className="line-sep"> — </span>
                {t('level', it.level)}
              </span>
            )}
          </div>
        </div>
      )
    }
    case 'certificates': {
      const it = item as Extract<Section, { type: 'certificates' }>['items'][number]
      return (
        <div {...entryAttrs(section, item, 'certificates')}>
          <EntryHead title={<strong>{t('name', it.name)}</strong>} date={formatYearMonth(it.date, lang)} />
          {(it.issuer || it.url) && (
            <Sub>
              <Joined
                parts={[v('issuer', it.issuer), it.url || hasSuggestion(ctx, item.id, 'url') ? <UrlField key="url" ctx={ctx} target={item.id} field="url" value={it.url} /> : null]}
              />
            </Sub>
          )}
        </div>
      )
    }
    case 'awards': {
      const it = item as Extract<Section, { type: 'awards' }>['items'][number]
      return (
        <div {...entryAttrs(section, item, 'awards')}>
          <EntryHead title={<strong>{t('title', it.title)}</strong>} date={formatYearMonth(it.date, lang)} />
          {it.issuer && <Sub>{t('issuer', it.issuer)}</Sub>}
          {rich(it.description)}
        </div>
      )
    }
    case 'volunteer': {
      const it = item as Extract<Section, { type: 'volunteer' }>['items'][number]
      return (
        <div {...entryAttrs(section, item, 'volunteer')}>
          <EntryHead title={<strong>{t('role', it.role)}</strong>} date={formatDateRange(it.dates, lang)} />
          {(it.organization || it.location) && (
            <Sub>
              <Joined parts={[v('organization', it.organization), v('location', it.location)]} />
            </Sub>
          )}
          {rich(it.description)}
        </div>
      )
    }
    case 'references': {
      const it = item as Extract<Section, { type: 'references' }>['items'][number]
      return (
        <div {...entryAttrs(section, item, 'references')}>
          <div className="entry-head">
            <div className="entry-title">
              <strong>{t('name', it.name)}</strong>
            </div>
          </div>
          {(it.position || it.organization) && (
            <Sub>
              <Joined parts={[v('position', it.position), v('organization', it.organization)]} />
            </Sub>
          )}
          {(it.email || it.phone) && (
            <Sub>
              <Joined
                parts={[
                  hasSuggestion(ctx, item.id, 'email') ? t('email', it.email) : it.email ? <a key="email" href={toHref(it.email)}>{it.email}</a> : null,
                  hasSuggestion(ctx, item.id, 'phone') ? t('phone', it.phone) : it.phone ? <a key="phone" href={`tel:${it.phone.replace(/\s/g, '')}`}>{it.phone}</a> : null,
                ]}
              />
            </Sub>
          )}
        </div>
      )
    }
    case 'custom': {
      const it = item as Extract<Section, { type: 'custom' }>['items'][number]
      return (
        <div {...entryAttrs(section, item, 'custom')}>
          <EntryHead title={<strong>{t('title', it.title)}</strong>} date={formatDateRange(it.dates, lang)} />
          {(it.subtitle || it.location || it.url) && (
            <Sub>
              <Joined
                parts={[
                  v('subtitle', it.subtitle),
                  v('location', it.location),
                  it.url || hasSuggestion(ctx, item.id, 'url') ? <UrlField key="url" ctx={ctx} target={item.id} field="url" value={it.url} /> : null,
                ]}
              />
            </Sub>
          )}
          {rich(it.description)}
        </div>
      )
    }
  }
}

function SectionBlocks({ section, ctx }: { section: Section; ctx: Ctx }) {
  const items = (section.items as AnyItem[]).filter((i) => !i.hidden && !isItemEmpty(i))
  const added = ctx.suggestions?.added?.get(section.id) ?? []
  const removed = ctx.suggestions?.removed
  // Önerilen yeni kayıtlar yerlerine (afterItemId'nin ardına, yoksa sona) geçici olarak girer.
  const rows: { item: AnyItem; mark?: { className: string; id: string } }[] = items.map((item) => {
    const sgId = removed?.get(item.id)
    return { item, mark: sgId ? { className: 'sg-removed', id: sgId } : undefined }
  })
  for (const a of added) {
    const row = { item: a.item, mark: { className: 'sg-added', id: a.id } }
    let index = a.afterItemId ? rows.findIndex((r) => r.item.id === a.afterItemId) : -1
    if (index < 0) index = rows.length - 1
    while (index + 1 < rows.length && rows[index + 1].mark?.className === 'sg-added') index++
    rows.splice(index + 1, 0, row)
  }
  return (
    <>
      <h2 className="section-title" data-block="" data-keep-with-next="" data-section-id={section.id} data-section-type={section.type}>
        <span>{sectionTitle(ctx.lang, section.type, section.title)}</span>
      </h2>
      {rows.map(({ item, mark }) => {
        if (!mark) return <ItemBlock key={item.id} section={section} item={item} ctx={ctx} />
        // Kaydın kendi bloğu işaretlenir (sayfalama aynı bloğu taşır).
        const el = ItemBlock({ section, item, ctx }) as ReactElement<{ className: string }>
        return cloneElement(el, { key: item.id, className: `${el.props.className} sg ${mark.className}`, 'data-sg-id': mark.id } as never)
      })}
    </>
  )
}

/**
 * Bu uzunluktan (karakter) uzun iletişim öğesi `li.is-long` alır: başlığın tam satırına bile
 * sığmayabilir; yalnız o, son çare olarak satır sonunda bölünebilir (base.css). Gerisi bölünmez.
 */
const LONG_CONTACT = 64

function ContactList({ cv, ctx }: { cv: Cv; ctx: Ctx }) {
  const p = cv.personal
  const items: { node: ReactNode; length: number }[] = []
  const push = (field: keyof typeof p, node: ReactNode, shown = String(p[field] ?? '')) => {
    if (hasSuggestion(ctx, 'personal', field)) {
      items.push({ node: <Text ctx={ctx} target="personal" field={field} value={String(p[field] ?? '')} />, length: 0 })
    } else if (p[field]) items.push({ node, length: [...shown].length })
  }
  push('email', <a href={toHref(p.email)}>{p.email}</a>)
  push('phone', <a href={`tel:${p.phone.replace(/\s/g, '')}`}>{p.phone}</a>)
  push('location', <span>{p.location}</span>)
  push('website', <Link value={p.website} />, displayUrl(p.website))
  push('linkedin', <Link value={p.linkedin} />, displayUrl(p.linkedin))
  push('github', <Link value={p.github} />, displayUrl(p.github))
  if (items.length === 0) return null
  return (
    <ul className="cv-contact">
      {items.map(({ node, length }, i) => (
        // Her öğe bölünmez bir birim (adres ortasından satıra kırılmaz); liste yalnız öğeler
        // arasındaki boşlukta kırılır. Ayırıcı önceki öğeye yapışık, satır başında "·" kalmaz.
        <Fragment key={i}>
          {i > 0 && ' '}
          <li className={length > LONG_CONTACT ? 'is-long' : undefined}>
            {node}
            {i < items.length - 1 && <span className="sep">{' ·'}</span>}
          </li>
        </Fragment>
      ))}
    </ul>
  )
}

function Header({ cv, ctx, placeholders, photoHint }: { cv: Cv; ctx: Ctx; placeholders: boolean; photoHint?: string }) {
  const p = cv.personal
  const photo = cv.template.showPhoto ? p.photo : null
  // Fotoğraf açık ama yüklenmemiş: önizlemede fotoğraf yerinde kesikli kutu. Ekranda düzen
  // fotoğraflı hâldir; baskıda kutu `display:none` olur (base.css), PDF'e ve ATS metnine girmez.
  const photoSlot = !photo && placeholders && cv.template.showPhoto && !!photoHint
  const name = p.fullName.trim()
  const headerClass = ['cv-header', photo || photoSlot ? 'has-photo' : 'no-photo', photoSlot && 'photo-ph'].filter(Boolean).join(' ')
  // Boş adda önizleme yer tutucuyu çizer; boy da ona göre.
  const metrics = nameMetrics(name || (placeholders ? NAME_PLACEHOLDER[ctx.lang] : ''))
  const nameClass = ['cv-name', metrics.isLong && 'is-long', metrics.hasLongWord && 'has-long-word'].filter(Boolean).join(' ')
  const nameStyle = { '--name-longest': metrics.longest } as CSSProperties
  return (
    <header className={headerClass} data-block="" data-target="personal">
      {photo && <img className="cv-photo" src={photo} alt="" />}
      {photoSlot && (
        <div className="cv-photo ph ph-photo" aria-hidden="true">
          <span className="ph-photo-text">{photoHint}</span>
        </div>
      )}
      <div className="cv-identity">
        {/* Ad + unvan bir arada (ör. Çizelge: solda ad bloğu, sağda iletişim). DOM sırası aynı. */}
        <div className="cv-heading">
          <h1 className={nameClass} style={nameStyle}>
            {/* İç span: satır satır vurgu (Afiş'in fosforlu adı, box-decoration-break) */}
            <span className="cv-name-text">
              {name || (placeholders ? <span className="ph">{NAME_PLACEHOLDER[ctx.lang]}</span> : '')}
            </span>
          </h1>
          {(p.headline || hasSuggestion(ctx, 'personal', 'headline')) && (
            <p className="cv-headline">
              <Text ctx={ctx} target="personal" field="headline" value={p.headline} />
            </p>
          )}
        </div>
        {/* İletişim her düzende başlıkta (tam genişlik): dar yan sütunda adresler satıra bölünürdü. */}
        <ContactList cv={cv} ctx={ctx} />
      </div>
    </header>
  )
}

export function CvSource({
  cv,
  suggestions,
  placeholders = false,
  emptyHint,
  photoHint,
}: {
  cv: Cv
  suggestions?: SuggestionMap
  placeholders?: boolean
  /** Hiç içerik yokken önizlemede görünen soluk ipucu (baskıda gizli) */
  emptyHint?: string
  /** Fotoğraf yer tutucusunun yazısı ("Fotoğraf ekle"; baskıda gizli) */
  photoHint?: string
}) {
  const ctx: Ctx = { lang: cv.language, suggestions }
  // Bilinmeyen şablon (eski/bozuk kayıt) varsayılana, desteklenmeyen sütun sayısı desteklenene
  // düşer: çizim her zaman var olan bir şablonun gerçek düzenidir (cvStyles da aynı şablonu yükler).
  const template = getTemplate(cv.templateId)
  const two = supportedColumns(template, cv.template.columns) === 2
  // Boş bölüme önerilen kayıt da görünsün.
  const visible = new Set(visibleSections(cv))
  const sections = cv.sections.filter((s) => visible.has(s) || (!s.hidden && !!suggestions?.added?.get(s.id)?.length))
  const sideIds = new Set(two ? cv.template.sideSections : [])
  const side = sections.filter((s) => sideIds.has(s.id))
  const main = sections.filter((s) => !sideIds.has(s.id))

  return (
    <div className={`cv tpl-${template.id} cols-${two ? 2 : 1} align-${cv.template.headerAlign === 'center' ? 'center' : 'left'}`}>
      <div data-flow="header">
        <Header cv={cv} ctx={ctx} placeholders={placeholders} photoHint={photoHint} />
      </div>
      {two && (
        <div data-flow="side">
          {side.map((s) => (
            <SectionBlocks key={s.id} section={s} ctx={ctx} />
          ))}
        </div>
      )}
      <div data-flow="main">
        {main.map((s) => (
          <SectionBlocks key={s.id} section={s} ctx={ctx} />
        ))}
        {placeholders && emptyHint && sections.length === 0 && (
          <p className="ph ph-hint" data-block="">
            {emptyHint}
          </p>
        )}
      </div>
    </div>
  )
}
