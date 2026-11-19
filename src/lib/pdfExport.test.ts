import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToasts } from '@/components/ui/toast'
import { createCv } from '@/cv/factory'
import { samplePersonal } from '@/cv/sample'
import { templateSettingsFor } from '@/render/templates'
import { dispositionFileName, exportPdf, pdfServerAvailable, resetPdfServerCache } from './pdfExport'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const cv = () => createCv({ name: 'Deneme', language: 'tr', templateId: 'zarif', template: templateSettingsFor('zarif', []), personal: samplePersonal('tr'), sections: [] })

describe('pdfExport', () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => {
    resetPdfServerCache()
    useToasts.setState({ toasts: [] })
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('Content-Disposition: önce UTF-8 adı, yoksa düz ad', () => {
    expect(dispositionFileName(`attachment; filename="Yazilim TR.pdf"; filename*=UTF-8''Yaz%C4%B1l%C4%B1m%20TR.pdf`)).toBe('Yazılım TR.pdf')
    expect(dispositionFileName('attachment; filename="CV.pdf"')).toBe('CV.pdf')
    expect(dispositionFileName(null)).toBeNull()
  })

  it('sunucu yok sayılır: index.html dönen geliştirme sunucusu, hata, ağ hatası', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }))
    expect(await pdfServerAvailable(0)).toBe(false)
    resetPdfServerCache()
    fetchMock.mockResolvedValueOnce(json({ error: 'server_offline' }, 503))
    expect(await pdfServerAvailable(0)).toBe(false)
    resetPdfServerCache()
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    expect(await pdfServerAvailable(0)).toBe(false)
    resetPdfServerCache()
    fetchMock.mockResolvedValueOnce(json({ ok: true, pdf: true }))
    expect(await pdfServerAvailable(0)).toBe(true)
  })

  it('sunucu yoksa yazdır penceresi', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 404))
    const print = vi.fn(async () => {})
    expect(await exportPdf(cv(), { allowSplit: false, print })).toEqual({ kind: 'printed' })
    expect(print).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sunucu varsa POST /api/pdf ve indirme; onayla allowSplit=1', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true, pdf: true }))
    fetchMock.mockImplementation(async () => new Response(new Blob(['%PDF-']), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename*=UTF-8''Deneme.pdf` } }))
    const print = vi.fn(async () => {})
    expect(await exportPdf(cv(), { allowSplit: false, print })).toEqual({ kind: 'downloaded' })
    expect(await exportPdf(cv(), { allowSplit: true, print })).toEqual({ kind: 'downloaded' })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/health', '/api/pdf', '/api/pdf?allowSplit=1'])
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string).name).toBe('Deneme')
    expect(print).not.toHaveBeenCalled()
    expect(useToasts.getState().toasts).toEqual([])
  })

  it('409: uzun kayıtlar döner (onay penceresi açılır)', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true, pdf: true }))
    fetchMock.mockResolvedValueOnce(json({ error: 'oversized', items: [{ sectionId: 's', itemId: 'i', label: 'X' }] }, 409))
    expect(await exportPdf(cv(), { allowSplit: false, print: async () => {} })).toEqual({ kind: 'oversized', oversized: [{ sectionId: 's', itemId: 'i' }] })
  })

  it('sunucu PDF üretemezse bildirim ve yazdır penceresi; yazdırma da başarısızsa hata bildirimi', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true, pdf: true }))
    fetchMock.mockImplementation(async () => json({ error: 'render_failed' }, 500))
    const print = vi.fn(async () => {})
    expect(await exportPdf(cv(), { allowSplit: false, print })).toEqual({ kind: 'printed' })
    expect(print).toHaveBeenCalledOnce()
    expect(useToasts.getState().toasts.map((t) => t.tone ?? 'default')).toEqual(['default'])
    expect(await exportPdf(cv(), { allowSplit: false, print: async () => Promise.reject(new Error('çizilemedi')) })).toEqual({ kind: 'failed' })
    expect(useToasts.getState().toasts.at(-1)?.tone).toBe('error')
  })
})
