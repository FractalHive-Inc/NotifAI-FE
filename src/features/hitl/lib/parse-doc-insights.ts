import { transposeLineItems } from './line-items'
import { isRecord } from './primitives'
import { reconcileTotals } from './reconcile'
import { buildSections } from './sections'
import type { DocInsightsVM, Warning } from './types'

/**
 * The one export the UI imports. Turns the agent's loose `doc_insights` into a
 * typed view model.
 *
 * **This function is total: it never throws, for any input** — null, undefined,
 * a string, a number, an array, a deeply malformed object. Every failure comes
 * back as a `Warning` in the result instead. That contract is what lets every
 * component below render unconditionally, with no try/catch and no error
 * boundary, and it is pinned by a test that feeds it a wide set of mutants.
 *
 * It lives in the frontend on purpose. The backend stores `state` verbatim and
 * never interprets it, so contract drift from the agent breaks *rendering*, not
 * *ingestion* — a document still arrives and is still reviewable, and the fix
 * ships on a frontend deploy with no migration.
 */
export function parseDocInsights(input: unknown): DocInsightsVM {
  const warnings: Warning[] = []

  const insights = normalise(input, warnings)

  const lineItemsKey = findLineItemsKey(insights)
  const lineItems = transposeLineItems(
    lineItemsKey === null ? undefined : insights[lineItemsKey],
    lineItemsKey,
    warnings,
  )

  const { sections, unknownKeys } = buildSections(insights)
  const reconciliation = reconcileTotals(insights, lineItems, warnings)

  return { sections, lineItems, reconciliation, warnings, unknownKeys, raw: input }
}

/**
 * Coerce whatever arrived into a record so the rest of the pipeline has one
 * shape to work with. A non-object is not a crash — it is a warning plus an
 * empty document, which still renders (with the raw value visible in the JSON
 * panel) and still lets the reviewer reject or reclassify.
 */
function normalise(input: unknown, warnings: Warning[]): Record<string, unknown> {
  if (isRecord(input)) return input

  warnings.push({
    code: 'NOT_AN_OBJECT',
    message:
      'Extracted data is not in the expected shape. Review the document directly and use Raw JSON below.',
    detail: input,
  })

  return {}
}

/**
 * Locate the line-items block without hard-coding `invoice_description`.
 *
 * A purchase order will not use that key, and the invoice key itself may drift.
 * Preferring an exact match and falling back to a scan keeps both working.
 */
const LINE_ITEM_KEY_PATTERNS = [
  /^invoice_description$/i,
  /line_?items?/i,
  /^items$/i,
  /description/i,
  /particulars/i,
]

function findLineItemsKey(insights: Record<string, unknown>): string | null {
  const keys = Object.keys(insights)

  for (const pattern of LINE_ITEM_KEY_PATTERNS) {
    const match = keys.find((key) => pattern.test(key))
    if (match !== undefined) return match
  }

  return null
}

export type { DocInsightsVM } from './types'
