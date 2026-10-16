import { beforeEach, describe, expect, it, vi } from 'vitest'

// pdfjs yerine sahte belge: sayfa sayısı ve okunan sayfalar denetlenebilsin.
const fake = vi.hoisted(() => ({ numPages: 1, read: [] as number[], destroyed: 0, onPage: null as null | ((p: number) => void) }))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: fake.numPages,
      getPage: async (p: number) => {
        fake.read.push(p)
        fake.onPage?.(p)
        return {
          getViewport: () => ({ width: 595, height: 842 }),
          getTextContent: async () => ({
            items: [{ str: `Sayfa ${p} üzerinde yeterince uzun bir metin satırı`, transform: [10, 0, 0, 10, 50, 800], width: 300, height: 10, hasEOL: true }],
          }),
        }
      },
    }),
    destroy: async () => {
      fake.destroyed++
    },
  }),
}))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }))

const { extractPdfText, MAX_PDF_PAGES, PdfTextError } = await import('./pdfText')

const pdfBytes = () => new TextEncoder().encode('%PDF-1.7 sahte').buffer as ArrayBuffer

beforeEach(() => {
  fake.numPages = 1
  fake.read = []
  fake.destroyed = 0
  fake.onPage = null
})

describe('PDF metni okuma sınırları', () => {
  it('sayfaları okur', async () => {
    fake.numPages = 3
    const pdf = await extractPdfText(pdfBytes())
    expect(pdf.pageCount).toBe(3)
    expect(fake.read).toEqual([1, 2, 3])
    expect(fake.destroyed).toBeGreaterThan(0)
  })

  it(`${MAX_PDF_PAGES} sayfadan uzun PDF okunmaz ('too_long')`, async () => {
    fake.numPages = MAX_PDF_PAGES + 1
    const error = await extractPdfText(pdfBytes()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PdfTextError)
    expect((error as InstanceType<typeof PdfTextError>).code).toBe('too_long')
    expect(fake.read).toEqual([])
    expect(fake.destroyed).toBeGreaterThan(0)
    fake.numPages = 5
    await expect(extractPdfText(pdfBytes(), { maxPages: 4 })).rejects.toMatchObject({ code: 'too_long' })
  })

  it('iptal edilince sonraki sayfa okunmaz; hata okuma hatası değil iptal nedenidir', async () => {
    fake.numPages = 10
    const controller = new AbortController()
    fake.onPage = (p) => {
      if (p === 2) controller.abort(new DOMException('vazgeçildi', 'AbortError'))
    }
    const error = await extractPdfText(pdfBytes(), { signal: controller.signal }).catch((e: unknown) => e)
    expect(error).not.toBeInstanceOf(PdfTextError)
    expect((error as DOMException).name).toBe('AbortError')
    expect(fake.read).toEqual([1, 2])
  })

  it('PDF olmayan dosya reddedilir', async () => {
    await expect(extractPdfText(new TextEncoder().encode('merhaba').buffer as ArrayBuffer)).rejects.toMatchObject({ code: 'not_pdf' })
  })
})
