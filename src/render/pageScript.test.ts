import { afterEach, describe, expect, it } from 'vitest'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { DrawInput, DrawResult } from './drawDocument'
import { PAGE_DRAW_GLOBAL, pageDrawScript } from './pageScript'
import { renderCvSource } from './renderCv'
import { templateSettingsFor } from './templates'

type DrawGlobal = { [PAGE_DRAW_GLOBAL]?: (input: DrawInput) => Promise<DrawResult> }

afterEach(() => {
  delete (window as unknown as DrawGlobal)[PAGE_DRAW_GLOBAL]
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('sunucu sayfasına enjekte edilen çizim betiği', () => {
  it('kendi başına çalışır: modül kapsamı olmadan (genel kapsamda) değerlendirilip belgeyi çizer', async () => {
    const script = pageDrawScript()
    // `new Function` gövdesi genel kapsamda derlenir: paginate/drawDocument modül düzeyindeki bir
    // sabite, içe aktarmaya ya da derleyici yardımcısına başvuruyorsa burada ReferenceError verir.
    new Function(script)()
    const draw = (window as unknown as DrawGlobal)[PAGE_DRAW_GLOBAL]
    expect(draw).toBeTypeOf('function')

    document.head.innerHTML = '<style id="cv-fonts"></style><style id="cv-styles"></style><style id="cv-host"></style>'
    document.body.innerHTML = '<div id="cv-source"></div><div id="cv-pages"></div>'
    const sections = sampleSections('en')
    const cv = createCv({ name: 'Sample', language: 'en', templateId: 'panel', template: templateSettingsFor('panel', sections), personal: samplePersonal('en'), sections })
    const result = await draw!({ lang: 'en', styles: '.page{width:210mm}', html: renderCvSource(cv) })

    expect(result).toMatchObject({ pageCount: 1, oversized: [], clipped: false, headerClipped: false, fontsTimedOut: false })
    expect(document.documentElement.lang).toBe('en')
    expect(document.getElementById('cv-styles')!.textContent).toBe('.page{width:210mm}')
    expect(document.querySelectorAll('#cv-pages > .page')).toHaveLength(1)
    // İki sütun: yan sütun DOM'da ana sütundan önce.
    expect(Array.from(document.querySelectorAll('#cv-pages .col')).map((col) => col.getAttribute('data-flow'))).toEqual(['side', 'main'])
    expect(document.querySelector('#cv-pages .cv-name')!.textContent).toBe(cv.personal.fullName)
    expect(document.getElementById('cv-source')!.childNodes).toHaveLength(0)
  })

  it('betik içe aktarma ya da modül bağı taşımaz', () => {
    const script = pageDrawScript()
    expect(script.startsWith(`window.${PAGE_DRAW_GLOBAL}=`)).toBe(true)
    expect(script).not.toMatch(/\bimport\b|\brequire\(|__vite|__vitest|__name\(/)
  })
})
