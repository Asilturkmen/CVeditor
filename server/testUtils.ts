import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCv } from '@/cv/factory'
import { samplePersonal, sampleSections } from '@/cv/sample'
import type { Cv } from '@/cv/schema'
import type { TemplateId } from '@/render/templateMeta'
import { templateSettingsFor } from '@/render/templates'
import { loadConfig, ROOT_DIR, type ServerConfig } from './config'

/** Testlerde yalnız uydurma kişi (src/cv/sample.ts: Deniz Aksoy). */
export function sampleCv(name = 'Yazılım Öğrencisi TR', templateId: TemplateId = 'zarif'): Cv {
  const sections = sampleSections('tr')
  return createCv({ name, language: 'tr', templateId, template: templateSettingsFor(templateId, sections), personal: samplePersonal('tr'), sections })
}

/** Bir sayfadan uzun tek deneyim kaydı (70 madde) */
export function oversizedCv(): Cv {
  const cv = sampleCv('Uzun')
  const exp = cv.sections.find((s) => s.type === 'experience')!
  const first = exp.items[0] as { description: string }
  first.description = `<ul>${Array.from({ length: 70 }, (_, i) => `<li>Madde ${i + 1} ölçülebilir bir sonucu kısaca anlatır.</li>`).join('')}</ul>`
  return cv
}

export function testConfig(env: Record<string, string> = {}): ServerConfig {
  return loadConfig({ SERVE_STATIC: '0', FONTS_DIR: 'public/fonts', TRUST_PROXY: '1', ...env }, ROOT_DIR)
}

/** Geçici `dist/` benzeri klasör: satır içi betikli index.html, özetli bir varlık, pdf.js işçisi */
export function fakeDist(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cveditor-dist-'))
  mkdirSync(join(dir, 'assets'))
  mkdirSync(join(dir, 'fonts'))
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><script>var t=1</script><script type="module" src="/assets/index-abc.js"></script></head><body></body></html>')
  writeFileSync(join(dir, 'assets', 'index-abc.js'), 'console.log(1)')
  writeFileSync(join(dir, 'assets', 'pdf.worker.min-xyz.mjs'), 'export {}')
  writeFileSync(join(dir, 'fonts', 'a.woff2'), 'x')
  writeFileSync(join(dir, 'favicon.svg'), '<svg/>')
  return dir
}

export const ORIGIN = 'http://cv.test'

export function jsonPost(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Host: 'cv.test', Origin: ORIGIN, 'X-Forwarded-For': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
}
