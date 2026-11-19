import { describe, expect, it } from 'vitest'
import { createCv } from '@/cv/factory'
import { samplePersonal } from '@/cv/sample'
import { displayName, nameMetrics } from './nameMetrics'
import { renderCvSource } from './renderCv'
import { templateSettingsFor } from './templates'

const NBSP = ' '

describe('ad ölçüsü', () => {
  it('en uzun kelime normal boşluk, sekme ve satır sonundan bölünerek bulunur', () => {
    expect(nameMetrics('Deniz Aksoy').longest).toBe(5)
    expect(nameMetrics('Ali\tVeli\nAbdurrahmanoğlu').longest).toBe(15)
    expect(nameMetrics('Ali Veli').hasLongWord).toBe(false)
    expect(nameMetrics('').longest).toBe(1)
  })

  it('bölünmez boşlukla bağlı kelimeler tek kelime sayılır (tarayıcı orada satır kırmaz)', () => {
    const glued = `Abdurrahman${NBSP}Kahramanoğlu`
    expect(nameMetrics(glued).longest).toBe([...glued].length)
    expect(nameMetrics(glued).hasLongWord).toBe(true)
    expect(nameMetrics('Ali Veli').longest).toBe(8)
    expect(nameMetrics('Ali Veli').longest).toBe(8)
    // Normal boşlukla aynı ad kelime kelime ölçülür.
    expect(nameMetrics('Abdurrahman Kahramanoğlu').longest).toBe(12)
  })

  it('çizilen ad: bölünmez boşluk normal boşluğa döner, boşluklar tekleşir', () => {
    expect(displayName(`  Deniz${NBSP}Aksoy  `)).toBe('Deniz Aksoy')
    expect(displayName(`Deniz${NBSP}${NBSP}  Aksoy`)).toBe('Deniz Aksoy')
    expect(displayName('Deniz Aksoy')).toBe('Deniz Aksoy')
    expect(displayName(`${NBSP}`)).toBe('')
  })

  it('yapıştırılmış bölünmez boşluklu ad kelime aralarından kırılabilir çizilir ve doğru ölçülür', () => {
    const cv = createCv({
      name: 'Ad',
      language: 'tr',
      templateId: 'zarif',
      template: templateSettingsFor('zarif', []),
      personal: { ...samplePersonal('tr'), fullName: `Abdurrahman${NBSP}Kahramanoğlu` },
      sections: [],
    })
    const doc = document.implementation.createHTMLDocument('t')
    doc.body.innerHTML = renderCvSource(cv)
    const name = doc.querySelector<HTMLElement>('.cv-name')!
    expect(name.textContent).toBe('Abdurrahman Kahramanoğlu')
    expect(name.style.getPropertyValue('--name-longest')).toBe('12')
  })
})
