/**
 * Bileşen vitrini — YALNIZ geliştirmede (`/_ui`, router'da `import.meta.env.DEV` koşulu; üretim paketine girmez).
 * Bütün ortak bileşenler ve durumları (dinlenme / hover / basılı / odak / devre dışı), açık ve koyu temada.
 * Hover/basılı/odak durumları aynı sınıflar zorlanarak çizilir; gerçek etkileşim yanındaki canlı örnekte.
 * Buradaki örnek metinler geliştirici aracıdır (kullanıcıya gösterilmez); ürün metni yine messages/*.json'da.
 */
import {
  ArrowUp,
  Copy,
  Eye,
  FileText,
  Maximize2,
  Minus,
  MoreHorizontal,
  Plus,
  Redo2,
  Settings,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { usePrefs } from '@/lib/prefs'
import { getLocale } from '@/paraglide/runtime'
import { Badge, Kbd } from '../Badge'
import { Button } from '../Button'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../buttonClass'
import { Checkbox, RadioGroup, RadioItem, RadioRow } from '../Checkbox'
import { Dialog } from '../Dialog'
import { Disclosure, OutlineRow } from '../Disclosure'
import { DragHandle } from '../DragHandle'
import { DropZone, EmptyState } from '../EmptyState'
import { BareInput, Field, Input, Select, Textarea } from '../Field'
import { FormRow, Group, GroupRow } from '../Group'
import { IconButton } from '../IconButton'
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '../Menu'
import { NavPills, navPillClass } from '../NavPills'
import { FloatingNotice, InlineNotice } from '../Notice'
import { Popover, PopoverContent, PopoverTrigger } from '../Popover'
import { SearchField } from '../SearchField'
import { Segmented } from '../Segmented'
import { SelectMenu } from '../SelectMenu'
import { Sheet } from '../Sheet'
import { Spinner } from '../Spinner'
import { Swatches } from '../Swatches'
import { Switch } from '../Switch'
import { toast } from '../toast'
import { FloatingPill, PillDivider, Toolbar, ToolbarGroup, ToolbarSection } from '../Toolbar'
import { useScrollEdge } from '../useScrollEdge'
import { ACCENTS, type AccentId } from '@/lib/prefs'

const forced: Record<'hover' | 'pressed', Record<ButtonVariant, string>> = {
  hover: {
    primary: 'bg-accent-hover',
    secondary: 'bg-fill-2',
    plain: 'bg-fill-4',
    ghost: 'bg-fill-4',
    quiet: 'bg-fill-4',
    destructive: 'bg-fill-2',
    danger: 'bg-fill-2',
  },
  pressed: {
    primary: 'bg-accent-pressed scale-[.97]',
    secondary: 'bg-fill-1 scale-[.97]',
    plain: 'bg-fill-3 scale-[.97]',
    ghost: 'bg-fill-3 scale-[.97]',
    quiet: 'bg-fill-3 scale-[.97]',
    destructive: 'bg-fill-1 scale-[.97]',
    danger: 'bg-fill-1 scale-[.97]',
  },
}
const focusRing = 'outline-3 outline-solid outline-[var(--focus-ring)] outline-offset-1'

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} data-showcase={id} className="scroll-mt-16 border-t border-separator pt-8">
      <h2 className="mb-5 text-title-2 text-fg">{title}</h2>
      <div className="-mx-2 overflow-x-auto px-2 py-1">{children}</div>
    </section>
  )
}

function Swatch({ name, varName, text }: { name: string; varName: string; text?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="size-10 shrink-0 rounded-md shadow-[inset_0_0_0_1px_var(--separator)]"
        style={{ background: text ? 'var(--bg-content)' : `var(${varName})` }}
      >
        {text && (
          <span className="flex size-full items-center justify-center text-title-3" style={{ color: `var(${varName})` }}>
            Aa
          </span>
        )}
      </span>
      <span className="flex flex-col">
        <span className="text-body text-fg">{name}</span>
        <code className="text-callout text-fg-2">{varName}</code>
      </span>
    </div>
  )
}

function ButtonMatrix({ size }: { size: ButtonSize }) {
  const variants: ButtonVariant[] = ['primary', 'secondary', 'plain', 'ghost', 'destructive']
  const states = ['rest', 'hover', 'pressed', 'focus', 'disabled'] as const
  return (
    <div className="grid grid-cols-[96px_repeat(5,auto)] items-center justify-start gap-x-4 gap-y-3" data-size={size}>
      <span />
      {states.map((s) => (
        <span key={s} className="text-callout text-fg-2">
          {s}
        </span>
      ))}
      {variants.map((v) => (
        <Row key={v} label={v}>
          {states.map((s) => (
            <button
              key={s}
              type="button"
              disabled={s === 'disabled'}
              data-variant={v}
              data-state-demo={s}
              className={buttonClass({
                variant: v,
                size,
                className: cn(s === 'hover' && forced.hover[v], s === 'pressed' && forced.pressed[v], s === 'focus' && focusRing),
              })}
            >
              {size !== 'sm' && v === 'plain' && <Plus />}
              {v === 'destructive' ? 'Sil' : v === 'primary' ? 'PDF al' : v === 'plain' ? 'Deneyim ekle' : 'Vazgeç'}
            </button>
          ))}
        </Row>
      ))}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="text-callout text-fg-2">{label}</span>
      {children}
    </>
  )
}

function ScrollToolbarDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const scrolled = useScrollEdge(ref)
  return (
    <div ref={ref} data-demo="toolbar" className="relative h-64 overflow-y-auto rounded-xl bg-canvas shadow-1">
      <Toolbar scrolled={scrolled} className="sticky top-0 px-3">
        <ToolbarSection grow>
          <IconButton label="CV'lerim" icon={<span className="text-title-2 leading-none">‹</span>} />
          <span className="text-title-3">Genel TR</span>
          <Badge>TR</Badge>
          <span className="text-callout">Kaydedildi</span>
        </ToolbarSection>
        <ToolbarSection>
          <ToolbarGroup aria-label="geri al">
            <IconButton label="Geri al" shortcut="Ctrl+Z" icon={<Undo2 />} />
            <IconButton label="Yinele" shortcut="Ctrl+Shift+Z" icon={<Redo2 />} />
          </ToolbarGroup>
          <span className="text-body">1 sayfa</span>
          <ToolbarGroup aria-label="diğer">
            <IconButton label="Ayarlar" icon={<Settings />} />
            <IconButton label="Diğer işlemler" icon={<MoreHorizontal />} />
          </ToolbarGroup>
          <Button variant="primary" size="lg">
            PDF al
          </Button>
        </ToolbarSection>
      </Toolbar>
      <div className="mx-auto mt-6 mb-8 h-[420px] w-72 bg-paper p-6 shadow-page">
        <div className="h-6 w-40 bg-[#1d1d1f]" />
        <div className="mt-3 h-3 w-56 bg-[#00786f]" />
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="mt-3 h-2 bg-[#d1d1d6]" style={{ width: `${60 + ((i * 17) % 40)}%` }} />
        ))}
      </div>
      <FloatingPill aria-label="zoom" className="sticky bottom-4 left-full mr-4 mb-4 float-right">
        <IconButton label="Uzaklaştır" icon={<Minus />} />
        <span className="w-10 text-center text-body tabular-nums">68%</span>
        <IconButton label="Yakınlaştır" icon={<Plus />} />
        <PillDivider />
        <Button variant="ghost" size="md" className="rounded-full">
          <Maximize2 /> Sığdır
        </Button>
      </FloatingPill>
    </div>
  )
}

export function UiShowcase() {
  const theme = usePrefs((s) => s.theme)
  const setTheme = usePrefs((s) => s.setTheme)
  const accent = usePrefs((s) => s.accent)
  const setAccent = usePrefs((s) => s.setAccent)
  const [seg, setSeg] = useState('content')
  const [lang, setLang] = useState('tr')
  const [size, setSize] = useState('md')
  const [on, setOn] = useState(true)
  const [off, setOff] = useState(false)
  const [chk, setChk] = useState(true)
  const [radio, setRadio] = useState('blank')
  const [font, setFont] = useState('inter')
  const [native, setNative] = useState('2024')
  const [query, setQuery] = useState('')
  const [openRow, setOpenRow] = useState<string | null>('a')
  const [dialog, setDialog] = useState(false)
  const [dialogNoFooter, setDialogNoFooter] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [nav, setNav] = useState('cvs')
  const [menuCheck, setMenuCheck] = useState(true)
  const [drag, setDrag] = useState(false)

  return (
    <div className="min-h-dvh bg-window text-fg">
      <Toolbar className="sticky top-0 flex-wrap px-4 sm:px-6" scrolled>
        <ToolbarSection grow>
          <span className="text-title-3">UI vitrini</span>
          <Badge>{getLocale().toUpperCase()}</Badge>
          <NavPills aria-label="demo-nav" className="ml-6 max-md:hidden">
            {['cvs', 'templates', 'review'].map((k) => (
              <a
                key={k}
                href={`#${k}`}
                aria-current={nav === k ? 'page' : undefined}
                className={navPillClass}
                onClick={(e) => {
                  e.preventDefault()
                  setNav(k)
                }}
              >
                {k === 'cvs' ? "CV'lerim" : k === 'templates' ? 'Şablonlar' : 'İnceleme'}
              </a>
            ))}
          </NavPills>
        </ToolbarSection>
        <ToolbarSection>
          <Segmented
            aria-label="tema"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Açık' },
              { value: 'dark', label: 'Koyu' },
            ]}
          />
        </ToolbarSection>
      </Toolbar>

      <main className="mx-auto flex max-w-[1240px] min-w-0 flex-col gap-12 px-4 pt-8 pb-24 sm:px-6">
        <header>
          <h1 className="text-title-lg">Bileşenler</h1>
          <p className="mt-1 text-body text-fg-2">Token ve ortak bileşenler; DESIGN.md ile aynı değerler.</p>
        </header>

        <Section id="tokens-color" title="Renk token'ları">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {[
              ['Pencere', '--bg-window'],
              ['Tuval', '--bg-canvas'],
              ['İçerik', '--bg-content'],
              ['Yükseltilmiş', '--bg-elevated'],
              ['Dolgu 1', '--fill-1'],
              ['Dolgu 2', '--fill-2'],
              ['Dolgu 3', '--fill-3'],
              ['Dolgu 4', '--fill-4'],
              ['Ayırıcı', '--separator'],
              ['Ayırıcı güçlü', '--separator-strong'],
              ['Kontrol kenarı', '--control-border'],
              ['Vurgu', '--accent'],
              ['Vurgu yumuşak', '--accent-soft'],
              ['Odak halkası', '--focus-ring'],
              ['Uyarı yumuşak', '--warn-soft'],
              ['Öneri', '--suggest'],
            ].map(([n, v]) => (
              <Swatch key={v} name={n} varName={v} />
            ))}
            {[
              ['Metin 1', '--text-1'],
              ['Metin 2', '--text-2'],
              ['Metin 3 (süs)', '--text-3'],
              ['Vurgu metni', '--accent'],
              ['Tehlike', '--danger'],
              ['Uyarı', '--warn'],
              ['Tamam', '--ok'],
            ].map(([n, v]) => (
              <Swatch key={v + 't'} name={n} varName={v} text />
            ))}
          </div>
          <div className="mt-6 flex items-center gap-4">
            <span className="text-body text-fg-2">Vurgu</span>
            <Swatches
              aria-label="vurgu"
              value={accent}
              onChange={(v) => setAccent(v as AccentId)}
              options={ACCENTS.map((a) => ({ value: a.id, color: theme === 'dark' ? a.dark : a.color, label: a.id }))}
            />
          </div>
        </Section>

        <Section id="tokens-type" title="Yazı ölçeği">
          <div className="flex flex-col gap-3" data-demo="type">
            {(
              [
                ['title-lg', 'text-title-lg', 'CV’lerim 26/32 700'],
                ['title-1', 'text-title-1', 'Henüz CV yok 22/28 700'],
                ['title-2', 'text-title-2', 'Dialog başlığı 17/22 600'],
                ['title-3', 'text-title-3', 'Kişisel bilgiler 15/20 600'],
                ['headline', 'text-headline', 'Açık kayıt başlığı 13/18 600'],
                ['body', 'text-body', 'Satır metni, alan değeri, menü 13/18 400 — ş ğ ı İ ç ö ü'],
                ['body-user', 'text-body-user', 'Kullanıcının yazdığı metin 14/21 400'],
                ['callout', 'text-callout', 'Açıklama, yardım metni, ipucu 12/16 400'],
                ['caption', 'text-caption', 'TR · EN · Örnek 11/14 500'],
              ] as const
            ).map(([n, cls, sample]) => (
              <div key={n} className="grid grid-cols-[120px_1fr] items-baseline gap-4">
                <code className="text-callout text-fg-2">{n}</code>
                <span data-role={n} className={cls}>
                  {sample}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="tokens-shape" title="Yarıçap ve gölge">
          <div className="flex flex-wrap items-end gap-6">
            {(
              [
                'rounded-xs',
                'rounded-sm',
                'rounded-md',
                'rounded-lg',
                'rounded-xl',
                'rounded-2xl',
                'rounded-3xl',
                'rounded-full',
              ] as const
            ).map((r) => (
              <div key={r} className="flex flex-col items-center gap-2">
                <span className={cn('size-14 bg-content shadow-2', r)} />
                <code className="text-callout text-fg-2">{r}</code>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-end gap-8 rounded-xl bg-window p-6">
            {(['shadow-1', 'shadow-2', 'shadow-3', 'shadow-4', 'shadow-page', 'shadow-thumb'] as const).map((s) => (
              <div key={s} className="flex flex-col items-center gap-3">
                <span className={cn('size-20 rounded-xl bg-content', s)} />
                <code className="text-callout text-fg-2">{s}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section id="buttons" title="Düğme">
          <div className="flex flex-col gap-8">
            {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
              <div key={s}>
                <h3 className="mb-3 text-headline">size={s}</h3>
                <ButtonMatrix size={s} />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2" data-demo="button-live">
              <Button variant="primary" size="lg">
                Bu şablonla başla
              </Button>
              <Button size="lg">Vazgeç</Button>
              <Button variant="primary" size="lg" loading>
                Gönderiliyor
              </Button>
              <Button variant="plain">
                <Plus /> Deneyim ekle
              </Button>
              <Button size="md">Yeniden adlandır…</Button>
            </div>
          </div>
        </Section>

        <Section id="icon-buttons" title="İkon düğmesi ve araç çubuğu grubu">
          <div className="flex flex-wrap items-center gap-6" data-demo="icon-buttons">
            <div className="flex items-center gap-1">
              <IconButton label="Göster" icon={<Eye />} />
              <IconButton label="Diğer işlemler" icon={<MoreHorizontal />} className={forced.hover.ghost} />
              <IconButton label="Kopyala" icon={<Copy />} className={forced.pressed.ghost} />
              <IconButton label="Açık" icon={<FileText />} active />
              <IconButton label="Odak" icon={<Settings />} className={focusRing} />
              <IconButton label="Devre dışı" icon={<Trash2 />} disabled />
            </div>
            <div className="flex items-center gap-1">
              <IconButton size="sm" label="Küçük" icon={<Plus />} />
              <IconButton size="lg" label="Büyük" icon={<Plus />} />
              <IconButton variant="primary" label="Gönder" icon={<ArrowUp />} className="rounded-full" />
            </div>
            <ToolbarGroup aria-label="geri al">
              <IconButton label="Geri al" shortcut="Ctrl+Z" icon={<Undo2 />} />
              <IconButton label="Yinele" shortcut="Ctrl+Shift+Z" icon={<Redo2 />} />
            </ToolbarGroup>
            <DragHandle className="h-11" />
            <Spinner className="text-fg-2" />
          </div>
        </Section>

        <Section id="toolbar" title="Araç çubuğu (malzeme), kaydırma kenarı, zoom hapı">
          <ScrollToolbarDemo />
        </Section>

        <Section id="controls" title="Segmented, anahtar, onay kutusu, radyo">
          <div className="flex flex-col gap-6" data-demo="controls">
            <div className="flex flex-wrap items-center gap-4">
              <Segmented
                size="sm"
                aria-label="sm"
                value={size}
                onChange={setSize}
                options={[
                  { value: 'sm', label: 'Yan' },
                  { value: 'md', label: 'Ana' },
                ]}
              />
              <Segmented
                aria-label="sekme"
                value={seg}
                onChange={setSeg}
                options={[
                  { value: 'content', label: 'İçerik' },
                  { value: 'appearance', label: 'Görünüm' },
                ]}
              />
              <Segmented
                size="lg"
                aria-label="dil"
                value={lang}
                onChange={setLang}
                options={[
                  { value: 'tr', label: 'Türkçe' },
                  { value: 'en', label: 'English' },
                  { value: 'x', label: 'Kapalı', disabled: true },
                ]}
              />
              <div className="w-80">
                <Segmented
                  stretch
                  aria-label="boyut"
                  value={size}
                  onChange={setSize}
                  options={[
                    { value: 'sm', label: 'Küçük' },
                    { value: 'md', label: 'Normal' },
                    { value: 'lg', label: 'Büyük' },
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Switch checked={on} onCheckedChange={setOn} aria-label="açık" />
              <Switch checked={off} onCheckedChange={setOff} aria-label="kapalı" />
              <Switch checked disabled onCheckedChange={() => {}} aria-label="devre dışı açık" />
              <Switch checked={false} disabled onCheckedChange={() => {}} aria-label="devre dışı kapalı" />
              <Checkbox checked={chk} onCheckedChange={setChk} label="Devam ediyor" />
              <Checkbox checked={false} onCheckedChange={() => {}} label="Boş" />
              <Checkbox checked="indeterminate" onCheckedChange={() => {}} label="Karışık" />
              <Checkbox checked disabled onCheckedChange={() => {}} label="Devre dışı" />
            </div>
            <RadioGroup aria-label="radyo" value={radio} onValueChange={setRadio} orientation="horizontal">
              <RadioItem value="blank" label="Boş CV" />
              <RadioItem value="import" label="İçe aktar" description="PDF'ten" />
              <RadioItem value="copy" label="Kopyala" disabled />
            </RadioGroup>
          </div>
        </Section>

        <Section id="fields" title="Metin alanı, açılır düğme, arama">
          <div className="grid gap-6 md:grid-cols-2" data-demo="fields">
            <div className="flex flex-col gap-4 rounded-xl bg-window p-4">
              <Field label="CV adı (pencere zemininde)" hint="Listede böyle görünür.">
                {(id) => <Input id={id} defaultValue="Genel TR" />}
              </Field>
              <Field label="Yer tutucu">{(id) => <Input id={id} placeholder="ör. Frontend stajı" />}</Field>
              <Field label="Hatalı" error="Bitiş tarihi başlangıçtan önce">
                {(id) => <Input id={id} aria-invalid defaultValue="2019" aria-describedby={`${id}-error`} />}
              </Field>
              <Field label="Devre dışı">{(id) => <Input id={id} disabled defaultValue="Kilitli" />}</Field>
              <Field label="Native select">
                {(id) => (
                  <Select id={id} value={native} onChange={(e) => setNative(e.target.value)}>
                    <option>2024</option>
                    <option>2023</option>
                  </Select>
                )}
              </Field>
              <SearchField
                aria-label="CV ara"
                placeholder="CV ara"
                value={query}
                onValueChange={setQuery}
                shortcut="/"
                wrapperClassName="w-60"
              />
            </div>
            <div className="flex flex-col gap-4 rounded-xl bg-content p-4 shadow-1">
              <Field label="Beyaz yüzeyde (dolgulu)">
                {(id) => <Input id={id} className="bg-fill-3 shadow-none" defaultValue="Genel EN" />}
              </Field>
              <Field label="Küçük (28px)">{(id) => <Input id={id} controlSize="sm" defaultValue="İzmir" />}</Field>
              <Field label="İş ilanı">{(id) => <Textarea id={id} rows={3} placeholder="İlanın tamamını buraya yapıştır" />}</Field>
              <div className="flex items-center gap-3">
                <SelectMenu
                  aria-label="yazı tipi"
                  value={font}
                  onValueChange={setFont}
                  groups={[
                    {
                      label: 'Tırnaksız',
                      options: [
                        { value: 'inter', label: 'Inter' },
                        { value: 'plex', label: 'IBM Plex Sans' },
                      ],
                    },
                    { label: 'Tırnaklı', options: [{ value: 'garamond', label: 'EB Garamond' }] },
                  ]}
                />
                <SelectMenu
                  bare
                  size="sm"
                  aria-label="kapsam"
                  value="all"
                  onValueChange={() => {}}
                  options={[
                    { value: 'all', label: 'Tüm CV' },
                    { value: 'one', label: 'Yalnız bu kayıt' },
                  ]}
                />
              </div>
            </div>
          </div>
        </Section>

        <Section id="groups" title="Grup, satır, form satırı, anahat satırı">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-8 rounded-xl bg-window p-4" data-demo="settings-group">
              <Group size="settings" inset="lg" title="Görünüm" footer="CV sayfaları her zaman beyaz kâğıt olarak görünür.">
                <GroupRow
                  title="Arayüz dili"
                  description="Menüler ve düğmeler bu dilde."
                  trailing={
                    <Segmented
                      aria-label="arayüz dili"
                      value={lang}
                      onChange={setLang}
                      options={[
                        { value: 'tr', label: 'Türkçe' },
                        { value: 'en', label: 'English' },
                      ]}
                    />
                  }
                />
                <GroupRow
                  title="Koyu tema"
                  htmlFor="sw-dark"
                  trailing={<Switch id="sw-dark" checked={theme === 'dark'} onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')} />}
                />
                <GroupRow
                  title="Vurgu rengi"
                  trailing={
                    <Swatches
                      aria-label="vurgu"
                      value={accent}
                      onChange={(v) => setAccent(v as AccentId)}
                      options={ACCENTS.map((a) => ({ value: a.id, color: theme === 'dark' ? a.dark : a.color, label: a.id }))}
                    />
                  }
                />
              </Group>
              <Group size="settings" inset="lg" title="Veri ve yedek">
                <GroupRow title="Bütün CV'leri yedekle" trailing={<Button>1 CV'yi yedekle</Button>} />
                <GroupRow title="Klavye kısayolları" onClick={() => {}} trailing="12" />
                <GroupRow title="Seçili satır" selected onClick={() => {}} />
                <GroupRow
                  leading={<Settings />}
                  title="İkonlu satır: ayırıcı metnin x'inden başlar"
                  description="Uzun açıklama sarar, satır büyür; üç nokta ile kesilmez. Uzun açıklama sarar, satır büyür."
                />
              </Group>
            </div>
            <div className="flex flex-col gap-6 rounded-xl bg-window p-4" data-demo="inspector-group">
              <Group title="Kişisel bilgiler">
                <FormRow label="Ad soyad">{(id) => <BareInput id={id} defaultValue="Deniz Aksoy" />}</FormRow>
                <FormRow label="Unvan">{(id) => <BareInput id={id} defaultValue="Frontend Geliştirici" />}</FormRow>
                <FormRow label="E-posta">{(id) => <BareInput id={id} placeholder="ad@example.com" />}</FormRow>
                <FormRow label="Telefon" error="Telefon numarası eksik görünüyor">
                  {(id, d) => <BareInput id={id} aria-invalid aria-describedby={d} defaultValue="+90 555" />}
                </FormRow>
                <FormRow label="Yazı tipi">
                  {(id) => (
                    <SelectMenu
                      id={id}
                      bare
                      value={font}
                      onValueChange={setFont}
                      options={[
                        { value: 'inter', label: 'Inter' },
                        { value: 'garamond', label: 'EB Garamond' },
                      ]}
                    />
                  )}
                </FormRow>
              </Group>
              <Group
                title="Deneyim"
                count={3}
                leading={<DragHandle className="h-7" />}
                actions={
                  <>
                    <Button variant="plain" size="sm">
                      <Plus /> Ekle
                    </Button>
                    <IconButton label="Gizle" icon={<Eye />} />
                    <IconButton label="Bölüm işlemleri" icon={<MoreHorizontal />} />
                  </>
                }
              >
                {(
                  [
                    ['a', 'Frontend Geliştirici', 'Lacivert Yazılım · Şub 2024 – Günümüz'],
                    ['b', 'Yazılım Stajyeri', 'Martı Teknoloji · Haz – Eyl 2023'],
                    ['c', 'Serbest Web Geliştirici ve uzun bir unvan sararak iki satıra iner', '2021 – 2023'],
                  ] as const
                ).map(([key, t, meta]) => (
                  <OutlineRow
                    key={key}
                    title={t}
                    meta={meta}
                    hidden={key === 'b'}
                    open={openRow === key}
                    onOpenChange={(o) => setOpenRow(o ? key : null)}
                    leading={<DragHandle />}
                    actions={
                      <>
                        <IconButton label="Gizle" icon={<Eye />} />
                        <IconButton label="Kayıt işlemleri" icon={<MoreHorizontal />} />
                      </>
                    }
                  >
                    <FormRow label="Pozisyon">{(id) => <BareInput id={id} defaultValue={t} />}</FormRow>
                    <FormRow label="Şirket">{(id) => <BareInput id={id} defaultValue="Lacivert Yazılım" />}</FormRow>
                  </OutlineRow>
                ))}
                <div className="px-1 py-1">
                  <Button variant="plain" className="w-full justify-start">
                    <Plus /> Deneyim ekle
                  </Button>
                </div>
              </Group>
              <Group title="Başlangıç">
                <RadioGroupRows value={radio} onChange={setRadio} />
              </Group>
              <Disclosure summary="Geçen 24 kontrol">
                <p className="text-body text-fg-2">Açılınca kategorili liste.</p>
              </Disclosure>
            </div>
          </div>
        </Section>

        <Section id="overlays" title="Menü, popover, ipucu, dialog, alt sayfa, bildirim">
          <div className="flex flex-wrap items-center gap-3" data-demo="overlays">
            <Menu>
              <MenuTrigger asChild>
                <Button data-demo="menu-trigger">Menü</Button>
              </MenuTrigger>
              <MenuContent align="start">
                <MenuLabel>Kayıt</MenuLabel>
                <MenuItem icon={<Copy />} shortcut="Ctrl+D">
                  Kopyasını ekle
                </MenuItem>
                <MenuItem icon={<FileText />}>Başka CV'ye ekle…</MenuItem>
                <MenuItem icon={<Eye />} disabled hint="Yakında">
                  Devre dışı öğe
                </MenuItem>
                <MenuSeparator />
                <MenuCheckboxItem checked={menuCheck} onCheckedChange={setMenuCheck}>
                  Koyu tema
                </MenuCheckboxItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger>
                  Sil
                </MenuItem>
              </MenuContent>
            </Menu>
            <Popover>
              <PopoverTrigger asChild>
                <Button data-demo="popover-trigger">Popover</Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72">
                <p className="text-headline">CV dili: Türkçe</p>
                <p className="mt-1 text-callout text-fg-2">Bölüm başlıkları ve tarihler bu dilde.</p>
                <Button variant="plain" className="mt-2 -ml-3">
                  İngilizceye çevir…
                </Button>
              </PopoverContent>
            </Popover>
            <IconButton label="Geri al" shortcut="Ctrl+Z" icon={<Undo2 />} data-demo="tooltip-trigger" />
            <Button data-demo="dialog-trigger" onClick={() => setDialog(true)}>
              Dialog
            </Button>
            <Button onClick={() => setDialogNoFooter(true)}>Dialog (eylemsiz)</Button>
            <Button data-demo="sheet-trigger" onClick={() => setSheet(true)}>
              Alt sayfa
            </Button>
            <Button
              data-demo="toast-trigger"
              onClick={() => toast({ message: 'CV silindi', action: { label: 'Geri al', run: () => {} } })}
            >
              Bildirim
            </Button>
            <Button onClick={() => toast({ message: 'Kaydedilemedi. Yeniden dene.', tone: 'error' })}>Hata bildirimi</Button>
          </div>
          <Dialog
            open={dialog}
            onOpenChange={setDialog}
            title="CV silinsin mi?"
            description="Genel TR silinecek. Hemen ardından geri alabilirsin."
            footer={
              <>
                <Button size="lg" onClick={() => setDialog(false)} autoFocus>
                  Vazgeç
                </Button>
                <Button size="lg" variant="destructive" onClick={() => setDialog(false)}>
                  Sil
                </Button>
              </>
            }
          >
            <Field label="Onay için CV adını yaz">{(id) => <Input id={id} className="bg-fill-3 shadow-none" />}</Field>
          </Dialog>
          <Dialog open={dialogNoFooter} onOpenChange={setDialogNoFooter} title="Ne gönderilir?">
            <p className="text-body text-fg-2">Giden: Özet, Deneyim (3 kayıt). Gitmeyen: ad soyad, e-posta, telefon.</p>
          </Dialog>
          <Sheet open={sheet} onOpenChange={setSheet} title="Genel TR">
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="xl" className="w-full">
                PDF al
              </Button>
              <Button variant="plain" size="xl" className="w-full" onClick={() => setSheet(false)}>
                Vazgeç
              </Button>
            </div>
          </Sheet>
        </Section>

        <Section id="misc" title="Rozet, kbd, boş durum, uyarı kapsülü, bırakma alanı">
          <div className="flex flex-col gap-6" data-demo="misc">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>TR</Badge>
              <Badge>EN</Badge>
              <Badge tone="warn">Örnek</Badge>
              <Badge>Gizli</Badge>
              <Kbd>/</Kbd>
              <Kbd>Ctrl+Z</Kbd>
            </div>
            <div className="flex flex-col items-start gap-3 rounded-xl bg-canvas p-6">
              <FloatingNotice role="status" action={<Button variant="plain">Kayda git</Button>}>
                1 kayıt bir sayfadan uzun: <strong>Frontend Geliştirici</strong>
              </FloatingNotice>
              <FloatingNotice tone="info">Düzenlemek için bilgisayardan aç.</FloatingNotice>
            </div>
            <InlineNotice tone="ok">Chromium tabanlı tarayıcı kullanıyorsun.</InlineNotice>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-content shadow-1">
                <EmptyState
                  icon={FileText}
                  title="Henüz CV yok"
                  description="Bir şablon seç, bilgilerini gir; PDF'in hazır."
                  actions={
                    <>
                      <Button variant="primary" size="lg">
                        Şablon seç
                      </Button>
                      <Button size="lg">Eski CV'ni içe aktar</Button>
                    </>
                  }
                />
              </div>
              <DropZone
                active={drag}
                onDragEnter={() => setDrag(true)}
                onDragLeave={() => setDrag(false)}
                onClick={() => setDrag((d) => !d)}
                className="flex min-h-40 items-center justify-center text-body text-fg-2"
              >
                {drag ? 'Bırak' : 'PDF dosyanı sürükle ya da tıkla (tıklayınca etkin durum)'}
              </DropZone>
            </div>
          </div>
        </Section>
      </main>
    </div>
  )
}

function RadioGroupRows({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <RadioGroupRaw value={value} onChange={onChange}>
      <RadioRow value="blank" selected={value === 'blank'} title="Boş CV" description="Bölümleri sen doldurursun." />
      <RadioRow value="import" selected={value === 'import'} title="Eski CV'yi içe aktar (PDF)" description="Bulunan kayıtları önce gözden geçirirsin.">
        <Button size="sm">PDF seç…</Button>
      </RadioRow>
      <RadioRow value="copy" disabled selected={false} title="Mevcut bir CV'den kopyala" description="Kopyalanacak CV henüz yok." />
    </RadioGroupRaw>
  )
}

function RadioGroupRaw({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <RadioGroup aria-label="başlangıç" value={value} onValueChange={onChange} className="group-rows gap-0">
      {children}
    </RadioGroup>
  )
}
