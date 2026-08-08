import { isRecord, parseMoney, parsePercent } from './primitives'
import type {
  FieldPath,
  LineItemsVM,
  OperandPaths,
  ReconcileCheck,
  ReconcileSpec,
  Warning,
} from './types'

/**
 * Check that the document's numbers add up.
 *
 * Which checks are worth running is a property of the document type, so the
 * document's contract supplies the specs and this module supplies the
 * arithmetic. A purchase order declares none and gets none — better than a card
 * of grey "not verifiable" rows, which teaches reviewers to skip the panel on
 * the documents where it does mean something.
 *
 * For an invoice the three checks walk the document from the bottom up:
 *   sum(line totals)     == subtotal
 *   subtotal + tax       == total
 *   sum(tax components)  == tax          (CGST + SGST, where they are stated)
 *
 * Each operand is declared as a list of candidate paths, first-present-wins, so
 * one spec covers `total_amount` and the older `amount` alike. The tax term
 * prefers the stated `tax_amount` and falls back to `subtotal x rate` — an
 * invoice that states its tax should be checked against what it states, not
 * against a figure we recomputed from a rate that may be rounded.
 *
 * All arithmetic is in integer minor units. Summing nine floating-point currency
 * values accumulates error; integer cents do not. Rounding also means a derived
 * tax does not hold exactly — on a real sample, 2,028,509.88 x 1.2 is
 * 2,434,211.856 against a stated amount of 2,434,211.86 — so the comparison is a
 * tolerance, never `===`.
 */

const toMinor = (value: number): number => Math.round(value * 100)

/** Read a nested path, without throwing on a missing or non-object parent. */
function readPath(insights: Record<string, unknown>, path: FieldPath): unknown {
  let cursor: unknown = insights

  for (const segment of path) {
    if (Array.isArray(cursor) && typeof segment === 'number') {
      cursor = cursor[segment]
      continue
    }
    if (!isRecord(cursor)) return undefined
    cursor = cursor[segment]
  }

  return cursor
}

/**
 * The first candidate the document actually carries.
 *
 * Presence, not readability, decides: a stated figure we cannot parse must
 * still be reported as unreadable rather than silently skipped in favour of the
 * next candidate, which is likely to be absent too.
 */
function readFirst(insights: Record<string, unknown>, candidates: OperandPaths): unknown {
  for (const path of candidates) {
    const value = readPath(insights, path)
    if (value !== undefined) return value
  }
  return undefined
}

/**
 * Whether any candidate exists at all — as opposed to existing but being
 * unreadable.
 *
 * The distinction decides whether a check is worth showing. A document that
 * never carries a tax rate is not failing to state one; a document that states
 * `"twenty percent"` is. The first should stay quiet, the second must not.
 */
function hasAny(insights: Record<string, unknown>, candidates: OperandPaths): boolean {
  return candidates.some((path) => readPath(insights, path) !== undefined)
}

/** A money operand in minor units, plus whether the document stated it at all. */
function money(
  insights: Record<string, unknown>,
  candidates: OperandPaths,
): { minor: number | null; present: boolean } {
  const parsed = parseMoney(readFirst(insights, candidates))
  return {
    minor: parsed.value === null ? null : toMinor(parsed.value),
    present: hasAny(insights, candidates),
  }
}

export function reconcileTotals(
  insights: Record<string, unknown>,
  lineItems: LineItemsVM,
  specs: ReconcileSpec[],
  warnings: Warning[],
): ReconcileCheck[] {
  if (specs.length === 0) return []

  const currency = resolveCurrency(insights, specs)
  const lineTotalIndex = lineItems.columns.findIndex((column) => column.id === 'line_total')

  // Tolerance scales with the number of contributing rows: each rounded line
  // total can be off by up to half a cent, and they accumulate.
  const tolerance = Math.max(1, lineItems.rows.length)

  const built = specs.map((spec) => {
    if (spec.id === 'lines_vs_subtotal') {
      return linesVsSubtotal(spec, insights, lineItems, lineTotalIndex, currency, tolerance)
    }
    if (spec.id === 'subtotal_plus_tax_vs_total') {
      return subtotalPlusTaxVsTotal(spec, insights, currency, tolerance)
    }
    return taxComponentsVsTaxAmount(spec, insights, currency, tolerance)
  })

  /*
   * A check whose figures the document simply does not carry is dropped, not
   * greyed out. Per check rather than all-or-nothing: an invoice that states a
   * tax total but splits it into no components should show the two checks it
   * can answer, and not a third row explaining that it cannot answer a
   * question nobody asked.
   */
  const checks = built.filter((entry) => !entry.inputsAbsent).map((entry) => entry.check)

  for (const check of checks) {
    if (check.status === 'MISMATCH') {
      warnings.push({
        code: 'RECONCILE_MISMATCH',
        message: `${check.label}: figures do not agree`,
        detail: check,
      })
    } else if (check.status === 'INCOMPUTABLE') {
      warnings.push({
        code: 'RECONCILE_INCOMPUTABLE',
        message: `${check.label}: ${check.reason ?? 'not enough data to verify'}`,
      })
    }
  }

  return checks
}

/**
 * The currency shown beside the figures. Read from whichever money field the
 * specs point at, falling back to the document's own `currency`.
 */
function resolveCurrency(insights: Record<string, unknown>, specs: ReconcileSpec[]): string | null {
  for (const spec of specs) {
    const operands: OperandPaths[] =
      spec.id === 'lines_vs_subtotal'
        ? [spec.subtotal]
        : spec.id === 'subtotal_plus_tax_vs_total'
          ? [spec.total, spec.subtotal, spec.taxAmount]
          : [spec.taxAmount, spec.components]

    for (const candidates of operands) {
      for (const path of candidates) {
        const parsed = parseMoney(readPath(insights, path))
        if (parsed.currency) return parsed.currency
      }
    }
  }

  return typeof insights.currency === 'string' ? insights.currency : null
}

function linesVsSubtotal(
  spec: Extract<ReconcileSpec, { id: 'lines_vs_subtotal' }>,
  insights: Record<string, unknown>,
  lineItems: LineItemsVM,
  lineTotalIndex: number,
  currency: string | null,
  tolerance: number,
): { check: ReconcileCheck; inputsAbsent: boolean } {
  const subtotal = money(insights, spec.subtotal)

  let lineSumMinor: number | null = null
  let missingLineTotals = 0

  if (lineTotalIndex !== -1 && lineItems.rows.length > 0) {
    let sum = 0
    for (const row of lineItems.rows) {
      const cell = row[lineTotalIndex]
      if (cell && cell.kind === 'money' && cell.value !== null) {
        sum += toMinor(cell.value)
      } else {
        missingLineTotals += 1
      }
    }
    lineSumMinor = sum
  }

  return {
    inputsAbsent: !subtotal.present && lineTotalIndex === -1,
    check: compare({
      id: spec.id,
      label: spec.label,
      expectedMinor: subtotal.minor,
      actualMinor: lineSumMinor,
      currency,
      tolerance,
      reason:
        missingLineTotals > 0
          ? `${missingLineTotals} line total${missingLineTotals === 1 ? '' : 's'} could not be read`
          : lineTotalIndex === -1
            ? 'No line-total column was found'
            : subtotal.minor === null
              ? 'Subtotal is missing or unreadable'
              : undefined,
      blocked: missingLineTotals > 0,
    }),
  }
}

function subtotalPlusTaxVsTotal(
  spec: Extract<ReconcileSpec, { id: 'subtotal_plus_tax_vs_total' }>,
  insights: Record<string, unknown>,
  currency: string | null,
  tolerance: number,
): { check: ReconcileCheck; inputsAbsent: boolean } {
  const subtotal = money(insights, spec.subtotal)
  const total = money(insights, spec.total)
  const stated = money(insights, spec.taxAmount)

  const rateStated = hasAny(insights, spec.taxRate)
  const rate = parsePercent(readFirst(insights, spec.taxRate))

  // A stated tax is the document's own figure; a rate is our reconstruction of
  // it. Prefer the statement, and only reconstruct when there is none.
  const derivedMinor =
    subtotal.minor === null || rate === null ? null : Math.round(subtotal.minor * rate)
  const taxMinor = stated.present ? stated.minor : derivedMinor

  const reason =
    subtotal.minor === null
      ? 'Subtotal is missing or unreadable'
      : taxMinor === null
        ? stated.present
          ? 'Tax amount is missing or unreadable'
          : 'Tax rate is missing or unreadable'
        : total.minor === null
          ? 'Total amount is missing or unreadable'
          : undefined

  return {
    inputsAbsent: !subtotal.present && !stated.present && !rateStated && !total.present,
    check: compare({
      id: spec.id,
      label: spec.label,
      expectedMinor: total.minor,
      actualMinor: subtotal.minor === null || taxMinor === null ? null : subtotal.minor + taxMinor,
      currency,
      tolerance,
      reason,
      blocked: false,
    }),
  }
}

/**
 * CGST + SGST against the tax total.
 *
 * Worth its own row because the two are what a reviewer can see on the
 * document, and a split that does not add up to the tax charged is a real
 * error — one the subtotal-plus-tax check cannot see, since it reads only the
 * total.
 */
function taxComponentsVsTaxAmount(
  spec: Extract<ReconcileSpec, { id: 'tax_components_vs_tax_amount' }>,
  insights: Record<string, unknown>,
  currency: string | null,
  tolerance: number,
): { check: ReconcileCheck; inputsAbsent: boolean } {
  const taxAmount = money(insights, spec.taxAmount)

  let sumMinor: number | null = null
  let present = 0
  let unreadable = 0

  for (const path of spec.components) {
    const value = readPath(insights, path)
    if (value === undefined) continue

    present += 1
    const parsed = parseMoney(value)
    if (parsed.value === null) {
      unreadable += 1
      continue
    }
    sumMinor = (sumMinor ?? 0) + toMinor(parsed.value)
  }

  return {
    // Nothing to compare, or nothing to compare it against.
    inputsAbsent: present === 0 || !taxAmount.present,
    check: compare({
      id: spec.id,
      label: spec.label,
      expectedMinor: taxAmount.minor,
      actualMinor: unreadable > 0 ? null : sumMinor,
      currency,
      tolerance,
      reason:
        unreadable > 0
          ? `${unreadable} tax component${unreadable === 1 ? '' : 's'} could not be read`
          : taxAmount.minor === null
            ? 'Tax amount is missing or unreadable'
            : undefined,
      blocked: false,
    }),
  }
}

/**
 * Three outcomes, not two. A missing input is INCOMPUTABLE and renders grey —
 * never red. Showing "cannot verify" as a discrepancy trains reviewers to
 * ignore the warning that eventually matters.
 */
function compare(input: {
  id: ReconcileCheck['id']
  label: string
  expectedMinor: number | null
  actualMinor: number | null
  currency: string | null
  tolerance: number
  reason?: string
  blocked: boolean
}): ReconcileCheck {
  const { id, label, expectedMinor, actualMinor, currency, tolerance, reason, blocked } = input

  if (expectedMinor === null || actualMinor === null || blocked) {
    return {
      id,
      label,
      expectedMinor,
      actualMinor,
      deltaMinor: null,
      currency,
      status: 'INCOMPUTABLE',
      reason: reason ?? 'Not enough data to verify',
    }
  }

  const deltaMinor = actualMinor - expectedMinor

  return {
    id,
    label,
    expectedMinor,
    actualMinor,
    deltaMinor,
    currency,
    status: Math.abs(deltaMinor) <= tolerance ? 'OK' : 'MISMATCH',
  }
}
