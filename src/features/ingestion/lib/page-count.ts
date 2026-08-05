import { unzipSync, strFromU8 } from 'fflate'

/**
 * Page counting for the documents this app can ingest.
 *
 * The ingestion service wants a `pages` value alongside every upload, and the
 * only place that number exists before ingestion is the file itself — so it is
 * read in the browser, from the bytes, before the request goes out.
 *
 * PDF and DOCX are counted very differently, and only one of them is reliable.
 * See {@link countDocxPages} for why DOCX can legitimately come back unknown.
 */

export type SupportedDocType = 'pdf' | 'docx'

export const ACCEPTED_FILE_EXTENSIONS = ['.pdf', '.docx'] as const

/**
 * `accept` for the file input. DOCX's MIME type is long enough that browsers
 * disagree about it, so the extensions are listed too — a file picked on a
 * machine where the OS reports no MIME type still passes.
 */
export const FILE_INPUT_ACCEPT =
  'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx'

export type PageCountResult =
  | { status: 'detected'; pages: number }
  | { status: 'unknown'; reason: string }

/**
 * Classify by extension rather than `file.type`.
 *
 * A DOCX dragged in from some file managers arrives with an empty or generic
 * `type`, and rejecting it would be a bug the user cannot work around. The
 * extension is what they can see and control.
 */
export function detectDocType(file: File): SupportedDocType | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.docx')) return 'docx'
  return null
}

/**
 * Count pages in a PDF.
 *
 * pdf-lib is imported here rather than at module scope because it is by far the
 * heaviest thing on this route (~180 kB gzipped) and it is needed only once a
 * PDF has actually been chosen — the page itself, and any DOCX upload, should
 * not pay for it.
 *
 * `ignoreEncryption` covers the common case of an invoice that carries owner
 * restrictions (no printing, no editing) but no open password: the page tree is
 * readable and pdf-lib would otherwise refuse the whole document. A PDF that
 * genuinely needs a password to open still throws, and is reported as unknown.
 */
async function countPdfPages(bytes: Uint8Array): Promise<PageCountResult> {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    return { status: 'detected', pages: doc.getPageCount() }
  } catch {
    return {
      status: 'unknown',
      reason: 'This PDF could not be read — it may be password-protected or damaged.',
    }
  }
}

/**
 * Count pages in a DOCX.
 *
 * A DOCX has no page count of its own: pages are produced by whatever renders
 * the document, against a specific font set and paper size, so the same file can
 * be 3 pages in Word and 4 in LibreOffice. What it *does* carry is `<Pages>` in
 * `docProps/app.xml` — a note the last editor left behind recording how many
 * pages it saw when it saved.
 *
 * That note is therefore the best number available, and it is absent in files
 * generated programmatically (python-docx and friends never write it), which is
 * why this returns unknown rather than guessing.
 */
function countDocxPages(bytes: Uint8Array): PageCountResult {
  const unknown = (reason: string): PageCountResult => ({ status: 'unknown', reason })

  let appXml: string
  try {
    const entries = unzipSync(bytes, { filter: (entry) => entry.name === 'docProps/app.xml' })
    const raw = entries['docProps/app.xml']
    if (!raw) {
      return unknown('This .docx has no saved page count. Enter the number of pages below.')
    }
    appXml = strFromU8(raw)
  } catch {
    return unknown('This .docx could not be read — it may be damaged.')
  }

  const match = /<Pages>(\d+)<\/Pages>/.exec(appXml)
  const pages = match ? Number.parseInt(match[1], 10) : Number.NaN

  if (!Number.isFinite(pages) || pages < 1) {
    return unknown('This .docx has no saved page count. Enter the number of pages below.')
  }
  return { status: 'detected', pages }
}

/** Read a file's page count, or explain why it could not be read. */
export async function countPages(file: File): Promise<PageCountResult> {
  const type = detectDocType(file)
  if (!type) {
    return { status: 'unknown', reason: 'Unsupported file type. Upload a PDF or DOCX.' }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  return type === 'pdf' ? countPdfPages(bytes) : countDocxPages(bytes)
}
