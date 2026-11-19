import { importResultToCv, type ImportedCv } from '@/ai/importConvert'
import { titleCase } from '@/ai/importHeuristics'
import { completeImportResult, detectLanguage, unmaskImport, type DetectedLanguage } from '@/ai/importText'
import { maskPdfText, type PdfMasking } from '@/ai/pdfMask'
import { extractPdfText, MAX_PDF_BYTES } from '@/ai/pdfText'
import { getAiProvider } from '@/ai/provider'
import type { ImportRequest } from '@/ai/types'
import { parseImportResult } from '@/ai/validate'
import type { CvLanguage } from '@/cv/schema'
import { withAiAuth } from '@/features/ai/aiAuth'

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
  /** Tanınmayan ya da bozulmuş yer tutucu yüzünden boş bırakılan değer sayısı */
  dropped: number
}

/** PDF okundu ve maskelendi; henüz hiçbir yere gönderilmedi. */
export interface PreparedImport {
  fileName: string
  pageCount: number
  /** PDF'ten okunan ham metin (maskesiz; yalnız ekranda) */
  text: string
  detected: DetectedLanguage
  /** Sağlayıcıya gidecek istek (maskeli metin): onay adımında olduğu gibi gösterilir */
  request: ImportRequest
  masking: PdfMasking
}

/**
 * PDF → maskeli istek. Metin tarayıcıda okunur ve CV İnceleme ile AYNI işlevle
 * (pdfMask.ts `maskPdfText`) maskelenir: ad, iletişim bilgileri, konum,
 * referans adları, kimlik no, doğum tarihi, adres… Hiçbir şey gönderilmez.
 */
export async function prepareCvImport(
  file: File,
  language: CvLanguage,
  signal: AbortSignal,
  onStep?: (step: 'pdf' | 'parse') => void,
): Promise<PreparedImport> {
  if (file.size > MAX_PDF_BYTES) throw Object.assign(new Error('too_large'), { code: 'too_large' as const })
  onStep?.('pdf')
  const pdf = await extractPdfText(await file.arrayBuffer(), { signal })
  signal.throwIfAborted()
  const masking = maskPdfText(pdf, language)
  return {
    fileName: file.name,
    pageCount: pdf.pageCount,
    text: pdf.text,
    detected: detectLanguage(pdf.text),
    request: { text: masking.text, language },
    masking,
  }
}

/**
 * Maskeli metni sağlayıcıya verir, yanıtı yerelde geri koyar. Gerçek
 * sağlayıcıda arayüz bunu ancak kullanıcı onay adımında "Gönder"e basınca
 * çağırır. Sonuç doğrudan kaydedilmez; önizlemede kullanıcı onaylar.
 */
export async function sendCvImport(prepared: PreparedImport, signal: AbortSignal): Promise<ImportOutcome> {
  const provider = getAiProvider()
  const raw = parseImportResult(await withAiAuth(() => provider.parseImport(prepared.request, signal), signal))
  signal.throwIfAborted()
  const { masking, detected } = prepared
  const { result: unmasked, dropped } = unmaskImport(raw, masking.map)
  // Model adı döndürmediyse yerel tahmin konur (önizlemede düzenlenebilir alan).
  const result = completeImportResult(unmasked, { contacts: masking.contacts, nameHint: masking.name })
  // Geri konan ad PDF'teki yazımıyla gelir; tümü büyük harfse ("AYŞE YILMAZ") düzeltilir.
  const nameLanguage = detected.confidence >= 0.6 ? detected.language : prepared.request.language
  if (result.personal.fullName) result.personal.fullName = titleCase(result.personal.fullName, nameLanguage)
  return {
    fileName: prepared.fileName,
    pageCount: prepared.pageCount,
    text: prepared.text,
    detected,
    isDemo: provider.isDemo,
    imported: importResultToCv(result),
    dropped,
  }
}

const KNOWN_CODES: readonly ImportErrorCode[] = ['not_pdf', 'encrypted', 'no_text', 'unreadable', 'too_large', 'too_long']

export function importErrorCode(error: unknown): ImportErrorCode {
  const code = (error as { code?: string } | null)?.code
  return (KNOWN_CODES as readonly string[]).includes(code ?? '') ? (code as ImportErrorCode) : 'parse'
}
