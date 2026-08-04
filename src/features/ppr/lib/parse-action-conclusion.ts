import type {
  DocumentContract,
  EvaluationContext,
  EvaluationOutcome,
  EvaluationTone,
} from '@/features/documents/contracts/types'
import { isRecord, stringify, titleCase } from '@/features/hitl/lib/primitives'

/**
 * Parse the agent's business validations (`action_conclusion.evaluations`).
 *
 * Like the doc_insights parser, this is **total**: it never throws, for any
 * input, and every failure becomes a rendered state instead.
 *
 * Reading happens in two passes. First the document's contract: each known
 * check declares which key carries its verdict and what `true` means there,
 * because the agent has no house style — `is_duplicate` answers with
 * `{ is_new }`, `is_amount_valid` with `{ is_amount_valid }`, the tax-ID checks
 * with `{ flag, message, errorCode }`, and `is_new: true` means the invoice is
 * *not* a duplicate. None of that is inferable.
 *
 * Second, for anything the contract does not recognise, a generic classifier
 * that reads only explicitly positive shapes as passes.
 *
 * That second pass is the safety net, and its rule is the one that matters:
 * **never report a pass unless the result is explicitly positive.** Anything
 * unrecognised becomes `UNRECOGNISED`, not `PASSED`. Getting this backwards is
 * the one failure that causes real harm — if a duplicate check reported a
 * duplicate in a shape we did not anticipate and we rendered it green, a
 * reviewer would approve a duplicate invoice on our say-so. An honest "review
 * this manually" costs a few seconds; a false green costs money.
 */

export type { EvaluationTone }

export interface EvaluationResultVM {
  tone: EvaluationTone
  /** The check's answer, in a reviewer's words — "Invalid Tax Id". */
  status: string
  /** Said only when the status leaves something out. */
  headline: string | null
  detail: string | null
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
  /** The worst tone across results — what the summary and the colour use. */
  tone: EvaluationTone
  /** The answer of the worst result: the row's headline word. */
  status: string
  /** The doc_insights path this check concerns, when we know it. */
  relatedPath: string | null
  /** True when the document's contract had a reader for this check. */
  recognised: boolean
}

export interface ActionConclusionVM {
  evaluations: EvaluationVM[]
  counts: Record<EvaluationTone, number>
  /** True when the agent sent no action_conclusion at all (e.g. a HITL payload). */
  absent: boolean
  raw: unknown
}

const TONE_SEVERITY: Record<EvaluationTone, number> = {
  BLOCKED: 6,
  FAILED: 5,
  WARNING: 4,
  UNRECOGNISED: 3,
  NOT_RUN: 2,
  INFO: 1,
  PASSED: 0,
}

export const TONE_LABELS: Record<EvaluationTone, string> = {
  BLOCKED: 'Blocking',
  FAILED: 'Failed',
  WARNING: 'Warning',
  UNRECOGNISED: 'Needs review',
  NOT_RUN: 'Could not run',
  INFO: 'Info',
  PASSED: 'Passed',
}

/** Tones a reviewer has to do something about, in the order they should read. */
export const ATTENTION_TONES: EvaluationTone[] = ['BLOCKED', 'FAILED', 'WARNING', 'UNRECOGNISED']

const EMPTY_COUNTS: Record<EvaluationTone, number> = {
  BLOCKED: 0,
  FAILED: 0,
  WARNING: 0,
  UNRECOGNISED: 0,
  NOT_RUN: 0,
  INFO: 0,
  PASSED: 0,
}

/**
 * The fallback classifier, for checks no contract reader claimed.
 *
 * Read in order of confidence: an explicit boolean verdict first, then an
 * explicit execution failure, then give up honestly.
 */
function classify(raw: unknown): EvaluationResultVM {
  /*
   * Here — and only here — the status is the *execution* state, because that is
   * genuinely all we know. "Failed", "Could not run" and "Needs review" are
   * accurate for a result nobody declared a reader for. A check with a reader
   * says what it actually found instead.
   */
  const build = (
    tone: EvaluationTone,
    parts: Omit<EvaluationResultVM, 'tone' | 'status'>,
  ): EvaluationResultVM => ({ tone, status: TONE_LABELS[tone], ...parts })

  if (!isRecord(raw)) {
    return build('UNRECOGNISED', {
      headline: 'The result could not be interpreted',
      detail: raw === null || raw === undefined ? null : stringify(raw),
      errorCode: null,
      data: null,
      raw,
    })
  }

  const message =
    typeof raw.message === 'string' ? raw.message : typeof raw.error === 'string' ? raw.error : null
  const errorCode = typeof raw.errorCode === 'string' ? raw.errorCode : null
  const data = raw.data ?? null

  // `flag` is the business verdict: the rule ran and reached a conclusion.
  if (typeof raw.flag === 'boolean') {
    return raw.flag
      ? build('PASSED', { headline: message, detail: null, errorCode, data, raw })
      : build('FAILED', {
          headline: message ?? 'This check did not pass',
          detail: null,
          errorCode,
          data,
          raw,
        })
  }

  if (typeof raw.success === 'boolean') {
    // `success: false` with an error message is a tool that threw, not a rule
    // that said no — the reviewer must not read a crash as a finding.
    if (!raw.success) {
      return build('NOT_RUN', {
        headline: 'This check did not complete',
        detail: message ?? 'Its outcome is unknown — verify manually.',
        errorCode,
        data,
        raw,
      })
    }

    // `success: true` means the tool completed. Whether the *check* passed is a
    // separate question the contract does not answer, so this is only a pass
    // when nothing in the payload contradicts it.
    const contradicted =
      raw.flag === false ||
      errorCode !== null ||
      (typeof raw.error === 'string' && raw.error.length > 0)

    return contradicted
      ? build('UNRECOGNISED', {
          headline: 'The result could not be interpreted',
          detail: message ?? 'Check the Raw JSON tab and verify manually.',
          errorCode,
          data,
          raw,
        })
      : build('PASSED', { headline: message, detail: null, errorCode, data, raw })
  }

  return build('UNRECOGNISED', {
    headline: 'The result could not be interpreted',
    detail: message ?? 'Check the Raw JSON tab and verify manually.',
    errorCode,
    data,
    raw,
  })
}

function fromOutcome(outcome: EvaluationOutcome, raw: unknown): EvaluationResultVM {
  return {
    tone: outcome.tone,
    status: outcome.status,
    headline: outcome.headline ?? null,
    detail: outcome.detail ?? null,
    errorCode: outcome.errorCode ?? null,
    data: isRecord(raw) ? (raw.data ?? null) : null,
    raw,
  }
}

/** The worst result, which supplies both the row's colour and its answer. */
function worst(results: EvaluationResultVM[]): EvaluationResultVM | null {
  if (results.length === 0) return null
  return results.reduce((acc, result) =>
    TONE_SEVERITY[result.tone] > TONE_SEVERITY[acc.tone] ? result : acc,
  )
}

export function parseActionConclusion(
  input: unknown,
  contract: DocumentContract,
  insights: unknown,
): ActionConclusionVM {
  const container = isRecord(input) ? input : null
  const evaluationsRaw = container ? (container.evaluations ?? container) : null

  if (!isRecord(evaluationsRaw) || Object.keys(evaluationsRaw).length === 0) {
    return { evaluations: [], counts: { ...EMPTY_COUNTS }, absent: true, raw: input }
  }

  const context: EvaluationContext = { insights: isRecord(insights) ? insights : {} }

  /** The contract's display order, carried only until sorting is done. */
  type Ranked = EvaluationVM & { order: number }

  const evaluations: Ranked[] = Object.entries(evaluationsRaw).map(([name, value]) => {
    const spec = contract.evaluations[name]

    // The contract says each evaluation holds an array, but a bare object is the
    // obvious future simplification and costs one line to accept.
    const list = Array.isArray(value) ? value : [value]

    let recognised = false

    const results = list.map((entry) => {
      if (spec && isRecord(entry)) {
        let outcome: EvaluationOutcome | null
        try {
          outcome = spec.read(entry, context)
        } catch {
          // A reader that throws is a bug in the contract, not a verdict. Fall
          // through to the classifier rather than taking the page down.
          outcome = null
        }

        if (outcome) {
          recognised = true
          return fromOutcome(outcome, entry)
        }
      }

      return classify(entry)
    })

    const leading = worst(results)

    return {
      id: name,
      label: spec?.label ?? titleCase(name),
      results,
      tone: leading?.tone ?? 'UNRECOGNISED',
      status: leading?.status ?? TONE_LABELS.UNRECOGNISED,
      relatedPath: spec?.relatedPath ?? null,
      recognised,
      order: spec?.order ?? Number.MAX_SAFE_INTEGER,
    }
  })

  const counts = { ...EMPTY_COUNTS }
  for (const evaluation of evaluations) counts[evaluation.tone] += 1

  /*
   * The contract's declared order, not worst-first. Sorting by severity makes
   * the list rearrange itself between documents — the same check appears in a
   * different place depending on what else went wrong — and it re-creates the
   * split between "problems" and "everything else" that the panel deliberately
   * does not have. A fixed order is one list a reviewer learns once. Colour and
   * the summary line carry severity instead.
   */
  evaluations.sort((a, b) => a.order - b.order)

  return {
    evaluations: evaluations.map(({ order: _order, ...rest }) => rest),
    counts,
    absent: false,
    raw: input,
  }
}

/** Problems indexed by the doc_insights path they concern, for field markers. */
export function failuresByFieldPath(vm: ActionConclusionVM): Map<string, EvaluationVM[]> {
  const map = new Map<string, EvaluationVM[]>()

  for (const evaluation of vm.evaluations) {
    if (!evaluation.relatedPath) continue
    if (!ATTENTION_TONES.includes(evaluation.tone)) continue

    const existing = map.get(evaluation.relatedPath) ?? []
    existing.push(evaluation)
    map.set(evaluation.relatedPath, existing)
  }

  return map
}
