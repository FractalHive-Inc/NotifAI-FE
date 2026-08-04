import { isRecord, parseMoney, parsePercent } from './primitives'
import type { FieldPath, LineItemsVM, ReconcileCheck, ReconcileSpec, Warning } from './types'

/**
 * Check that the document's numbers add up.
 *
 * Which checks are worth running is a property of the document type, so the
 * document's contract supplies the specs and this module supplies the
 * arithmetic. A purchase order declares none and gets none — better than a card
 * of grey "not verifiable" rows, which teaches reviewers to skip the panel on
 * the documents where it does mean something.
 *
 * For an invoice the two checks are:
 *   sum(line totals)          == subtotal_ex_tax
 *   subtotal * (1 + vat_rate) == amount
 *
 * All arithmetic is in integer minor units. Summing nine floating-point currency
 * values accumulates error; integer cents do not. Rounding also means the second
 * check does not hold exactly — on a real sample, 2,028,509.88 x 1.2 is
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
 * Whether the key exists at all — as opposed to existing but being unreadable.
 *
 * The distinction decides whether a check is worth showing. A document that
 * never carries a VAT rate is not failing to state one; a document that states
 * `"twenty percent"` is. The first should stay quiet, the second must not.
 */
function hasPath(insights: Record<string, unknown>, path: FieldPath): boolean {
  return readPath(insights, path) !== undefined
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

  const built = specs.map((spec) =>
    spec.id === 'lines_vs_subtotal'
      ? linesVsSubtotal(spec, insights, lineItems, lineTotalIndex, currency, tolerance)
      : subtotalPlusVatVsAmount(spec, insights, currency, tolerance),
  )

  // Nothing to reconcile against: the document simply does not carry these
  // figures. Report nothing rather than a card of grey rows.
  if (built.every((entry) => entry.inputsAbsent)) return []

  const checks = built.map((entry) => entry.check)

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
    const paths: FieldPath[] =
      spec.id === 'lines_vs_subtotal' ? [spec.subtotal] : [spec.amount, spec.subtotal]

    for (const path of paths) {
      const parsed = parseMoney(readPath(insights, path))
      if (parsed.currency) return parsed.currency
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
  const subtotal = parseMoney(readPath(insights, spec.subtotal))
  const subtotalMinor = subtotal.value === null ? null : toMinor(subtotal.value)

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
    inputsAbsent: !hasPath(insights, spec.subtotal) && lineTotalIndex === -1,
    check: compare({
      id: spec.id,
      label: spec.label,
      expectedMinor: subtotalMinor,
      actualMinor: lineSumMinor,
      currency,
      tolerance,
      reason:
        missingLineTotals > 0
          ? `${missingLineTotals} line total${missingLineTotals === 1 ? '' : 's'} could not be read`
          : lineTotalIndex === -1
            ? 'No line-total column was found'
            : subtotalMinor === null
              ? 'Subtotal is missing or unreadable'
              : undefined,
      blocked: missingLineTotals > 0,
    }),
  }
}

function subtotalPlusVatVsAmount(
  spec: Extract<ReconcileSpec, { id: 'subtotal_plus_vat_vs_amount' }>,
  insights: Record<string, unknown>,
  currency: string | null,
  tolerance: number,
): { check: ReconcileCheck; inputsAbsent: boolean } {
  const subtotal = parseMoney(readPath(insights, spec.subtotal))
  const amount = parseMoney(readPath(insights, spec.amount))
  const vatRate = parsePercent(readPath(insights, spec.vatRate))

  const subtotalMinor = subtotal.value === null ? null : toMinor(subtotal.value)
  const amountMinor = amount.value === null ? null : toMinor(amount.value)

  return {
    inputsAbsent:
      !hasPath(insights, spec.subtotal) &&
      !hasPath(insights, spec.vatRate) &&
      !hasPath(insights, spec.amount),
    check: compare({
      id: spec.id,
      label: spec.label,
      expectedMinor: amountMinor,
      actualMinor:
        subtotalMinor === null || vatRate === null
          ? null
          : Math.round(subtotalMinor * (1 + vatRate)),
      currency,
      tolerance,
      reason:
        subtotalMinor === null
          ? 'Subtotal is missing or unreadable'
          : vatRate === null
            ? 'VAT rate is missing or unreadable'
            : amountMinor === null
              ? 'Total amount is missing or unreadable'
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
