import type { EvaluationOutcome, EvaluationSpec } from './types'

/**
 * Shared building blocks for evaluation readers.
 *
 * The agent's results have no house style: `is_duplicate` answers with
 * `{ is_new }`, `is_amount_valid` with `{ is_amount_valid }`, the tax-ID checks
 * with `{ flag, message, errorCode }`. The verdict key differs, and so does its
 * polarity — `is_new: true` means the invoice is *not* a duplicate, so a check
 * named for the bad outcome reports the good one.
 *
 * None of that can be inferred. Each check declares which key carries its
 * verdict and what `true` means, and these helpers keep that declaration to a
 * line or two.
 *
 * Both helpers take the *answer* for each branch rather than a pass/fail label.
 * A reviewer needs to know that a tax ID is invalid, not that a check "failed" —
 * the second is ambiguous between a bad ID and a broken checker.
 */

/** A boolean at `key`, or null when it is absent or not a boolean. */
export function readBoolean(result: Record<string, unknown>, key: string): boolean | null {
  return typeof result[key] === 'boolean' ? result[key] : null
}

export function readText(result: Record<string, unknown>, key: string): string | null {
  const value = result[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * A check whose verdict is a single boolean.
 *
 * `goodWhen` states the polarity explicitly rather than deriving it from the
 * key name, because the two disagree as often as they agree.
 */
export function booleanVerdict(options: {
  key: string
  goodWhen: boolean
  /** The answer when the check is satisfied, e.g. "No duplicate found". */
  pass: string
  /** The answer when it is not, e.g. "Invalid Amount". */
  fail: string
  failHeadline?: string
  failDetail?: string
  failTone?: EvaluationOutcome['tone']
}): EvaluationSpec['read'] {
  return (result) => {
    const value = readBoolean(result, options.key)
    if (value === null) return null

    return value === options.goodWhen
      ? { tone: 'PASSED', status: options.pass }
      : {
          tone: options.failTone ?? 'FAILED',
          status: options.fail,
          headline: options.failHeadline,
          detail: options.failDetail,
        }
  }
}

/**
 * The `{ flag, message, errorCode }` shape, used by both tax-ID checks.
 *
 * `message` and `errorCode` are deliberately not surfaced. "Invalid GSTIN
 * Number." beside a row already labelled "Is Seller Tax Id Valid" restates the
 * answer, and `INVALID_GSTNUMBER` is an identifier for us, not information for
 * a reviewer. Both remain in the Raw JSON tab for anyone debugging.
 */
export function flagVerdict(options: { pass: string; fail: string }): EvaluationSpec['read'] {
  return (result) => {
    const flag = readBoolean(result, 'flag')
    if (flag === null) return null

    return flag
      ? { tone: 'PASSED', status: options.pass }
      : { tone: 'FAILED', status: options.fail }
  }
}
