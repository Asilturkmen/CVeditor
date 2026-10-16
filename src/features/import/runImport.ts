import { importResultToCv, type ImportedCv } from '@/ai/importConvert'
import { heuristicImport, looksLikeName, titleCase } from '@/ai/importHeuristics'
import {
  completeImportResult,
  detectLanguage,
  extractContacts,
  maskContacts,
  maskName,
  unmaskImportResult,
  type DetectedLanguage,
} from '@/ai/importText'
import { extractPdfText, largestLine, MAX_PDF_BYTES } from '@/ai/pdfText'
import { getAiProvider } from '@/ai/provider'
import { ImportResultSchema } from '@/ai/types'
import type { CvLanguage } from '@/cv/schema'

export { MAX_PDF_BYTES }

export type ImportErrorCode = 'not_pdf' | 'encrypted' | 'no_text' | 'unreadable' | 'too_large' | 'too_long' | 'parse'

export interface ImportOutcome {
  fileName: string
  pageCount: number
  /** PDF'ten okunan ham metin (maskesiz; yalnız ekranda gösterilir) */
  text: string
  detected: DetectedLanguage
  /** Sağlayıcı örnek mi (kurallı ayrıştırıcı) yoksa gerçek yapay zekâ mı */
  isDemo: boolean
  imported: ImportedCv
}

/**
 * PDF → kayıtlar. Metin tarayıcıda okunur; sağlayıcıya yalnız ad ve
 * iletişim bilgileri maskelenmiş metin gider, yer tutucular yanıt gelince
 * burada geri konur. Ad yerelde tahmin edilir (en büyük yazılı satır, yoksa
 * kurallı ayrıştırıcı). Sonuç doğrudan kaydedilmez; önizlemede kullanıcı onaylar.
 */
export async function readCvPdf(
  file: File,
  language: CvLanguage,
  signal: AbortSignal,
  onStep?: (step: 'pdf' | 'parse') => void,
): Promise<ImportOutcome> {
  if (file.size > MAX_PDF_BYTES) throw Object.assign(new Error('too_large'), { code: 'too_large' as const })
  onStep?.('pdf')
  const pdf = await extractPdfText(await file.arrayBuffer(), { signal })
  signal.throwIfAborted()

  onStep?.('parse')
  const contacts = extractContacts(pdf.text)
  const largest = largestLine(pdf.lines)
  const nameHint = largest && looksLikeName(largest) ? largest : null
  const contactMasked = maskContacts(pdf.text, contacts)
  const localName = nameHint ?? heuristicImport({ text: contactMasked.text, language }).personal.fullName
  const masked = maskName(contactMasked, localName)
  const provider = getAiProvider()
  const raw = ImportResultSchema.parse(await provider.parseImport({ text: masked.text, language }, signal))
  const result = completeImportResult(unmaskImportResult(raw, masked.map), { contacts, nameHint })
  const detected = detectLanguage(pdf.text)
  // Geri konan ad PDF'teki yazımıyla gelir; tümü büyük harfse ("AYŞE YILMAZ") düzeltilir.
  const nameLanguage = detected.confidence >= 0.6 ? detected.language : language
  if (result.personal.fullName) result.personal.fullName = titleCase(result.personal.fullName, nameLanguage)
  return {
    fileName: file.name,
    pageCount: pdf.pageCount,
    text: pdf.text,
    detected,
    isDemo: provider.isDemo,
    imported: importResultToCv(result),
  }
}

const KNOWN_CODES: readonly ImportErrorCode[] = ['not_pdf', 'encrypted', 'no_text', 'unreadable', 'too_large', 'too_long']

export function importErrorCode(error: unknown): ImportErrorCode {
  const code = (error as { code?: string } | null)?.code
  return (KNOWN_CODES as readonly string[]).includes(code ?? '') ? (code as ImportErrorCode) : 'parse'
}
