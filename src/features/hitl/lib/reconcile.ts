import { asRecord, parseMoney, parsePercent } from './primitives'
import type { LineItemsVM, ReconcileCheck, Warning } from './types'

/**
 * Check that the invoice's numbers add up.
 *
 * This is the only automated signal on the HITL page: confidence is hidden, and
 * the agent's validation results (`action_conclusion`) do not exist yet at HITL
 * time because business actions run *after* extraction. So without this, the
 * reviewer has nothing pointing them at where to look.
 *
 * Two checks:
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

export function reconcileTotals(
  insights: Record<string, unknown>,
  lineItems: LineItemsVM,
  warnings: Warning[],
): ReconcileCheck[] {
  const extra = asRecord(insights.extra_fields) ?? {}

  const amount = parseMoney(insights.amount)
  const subtotal = parseMoney(extra.subtotal_ex_tax)
  const vatRate = parsePercent(extra.vat_rate)
  const currency =
    amount.currency ??
    subtotal.currency ??
    (typeof insights.currency === 'string' ? insights.currency : null)

  const lineTotalIndex = lineItems.columns.findIndex((column) => column.id === 'line_total')

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

  // Tolerance scales with the number of contributing rows: each rounded line
  // total can be off by up to half a cent, and they accumulate.
  const tolerance = Math.max(1, lineItems.rows.length)

  const subtotalMinor = subtotal.value === null ? null : toMinor(subtotal.value)
  const amountMinor = amount.value === null ? null : toMinor(amount.value)

  const checks: ReconcileCheck[] = [
    compare({
      id: 'lines_vs_subtotal',
      label: 'Line totals vs subtotal',
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
    compare({
      id: 'subtotal_plus_vat_vs_amount',
      label: 'Subtotal + VAT vs total',
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
  ]

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
