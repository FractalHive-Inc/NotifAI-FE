import { isRecord, stringify, titleCase } from '@/features/hitl/lib/primitives'

/**
 * Parse the agent's business validations (`action_conclusion.evaluations`).
 *
 * Like the doc_insights parser, this is **total**: it never throws, for any
 * input, and every failure becomes a rendered state instead.
 *
 * The shapes observed so far are inconsistent — the agent returns
 * `{ success, error }` from one tool and `{ flag, message, errorCode }` from
 * another, and every sample seen has been negative, so no confirmed *passing*
 * shape exists yet.
 *
 * That gap drives the central rule here: **never report a pass unless the result
 * is explicitly positive.** Anything unrecognised becomes `UNRECOGNISED`, not
 * `PASSED`. Getting this backwards is the one failure that causes real harm —
 * if a duplicate check reported a duplicate in a shape we did not anticipate and
 * we rendered it green, a reviewer would approve a duplicate invoice on our say-so.
 * An honest "review this manually" costs a few seconds; a false green costs money.
 */

export type EvaluationStatus = 'PASSED' | 'FAILED' | 'NOT_RUN' | 'UNRECOGNISED'

export interface EvaluationResultVM {
  status: EvaluationStatus
  /** Business-readable where the agent gave one, else a technical message. */
  message: string | null
  errorCode: string | null
  /** Extra payload the agent returned, shown on demand rather than discarded. */
  data: unknown
  /** The untouched result, for the Raw JSON panel. */
  raw: unknown
}

export interface EvaluationVM {
  id: string
  label: string
  /** Each evaluation returns an array; usually one entry, but not guaranteed. */
  results: EvaluationResultVM[]
  /** The worst status across results — what the summary and sorting use. */
  status: EvaluationStatus
  /** The doc_insights path this check concerns, when we know it. */
  relatedPath: string | null
}

export interface ActionConclusionVM {
  evaluations: EvaluationVM[]
  counts: Record<EvaluationStatus, number>
  /** True when the agent sent no action_conclusion at all (e.g. a HITL payload). */
  absent: boolean
  raw: unknown
}

/**
 * Which extracted field each known check concerns.
 *
 * Used to pin a failure to the field it is about — a GSTIN failure belongs on
 * the seller's GST/TIN row, where the reviewer is already looking, not only in a
 * list further down the page.
 */
export const EVALUATION_FIELD_PATHS: Record<string, string> = {
  validate_vendor_gstin: 'seller_details.gst_tin',
  validate_buyer_gstin: 'buyer_details.gst_tin',
  is_purchase_order: 'purchase_order',
  is_duplicate: 'invoice_number',
}

const STATUS_SEVERITY: Record<EvaluationStatus, number> = {
  FAILED: 3,
  UNRECOGNISED: 2,
  NOT_RUN: 1,
  PASSED: 0,
}

export const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  PASSED: 'Passed',
  FAILED: 'Failed',
  NOT_RUN: 'Could not run',
  UNRECOGNISED: 'Needs review',
}

/**
 * Classify one result.
 *
 * Read in order of confidence: an explicit boolean verdict first, then an
 * explicit execution failure, then give up honestly.
 */
function classify(raw: unknown): EvaluationResultVM {
  if (!isRecord(raw)) {
    return {
      status: 'UNRECOGNISED',
      message: raw === null || raw === undefined ? null : stringify(raw),
      errorCode: null,
      data: null,
      raw,
    }
  }

  const message =
    typeof raw.message === 'string' ? raw.message : typeof raw.error === 'string' ? raw.error : null
  const errorCode = typeof raw.errorCode === 'string' ? raw.errorCode : null
  const data = raw.data ?? null

  // `flag` is the business verdict: the rule ran and reached a conclusion.
  if (typeof raw.flag === 'boolean') {
    return { status: raw.flag ? 'PASSED' : 'FAILED', message, errorCode, data, raw }
  }

  if (typeof raw.success === 'boolean') {
    // `success: false` with an error message is a tool that threw, not a rule
    // that said no — the reviewer must not read a crash as a finding.
    if (!raw.success) {
      return { status: 'NOT_RUN', message, errorCode, data, raw }
    }

    // `success: true` means the tool completed. Whether the *check* passed is a
    // separate question the contract does not answer, so this is only a pass
    // when nothing in the payload contradicts it.
    const contradicted =
      raw.flag === false ||
      errorCode !== null ||
      (typeof raw.error === 'string' && raw.error.length > 0)

    return { status: contradicted ? 'UNRECOGNISED' : 'PASSED', message, errorCode, data, raw }
  }

  return { status: 'UNRECOGNISED', message, errorCode, data, raw }
}

function worst(results: EvaluationResultVM[]): EvaluationStatus {
  if (results.length === 0) return 'UNRECOGNISED'
  return results.reduce<EvaluationStatus>(
    (acc, result) => (STATUS_SEVERITY[result.status] > STATUS_SEVERITY[acc] ? result.status : acc),
    'PASSED',
  )
}

const EMPTY_COUNTS: Record<EvaluationStatus, number> = {
  PASSED: 0,
  FAILED: 0,
  NOT_RUN: 0,
  UNRECOGNISED: 0,
}

export function parseActionConclusion(input: unknown): ActionConclusionVM {
  const container = isRecord(input) ? input : null
  const evaluationsRaw = container ? (container.evaluations ?? container) : null

  if (!isRecord(evaluationsRaw) || Object.keys(evaluationsRaw).length === 0) {
    return { evaluations: [], counts: { ...EMPTY_COUNTS }, absent: true, raw: input }
  }

  const evaluations: EvaluationVM[] = Object.entries(evaluationsRaw).map(([name, value]) => {
    // The contract says each evaluation holds an array, but a bare object is the
    // obvious future simplification and costs one line to accept.
    const list = Array.isArray(value) ? value : [value]
    const results = list.map(classify)

    return {
      id: name,
      label: titleCase(name),
      results,
      status: worst(results),
      relatedPath: EVALUATION_FIELD_PATHS[name] ?? null,
    }
  })

  const counts = { ...EMPTY_COUNTS }
  for (const evaluation of evaluations) counts[evaluation.status] += 1

  // Worst first: a reviewer opening this page should read the problems without
  // scrolling past the checks that are fine.
  evaluations.sort((a, b) => STATUS_SEVERITY[b.status] - STATUS_SEVERITY[a.status])

  return { evaluations, counts, absent: false, raw: input }
}

/** Failures indexed by the doc_insights path they concern, for field badges. */
export function failuresByFieldPath(vm: ActionConclusionVM): Map<string, EvaluationVM[]> {
  const map = new Map<string, EvaluationVM[]>()

  for (const evaluation of vm.evaluations) {
    if (!evaluation.relatedPath) continue
    if (evaluation.status === 'PASSED') continue

    const existing = map.get(evaluation.relatedPath) ?? []
    existing.push(evaluation)
    map.set(evaluation.relatedPath, existing)
  }

  return map
}
