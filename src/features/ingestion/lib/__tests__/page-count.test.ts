import { zipSync, strToU8 } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { countPages, detectDocType } from '../page-count'

async function makePdf(pages: number, name = 'invoice.pdf'): Promise<File> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i += 1) doc.addPage()
  return new File([await doc.save()], name, { type: 'application/pdf' })
}

/** A .docx is a zip; only `docProps/app.xml` matters for the page count. */
function makeDocx(appXml: string | null, name = 'invoice.docx'): File {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types/>'),
    'word/document.xml': strToU8('<?xml version="1.0"?><w:document/>'),
  }
  if (appXml !== null) files['docProps/app.xml'] = strToU8(appXml)
  return new File([zipSync(files)], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

const appXmlWith = (pages: number) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties><Template>Normal.dotm</Template><Pages>${pages}</Pages><Words>412</Words></Properties>`

describe('detectDocType', () => {
  it.each([
    ['invoice.pdf', 'pdf'],
    ['invoice.PDF', 'pdf'],
    ['invoice.docx', 'docx'],
    ['Invoice-X4ZM.DOCX', 'docx'],
  ])('classifies %s', (name, expected) => {
    expect(detectDocType(new File([], name))).toBe(expected)
  })

  it.each(['invoice.doc', 'invoice.png', 'invoice'])('rejects %s', (name) => {
    expect(detectDocType(new File([], name))).toBeNull()
  })
})

describe('countPages — pdf', () => {
  it.each([1, 2, 7])('counts a %i-page pdf', async (pages) => {
    expect(await countPages(await makePdf(pages))).toEqual({ status: 'detected', pages })
  })

  it('reports unreadable bytes rather than throwing', async () => {
    const notAPdf = new File([strToU8('this is not a pdf')], 'broken.pdf')
    expect(await countPages(notAPdf)).toMatchObject({ status: 'unknown' })
  })
})

describe('countPages — docx', () => {
  it('reads the page count Word saved into docProps/app.xml', async () => {
    expect(await countPages(makeDocx(appXmlWith(3)))).toEqual({ status: 'detected', pages: 3 })
  })

  // python-docx and friends never write app.xml, so this is the common
  // generated-document case, not a corrupt file.
  it('is unknown when app.xml is absent', async () => {
    expect(await countPages(makeDocx(null))).toMatchObject({ status: 'unknown' })
  })

  it('is unknown when app.xml carries no <Pages>', async () => {
    const noPages = '<?xml version="1.0"?><Properties><Words>412</Words></Properties>'
    expect(await countPages(makeDocx(noPages))).toMatchObject({ status: 'unknown' })
  })

  it('rejects a zero page count rather than sending 0', async () => {
    expect(await countPages(makeDocx(appXmlWith(0)))).toMatchObject({ status: 'unknown' })
  })

  it('is unknown when the file is not a readable zip', async () => {
    const broken = new File([strToU8('not a zip')], 'broken.docx')
    expect(await countPages(broken)).toMatchObject({ status: 'unknown' })
  })
})

describe('countPages — unsupported', () => {
  it('refuses anything that is not pdf or docx', async () => {
    expect(await countPages(new File([], 'invoice.png'))).toMatchObject({ status: 'unknown' })
  })
})
