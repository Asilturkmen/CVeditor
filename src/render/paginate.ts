/**
 * Kendi sayfalama kodumuz (Paged.js yerine). #cv-source'taki blokları
 * gerçek ölçerek A4 sayfalarına dağıtır:
 *
 * - Bir blok (kayıt) sayfaya sığıyorsa asla bölünmez; sığmazsa sonraki sayfaya geçer.
 * - Bölüm başlığı ([data-keep-with-next]) sayfanın dibinde yalnız kalmaz.
 * - Bir sayfadan uzun kayıt "oversized" olarak raporlanır ve madde/paragraf
 *   arasından bölünür; metin asla alttan kesilip kaybolmaz.
 * - Yetim/dul (SET-14 §5.5): bölünen kayıtta her iki sayfada en az 2 madde kalır (ilk parçada 2'den az
 *   madde kalacaksa kayıt sonraki sayfadan başlar; son madde tek başına sonraki sayfaya düşmez).
 *   Aynı bölümün ardışık kısa satır blokları (beceri, dil satırı: tek çocuğu `.entry-line`) bir
 *   dizidir: dizi bölünürse her iki sayfada en az 2 satır kalır; 2-3 satırlık dizi bölünmez, başlığıyla
 *   birlikte taşınır (bkz. keepLinesTogether).
 * - Tek bir paragraf bile sayfaya sığmıyorsa (çok nadir) "clipped" raporlanır.
 * - Başlık (ad, unvan, iletişim, fotoğraf) ilk sayfanın kutusundan taşıyorsa "headerClipped"
 *   (ve "clipped") raporlanır: başlık bölünmez, taşan kısmı sayfa kenarında kesilir.
 * - Ölçüm sürerken #cv-pages `data-measuring` taşır; base.css o sırada animasyonları kapatır
 *   (öneri ve yeni sayfa animasyonlarının `transform`'u ölçülen kutuları kaydırmasın).
 *
 * Bu dosya içe aktarma yapmaz; `paginate` gövdesi de yalnız parametrelerini ve sayfanın kendi
 * genel nesnelerini (Node, NodeFilter, getComputedStyle) kullanır, modül düzeyinde hiçbir şeye
 * başvurmaz: sunucuda `toString()` ile Playwright sayfasına enjekte edilir (bkz. pageScript.ts).
 * Sabitleri ve yardımcıları fonksiyonun içinde tut; pageScript.test.ts denetler.
 *
 * İki sütunlu düzende her sütun (side, main) kendi akışıyla bağımsız
 * dağıtılır; sayfa sayısı en uzun akışınkidir. Başlık yalnız ilk sayfadadır.
 * Sütunlar kaynaktaki akış sırasıyla kurulur (side-end şablonunda ana sütun önce).
 */

export interface OversizedBlock {
  sectionId: string | null
  itemId: string | null
}

export interface PaginateResult {
  pageCount: number
  oversized: OversizedBlock[]
  /** Bir metin sayfaya sığmadı ve kesilebilir: bölünemeyen paragraf ya da taşan başlık */
  clipped: boolean
  /** Başlık ilk sayfanın dışına taşıyor (aşırı uzun ad/unvan/iletişim); `clipped` de true olur */
  headerClipped: boolean
  /** #cv-pages'in içerik yüksekliği (px), animasyonlar kapalıyken ölçülmüş */
  contentHeight: number
}

type Flow = 'side' | 'main'

interface PageRef {
  page: HTMLElement
  cols: Partial<Record<Flow, HTMLElement>>
}

interface Atom {
  node: Element
  /** Bloktan atoma kadar olan ara kapsayıcılar (ör. .entry-body, ul) */
  path: Element[]
}

export function paginate(doc: Document, options: { previousPageCount?: number } = {}): PaginateResult {
  const FLOWS: Flow[] = ['side', 'main']
  /** Ölçüm sürerken #cv-pages'te duran öznitelik (base.css: animasyon ve geçiş kapalı). */
  const MEASURING_ATTR = 'data-measuring'
  /** Başlık taşması için pay (px): italik ve eksi harf aralığı kutudan bu kadar çıkabilir. */
  const HEADER_TOLERANCE = 1.5

  const source = doc.getElementById('cv-source')
  const target = doc.getElementById('cv-pages')
  if (!source || !target) throw new Error('CV belgesi iskeleti eksik')

  target.replaceChildren()
  const root = source.querySelector<HTMLElement>(':scope > .cv')
  const result: PaginateResult = { pageCount: 0, oversized: [], clipped: false, headerClipped: false, contentHeight: 0 }
  if (!root) return result

  target.className = root.className.replace(/\bcv\b/, '').trim()
  const header = root.querySelector(':scope > [data-flow="header"]')
  // Sütunlar kaynaktaki akış sırasıyla kurulur: çoğunlukla yan sütun önce (solda); `side-end`
  // şablonunda (K2, İkili) ana sütun önce, yan sütun sağda. DOM sırası = okuma sırası.
  const flows = Array.from(root.children)
    .map((el) => [el.getAttribute('data-flow') as Flow, el] as const)
    .filter((entry): entry is readonly [Flow, Element] => FLOWS.includes(entry[0]))

  const previous = options.previousPageCount ?? 0
  const pages: PageRef[] = []
  const padCache = new WeakMap<HTMLElement, number>()

  function createPage(index: number): PageRef {
    const page = doc.createElement('div')
    page.className = 'page'
    page.dataset.page = String(index)
    if (previous > 0 && index >= previous) page.classList.add('page-enter')
    const inner = doc.createElement('div')
    inner.className = 'page-inner'
    if (index === 0 && header) {
      inner.classList.add('has-header')
      for (const child of Array.from(header.children)) inner.appendChild(child.cloneNode(true))
    }
    const body = doc.createElement('div')
    body.className = 'page-body'
    const cols: PageRef['cols'] = {}
    for (const [name] of flows) {
      const col = doc.createElement('div')
      col.className = `col col-${name}`
      col.dataset.flow = name
      body.appendChild(col)
      cols[name] = col
    }
    inner.appendChild(body)
    page.appendChild(inner)
    target!.appendChild(page)
    return { page, cols }
  }

  function column(index: number, flow: Flow): HTMLElement {
    while (pages.length <= index) pages.push(createPage(pages.length))
    return pages[index].cols[flow]!
  }

  function fits(col: HTMLElement): boolean {
    const last = col.lastElementChild
    if (!last) return true
    let pad = padCache.get(col)
    if (pad === undefined) {
      pad = parseFloat(getComputedStyle(col).paddingBottom) || 0
      padCache.set(col, pad)
    }
    return last.getBoundingClientRect().bottom <= col.getBoundingClientRect().bottom - pad + 0.5
  }

  const onlyKeepWithNext = (col: HTMLElement) =>
    Array.from(col.children).every((child) => child.hasAttribute('data-keep-with-next'))

  function place(block: HTMLElement, flow: Flow, pageIndex: number): number {
    const col = column(pageIndex, flow)
    col.appendChild(block)
    if (fits(col)) return pageIndex
    const blockHeight = block.getBoundingClientRect().height
    col.removeChild(block)

    // Sütun boşsa (ya da yalnız bölüm başlığı varsa) blok bu sayfaya tek başına sığmıyor.
    if (col.childElementCount === 0 || onlyKeepWithNext(col)) {
      // İlk sayfada başlık yer kaplar: başlıksız bir sayfaya sığıyorsa bölme, taşı.
      if (pageIndex === 0 && blockHeight <= emptyColumnHeight(flow)) {
        return place(block, flow, moveToNextPage(flow, pageIndex))
      }
      return split(block, flow, pageIndex)
    }

    // Boş bir sayfaya bile sığmayacak kadar uzunsa zaten bölünecek: sayfanın
    // altını boş bırakmamak için bölmeye bu sayfanın kalan yerinden başla.
    if (blockHeight > emptyColumnHeight(flow)) return split(block, flow, pageIndex)

    return place(block, flow, moveToNextPage(flow, pageIndex))
  }

  /** Sondaki bölüm başlıklarını sonraki sayfaya taşır; yeni sayfa numarasını döndürür. */
  function moveToNextPage(flow: Flow, pageIndex: number): number {
    const col = column(pageIndex, flow)
    const carry: Element[] = []
    while (col.lastElementChild?.hasAttribute('data-keep-with-next')) {
      carry.unshift(col.lastElementChild)
      col.removeChild(col.lastElementChild)
    }
    const next = column(pageIndex + 1, flow)
    for (const el of carry) next.appendChild(el)
    return pageIndex + 1
  }

  const emptyHeights = new Map<Flow, number>()
  /** Başlıksız (2. ve sonraki) bir sayfada sütunun içerik yüksekliği. */
  function emptyColumnHeight(flow: Flow): number {
    const cached = emptyHeights.get(flow)
    if (cached !== undefined) return cached
    const probe = createPage(Number.MAX_SAFE_INTEGER)
    const col = probe.cols[flow]!
    const style = getComputedStyle(col)
    const measured = col.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    probe.page.remove()
    // Ölçülemiyorsa (görünmez belge) "her şey sığar" say: bölme kararı hiç verilmesin.
    const height = measured > 0 ? measured : Number.POSITIVE_INFINITY
    emptyHeights.set(flow, height)
    return height
  }

  function collectAtoms(block: Element): Atom[] {
    const atoms: Atom[] = []
    for (const child of Array.from(block.children)) {
      const hasLooseText = Array.from(child.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
      )
      if (child.classList.contains('entry-body') && !hasLooseText) {
        for (const group of Array.from(child.children)) {
          if (group.tagName === 'UL' || group.tagName === 'OL') {
            for (const li of Array.from(group.children)) atoms.push({ node: li, path: [child, group] })
          } else {
            atoms.push({ node: group, path: [child] })
          }
        }
      } else {
        atoms.push({ node: child, path: [] })
      }
    }
    return atoms
  }

  function split(block: HTMLElement, flow: Flow, pageIndex: number): number {
    result.oversized.push({
      sectionId: block.dataset.sectionId ?? null,
      itemId: block.dataset.itemId ?? null,
    })
    const atoms = collectAtoms(block)
    if (atoms.length === 0) {
      // Bölünecek alt parçası yok (yalnız düz metin): olduğu gibi yerleştir, kırpılabilir.
      column(pageIndex, flow).appendChild(block)
      result.clipped = true
      return pageIndex
    }
    let page = pageIndex
    let col = column(page, flow)
    let part = startPart(block, col, false)
    let continued = false
    let open: { src: Element; clone: Element }[] = []
    /** Bu parçaya yerleşen atomların kopyaları (sırayla); `partStart` parçanın ilk atomunun sırası. */
    let placed: Node[] = []
    let partStart = 0
    /** Gövde atomu (madde, paragraf): kaydın başlığı ve alt satırı değil. */
    const isBody = (atom: Atom) => atom.path.length > 0
    const countBody = (from: number, to: number) => atoms.slice(from, to).filter(isBody).length

    const openPath = (path: Element[]): Element => {
      let common = 0
      while (common < open.length && common < path.length && open[common].src === path[common]) common++
      open = open.slice(0, common)
      for (let i = common; i < path.length; i++) {
        const clone = path[i].cloneNode(false) as Element
        ;(i === 0 ? part : open[i - 1].clone).appendChild(clone)
        open.push({ src: path[i], clone })
      }
      return path.length ? open[path.length - 1].clone : part
    }

    const pruneEmpty = () => {
      while (open.length && open[open.length - 1].clone.childNodes.length === 0) {
        open[open.length - 1].clone.remove()
        open.pop()
      }
    }

    /** Kaydı (başlığıyla) sonraki sayfadan baştan başlatır. */
    const restartOnNextPage = () => {
      part.remove()
      page = moveToNextPage(flow, page)
      col = column(page, flow)
      part = startPart(block, col, false)
      continued = false
      open = []
      placed = []
      partStart = 0
    }

    let i = 0
    while (i < atoms.length) {
      const atom = atoms[i]
      const parent = openPath(atom.path)
      const node = atom.node.cloneNode(true)
      parent.appendChild(node)
      if (fits(col)) {
        placed.push(node)
        i++
        continue
      }
      const nodeHeight = (node as Element).getBoundingClientRect().height
      parent.removeChild(node)
      pruneEmpty()
      const fresh = Array.from(col.children).every((c) => c === part || c.hasAttribute('data-keep-with-next'))
      if (placed.length === 0) {
        // Başlıklı ilk sayfada sığmayan parça, başlıksız sayfaya sığıyorsa kırpılmaz, taşınır.
        if (!fresh || (page === 0 && nodeHeight <= emptyColumnHeight(flow))) {
          // Bu sayfada ilk parçaya bile yer yok: kaydı sonraki sayfadan başlat (başlığıyla).
          restartOnNextPage()
          continue
        }
        // Taze sayfada bile sığmayan tek parça: yerleştir, kırpılma uyarısı ver.
        const lone = atom.node.cloneNode(true)
        openPath(atom.path).appendChild(lone)
        result.clipped = true
        placed.push(lone)
        i++
        continue
      }
      // Sayfa sonu atoms[i - 1] ile atoms[i] arasında. Yetim/dul (SET-14 §5.5): bölünen kayıtta her
      // sayfada en az 2 madde. Kaydın ilk parçasında 2'den az madde kalıyorsa (yalnız başlık + alt
      // satır + 1 madde) kayıt sonraki sayfadan başlar; sayfada kayıttan önce içerik yoksa (taze
      // sayfa) bu yapılmaz: orada da sığmayacaktı, sonsuz döngü olmasın.
      const bodyHere = countBody(partStart, i)
      if (!continued && !fresh && atoms.slice(i).some(isBody) && bodyHere < 2) {
        restartOnNextPage()
        i = 0
        continue
      }
      // Son madde sonraki sayfada tek başına kalacaksa bir madde daha onunla gider (bu sayfada en az
      // 2 madde kalmak şartıyla).
      if (countBody(i, atoms.length) === 1 && isBody(atoms[i]) && isBody(atoms[i - 1]) && bodyHere >= 3) {
        const last = placed.pop()!
        let up = last.parentElement
        last.parentNode?.removeChild(last)
        while (up && up !== part && up.childNodes.length === 0) {
          const next = up.parentElement
          up.remove()
          up = next
        }
        i--
      }
      if (part.childNodes.length === 0) part.remove()
      page++
      col = column(page, flow)
      part = startPart(block, col, true)
      continued = true
      open = []
      placed = []
      partStart = i
    }
    return page
  }

  /** Kısa satır bloğu: tek çocuğu `.entry-line` olan kayıt (beceri satırı, dil satırı). */
  function isLine(el: Element): boolean {
    return el.children.length === 1 && el.firstElementChild!.classList.contains('entry-line')
  }

  /** Aynı bölümün ardışık satır blokları bir "dizi"dir (ör. Beceriler'in Diller/Çatılar/Araçlar satırları). */
  function sameRun(a: Element, b: Element): boolean {
    const id = b.getAttribute('data-section-id')
    return id !== null && a.getAttribute('data-section-id') === id && isLine(a) && isLine(b)
  }

  /**
   * Satır dizisinde yetim/dul (SET-14 §5.5). `block` sayfa sonundan sonra sonraki sayfanın başına
   * düştü; `rest` = kaynakta bu blok dahil dizide kalan blok sayısı. Dizi bölünüyorsa her iki sayfada
   * en az 2 satır kalır: önceki sayfanın dibinde tek satır kalıyorsa (yetim) ya da bu blok dizinin son
   * ve tek satırıysa (dul) önceki sayfanın sonundaki satırlar bu sayfaya alınır. Önceki sayfada dizinin
   * hiç satırı kalmıyorsa bölüm başlığı da gelir (başlık başlıksız kalmaz, başlıksız satır da olmaz).
   * Önceki sütunda başka içerik kalmayacaksa (boş sayfa olurdu) ya da taşınan satırlar sığmazsa
   * hiçbir şey yapılmaz. Taşıma yalnız ileri: döngü yok.
   */
  function keepLinesTogether(block: HTMLElement, flow: Flow, prevPage: number, rest: number) {
    const prev = column(prevPage, flow)
    const next = column(prevPage + 1, flow)
    if (next.firstElementChild !== block) return
    const run: Element[] = []
    for (let el = prev.lastElementChild; el && sameRun(el, block); el = el.previousElementSibling) run.unshift(el)
    const k = run.length
    if (k === 0) return
    // Yetim: önceki sayfada tek satır → hepsi gelir. Dul: bu blok son ve tek satır → önceki sayfadan
    // bir satır gelir; orada 2'den az kalacaksa hepsi.
    const move = k < 2 ? k : rest < 2 ? (k - 1 >= 2 ? 1 : k) : 0
    if (move === 0) return
    const moving = run.slice(k - move)
    if (move === k) {
      for (let el = run[0].previousElementSibling; el?.hasAttribute('data-keep-with-next'); el = el.previousElementSibling) {
        moving.unshift(el)
      }
    }
    const stays = Array.from(prev.children).filter((c) => !moving.includes(c))
    if (!stays.some((c) => !c.hasAttribute('data-keep-with-next'))) return
    next.prepend(...moving)
    if (!fits(next)) prev.append(...moving)
  }

  function startPart(block: HTMLElement, col: HTMLElement, continued: boolean): HTMLElement {
    const part = block.cloneNode(false) as HTMLElement
    part.classList.add('is-split', 'overflow-warning')
    if (continued) part.classList.add('is-continued')
    col.appendChild(part)
    return part
  }

  /**
   * Başlığın metni ya da fotoğrafı ilk sayfanın kutusundan taşıyor mu? Başlık bölünmez ve sayfa
   * `overflow: hidden`: taşan kısım sessizce kesilirdi. Satır satır metin kutuları ölçülür
   * (blok kutusu sayfanın içinde kalsa da içindeki bölünmez kelime dışarı taşabilir).
   */
  function headerOverflows(first: PageRef): boolean {
    const inner = first.page.firstElementChild
    const bounds = first.page.getBoundingClientRect()
    // Ölçülemiyorsa (görünmez belge) taşma kararı verilmez.
    if (!inner || bounds.width <= 0 || bounds.height <= 0) return false
    const outside = (rect: DOMRect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      (rect.left < bounds.left - HEADER_TOLERANCE ||
        rect.right > bounds.right + HEADER_TOLERANCE ||
        rect.top < bounds.top - HEADER_TOLERANCE ||
        rect.bottom > bounds.bottom + HEADER_TOLERANCE)
    const range = doc.createRange()
    for (const el of Array.from(inner.children)) {
      if (el.classList.contains('page-body')) continue
      if (outside(el.getBoundingClientRect())) return true
      for (const img of Array.from(el.querySelectorAll('img'))) {
        if (outside(img.getBoundingClientRect())) return true
      }
      if (typeof range.getClientRects !== 'function') continue
      const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue
        range.selectNodeContents(node)
        if (Array.from(range.getClientRects()).some(outside)) return true
      }
    }
    return false
  }

  /**
   * K3: iletişim satırında satır sonuna düşen öğenin ayırıcısı (" ·") gizlenir; satır sonu zaten
   * ayırır, asılı "·" kalmaz. base.css ayırıcıyı `visibility: hidden` yapar: yer kaplamaya devam eder
   * (satır kırılımı değişmez) ama PDF metnine girmez. Ekran ve baskı ayrı ölçülür: editördeki fotoğraf
   * yer tutucusu baskıda kalkar, başlık genişler, satırlar başka yerden kırılabilir. `eol` ekranda,
   * `eol-print` baskıda geçerlidir.
   */
  function markLineEnds(first: PageRef) {
    const lists = Array.from(first.page.querySelectorAll('.cv-header .cv-contact'))
    if (lists.length === 0) return
    const mark = (cls: string) => {
      for (const list of lists) {
        const items = Array.from(list.children).filter((el) => el.tagName === 'LI')
        items.forEach((li, i) => {
          li.classList.remove(cls)
          const next = items[i + 1]
          if (!next) return
          const own = li.getClientRects()
          const after = next.getClientRects()
          if (own.length === 0 || after.length === 0) return
          const last = own[own.length - 1]
          if (after[0].top - last.top > last.height / 2) li.classList.add(cls)
        })
      }
    }
    // Ortalı/sağa yaslı satırda gizli ayırıcı yer kapladığı için görünen metin kayardı. Ayırıcının
    // gerçek genişliği ölçülüp listeye `--contact-sep-w` yazılır; base.css son öğeye aynı genişlikte
    // boşluk (padding, metin değil) verir ve ortalıda listeyi soldan o kadar içeri alır, sağa yaslıda
    // sağdan o kadar dışarı çıkarır. Her satırın görünen metni tam ortada / sağ kenarda durur.
    // Satır kırılımı bunlardan sonra ölçülür. Ayırıcıyı gizleyen (ızgara iletişim) şablonda genişlik 0.
    for (const list of lists) {
      const sep = list.querySelector('.sep')
      const width = sep ? sep.getBoundingClientRect().width : 0
      const align = getComputedStyle(list).textAlign
      const side = /center/.test(align) ? 'contact-center' : align === 'right' || align === 'end' ? 'contact-end' : null
      if (!side || !(width > 0)) continue
      ;(list as HTMLElement).style.setProperty('--contact-sep-w', `${width.toFixed(2)}px`)
      list.classList.add(side)
    }
    mark('eol')
    const slot = first.page.querySelector<HTMLElement>('.cv-header .ph-photo')
    const style = slot?.getAttribute('style') ?? null
    if (slot) slot.style.display = 'none'
    mark('eol-print')
    if (slot) {
      if (style === null) slot.removeAttribute('style')
      else slot.setAttribute('style', style)
    }
  }

  target.setAttribute(MEASURING_ATTR, '')
  try {
    pages.push(createPage(0))
    if (header) markLineEnds(pages[0])

    for (const [flow, el] of flows) {
      let pageIndex = 0
      const blocks = Array.from(el.children)
      blocks.forEach((src, i) => {
        const block = src.cloneNode(true) as HTMLElement
        const before = pageIndex
        pageIndex = place(block, flow, pageIndex)
        if (pageIndex === before + 1 && isLine(block)) {
          let rest = 1
          while (i + rest < blocks.length && sameRun(blocks[i + rest], block)) rest++
          keepLinesTogether(block, flow, before, rest)
        }
      })
    }

    if (header && headerOverflows(pages[0])) {
      result.headerClipped = true
      result.clipped = true
    }
    result.contentHeight = target.scrollHeight
  } finally {
    target.removeAttribute(MEASURING_ATTR)
  }

  // Kaynak artık sayfalarda; belgede aynı metnin ikinci kopyası kalmasın.
  source.replaceChildren()
  result.pageCount = pages.length
  return result
}
