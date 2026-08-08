import { asStringArray, isRecord, toFieldValue } from './primitives'
import type { FieldKind, FieldValue, LineItemColumnVM, LineItemsVM, Warning } from './types'

/**
 * `invoice_description` arrives as four *parallel arrays*, not rows:
 *
 *   { "Description of Goods / Services": [...9], "Qty / Unit": [...9],
 *     "Unit Price": [...9], "Line Total": [...9] }
 *
 * Index i across all four is one line. This module turns that into rows, and
 * back again for editing.
 */

interface ColumnSpec {
  id: string
  label: string
  kind: FieldKind
  /** Ordered most-specific first; the index of the first match is the score. */
  patterns: RegExp[]
  /** Where the column sits in the rendered table, independent of claiming. */
  display: number
}

/**
 * Column matching is by scored pattern, never string equality — the keys are
 * human-readable prose and will drift.
 *
 * Declaration order is *claiming* order and is load-bearing: `"Qty / Unit"` and
 * `"Unit Price"` both contain "Unit", so a naive first-match-wins assigns unit
 * prices to the quantity column. Running `unit_price` before `qty` and `unit`,
 * with each column claiming its best *unclaimed* key, is what prevents that.
 *
 * `display` is separate, because the order that resolves the ambiguity is not
 * the order a line reads in: a reviewer comparing the table against the
 * document reads what the item is before what it cost.
 */
const COLUMN_SPECS: ColumnSpec[] = [
  {
    id: 'unit_price',
    label: 'Unit Price',
    kind: 'money',
    patterns: [/unit\s*price/i, /\bprice\b/i, /\brate\b/i],
    display: 4,
  },
  {
    id: 'line_total',
    label: 'Line Total',
    kind: 'money',
    patterns: [/line\s*total/i, /\btotal\b/i, /\bamount\b/i],
    display: 5,
  },
  {
    id: 'qty',
    label: 'Qty / Unit',
    kind: 'text',
    patterns: [/\bqty\b/i, /quantity/i, /\bunit\b/i],
    display: 2,
  },
  /*
   * Only an exact `Unit` (or `UOM`), so an invoice that combines the two into
   * `"Qty / Unit"` still resolves to the single quantity column above rather
   * than splitting one key across two headings.
   */
  {
    id: 'unit',
    label: 'Unit',
    kind: 'text',
    patterns: [/^\s*units?\s*$/i, /^\s*uom\s*$/i],
    display: 3,
  },
  {
    id: 'description',
    label: 'Description',
    kind: 'text',
    patterns: [/description/i, /goods/i, /service/i, /\bitem\b/i, /particular/i],
    display: 1,
  },
  /*
   * The agent labels the row counter `#`, which reads as a stray symbol above a
   * column of numbers. It is the serial number, so it says so.
   */
  {
    id: 'serial',
    label: 'S.No',
    kind: 'text',
    patterns: [/^\s*#\s*$/, /^\s*s[.\s]*(no|n)\.?\s*$/i, /^\s*(sl|sr)[.\s]*no\.?\s*$/i, /serial/i],
    display: 0,
  },
]

function score(key: string, spec: ColumnSpec): number | null {
  for (let i = 0; i < spec.patterns.length; i += 1) {
    if (spec.patterns[i].test(key)) return i
  }
  return null
}

/** Assign source keys to known columns, most-specific spec first, one shot each. */
function claimColumns(keys: string[]): {
  columns: LineItemColumnVM[]
  claimed: Set<string>
} {
  const pool = new Set(keys)
  const claimed: Array<LineItemColumnVM & { display: number }> = []

  for (const spec of COLUMN_SPECS) {
    let best: { key: string; score: number } | null = null

    for (const key of pool) {
      const s = score(key, spec)
      if (s !== null && (best === null || s < best.score)) {
        best = { key, score: s }
      }
    }

    if (best) {
      pool.delete(best.key)
      claimed.push({
        id: spec.id,
        label: spec.label,
        sourceKey: best.key,
        kind: spec.kind,
        display: spec.display,
      })
    }
  }

  claimed.sort((a, b) => a.display - b.display)

  const columns: LineItemColumnVM[] = claimed.map(({ display: _display, ...column }) => column)

  // Anything unclaimed becomes an extra column labelled with its raw key, so
  // drift shows up as a column we did not expect rather than as missing data.
  for (const key of keys) {
    if (pool.has(key)) {
      columns.push({ id: `extra:${key}`, label: key, sourceKey: key, kind: 'text' })
    }
  }

  return { columns, claimed: new Set(keys.filter((key) => !pool.has(key))) }
}

/** The empty result, used for every unusable shape. */
function emptyLineItems(sourceKey: string | null): LineItemsVM {
  return { columns: [], rows: [], ragged: false, lengths: {}, sourceKey }
}

/**
 * Turn `invoice_description` into rows.
 *
 * Handles three shapes, none of which can throw:
 *  1. object of parallel arrays — the documented contract
 *  2. array of row objects — the likeliest future change, cheap to support
 *  3. anything else — no rows, plus a warning, and the raw value stays visible
 *     in the JSON panel
 */
export function transposeLineItems(
  input: unknown,
  sourceKey: string | null,
  warnings: Warning[],
): LineItemsVM {
  if (input === null || input === undefined) {
    warnings.push({ code: 'LINE_ITEMS_MISSING', message: 'No line items in this document' })
    return emptyLineItems(sourceKey)
  }

  if (Array.isArray(input)) return fromRowObjects(input, sourceKey, warnings)
  if (isRecord(input)) return fromParallelArrays(input, sourceKey, warnings)

  warnings.push({
    code: 'LINE_ITEMS_UNRECOGNISED',
    message: 'Line items are not in a recognised shape — see Raw JSON',
    detail: input,
  })
  return emptyLineItems(sourceKey)
}

function fromParallelArrays(
  record: Record<string, unknown>,
  sourceKey: string | null,
  warnings: Warning[],
): LineItemsVM {
  const arrayEntries = Object.entries(record)
    .map(([key, value]) => [key, asStringArray(value)] as const)
    .filter((entry): entry is readonly [string, string[]] => entry[1] !== null)

  if (arrayEntries.length === 0) {
    warnings.push({
      code: 'LINE_ITEMS_UNRECOGNISED',
      message: 'Line items contained no arrays — see Raw JSON',
      detail: record,
    })
    return emptyLineItems(sourceKey)
  }

  const values = new Map(arrayEntries)
  const { columns } = claimColumns(arrayEntries.map(([key]) => key))

  const lengths: Record<string, number> = {}
  for (const [key, list] of arrayEntries) lengths[key] = list.length

  const counts = arrayEntries.map(([, list]) => list.length)
  const max = Math.max(...counts)
  const ragged = max !== Math.min(...counts)

  if (ragged) {
    warnings.push({
      code: 'RAGGED_LINE_ITEMS',
      message:
        'Line-item columns have different lengths, so rows may not line up. Check each row against the document.',
      detail: lengths,
    })
  }

  // Render `max` rows, never `min`. Truncating to the shortest column would hide
  // data from the person whose entire job is to look at it; a missing cell shows
  // as an em-dash instead.
  const rows: Array<Array<FieldValue | null>> = []
  for (let i = 0; i < max; i += 1) {
    rows.push(
      columns.map((column) => {
        const list = values.get(column.sourceKey)
        if (!list || i >= list.length) return null
        return toFieldValue(list[i], column.kind)
      }),
    )
  }

  return { columns, rows, ragged, lengths, sourceKey }
}

function fromRowObjects(
  input: unknown[],
  sourceKey: string | null,
  warnings: Warning[],
): LineItemsVM {
  const records = input.filter(isRecord)

  if (records.length === 0) {
    warnings.push({
      code: 'LINE_ITEMS_UNRECOGNISED',
      message: 'Line items are an array but not of objects — see Raw JSON',
      detail: input,
    })
    return emptyLineItems(sourceKey)
  }

  const keys: string[] = []
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!keys.includes(key)) keys.push(key)
    }
  }

  const { columns } = claimColumns(keys)

  const rows = records.map((record) =>
    columns.map((column) =>
      column.sourceKey in record ? toFieldValue(record[column.sourceKey], column.kind) : null,
    ),
  )

  const lengths: Record<string, number> = {}
  for (const key of keys) {
    lengths[key] = records.filter((record) => key in record).length
  }

  return { columns, rows, ragged: false, lengths, sourceKey }
}

/**
 * Write edited rows back into the original parallel-array shape.
 *
 * Only valid when the source arrays were aligned: with ragged input there is no
 * defensible mapping from row index back to array index, so callers must block
 * editing on `LineItemsVM.ragged` rather than calling this.
 */
export function untransposeLineItems(
  columns: LineItemColumnVM[],
  rows: string[][],
): Record<string, string[]> {
  const result: Record<string, string[]> = {}

  columns.forEach((column, columnIndex) => {
    result[column.sourceKey] = rows.map((row) => row[columnIndex] ?? '')
  })

  return result
}
