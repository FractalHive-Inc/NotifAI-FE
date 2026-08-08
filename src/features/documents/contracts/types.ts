import type { ReconcileSpec, SectionSpec } from '@/features/hitl/lib/types'

/**
 * What we know about one kind of document.
 *
 * The agent's state has two layers. The **envelope** —
 * `use_case`, `confidence_score`, `classification_status` — is the same for
 * every document and is typed in `@/types/approvals`. The **payload** —
 * `doc_insights` and `action_conclusion` — differs per document type, and
 * `classification_status.correct_use_case` is the discriminator that says
 * which. (`use_case` is HITL vs PPR: it selects the *page*, never the
 * document type.)
 *
 * A `DocumentContract` is everything the second layer needs: which fields
 * exist and where they live, which arithmetic is worth checking, how to read
 * each business validation, and what must be true before a reviewer may
 * approve. Adding a document type is adding a file here, not editing a parser.
 *
 * These live in the frontend deliberately, for the reason set out in
 * `parse-doc-insights.ts`: the backend stores `state` verbatim, so drift from
 * the agent breaks *rendering*, not *ingestion*, and the fix ships on a
 * frontend deploy with no migration. That matters more as document types
 * multiply, not less.
 */
export interface DocumentContract {
  /** Matches `classification_status.correct_use_case`. */
  id: string
  label: string
  sections: SectionSpec[]
  /**
   * How to find the line-items block. Patterns rather than a fixed key,
   * because the key is human-readable prose and drifts. `null` for documents
   * that have no line items.
   */
  lineItems: { patterns: RegExp[] } | null
  /** Empty means this document has no arithmetic worth checking. */
  reconciliation: ReconcileSpec[]
  /** Keyed by the name the agent uses in `action_conclusion.evaluations`. */
  evaluations: Record<string, EvaluationSpec>
  /** Rules that must hold before a reviewer may approve. */
  gates: DecisionGate[]
}

/**
 * How a validation reads to a reviewer.
 *
 * Seven tones, not two, because they call for different actions. `PASSED` and
 * `FAILED` are the obvious pair; the other five exist because the agent's
 * results are not always verdicts:
 *
 *  - `WARNING` — the rule ran and reached a conclusion that is not wrong, but
 *    is worth a second look before approving.
 *  - `INFO` — context, no judgement implied.
 *  - `BLOCKED` — a condition that must be resolved before approval is possible
 *    at all. The only tone that disables the Approve button.
 *  - `NOT_RUN` — the tool threw. *Nothing is known.* Not a finding.
 *  - `UNRECOGNISED` — the result arrived in a shape no reader understands.
 */
export type EvaluationTone =
  | 'BLOCKED'
  | 'FAILED'
  | 'WARNING'
  | 'UNRECOGNISED'
  | 'NOT_RUN'
  | 'INFO'
  | 'PASSED'

export interface EvaluationOutcome {
  tone: EvaluationTone
  /**
   * The check's *answer*, in a reviewer's words — "Invalid Tax Id", "New
   * purchase order", "No duplicate found". This is what the row shows.
   *
   * Never "Failed". These checks return a business verdict, and "failed" reads
   * as the tool having crashed — a reviewer seeing it beside a tax ID cannot
   * tell whether the ID is bad or the checker is. Only the generic classifier
   * may say "Failed", because there it is exactly what it means.
   */
  status: string
  /** Said only when the status on its own leaves something out. */
  headline?: string
  /** What to do about it, when that is not obvious. */
  detail?: string
  errorCode?: string | null
}

/** Everything a reader may consult besides its own result object. */
export interface EvaluationContext {
  insights: Record<string, unknown>
}

/**
 * Dotted `doc_insights` path(s) a rule concerns, for the marker shown against
 * the field itself. A list covers a field the agent has renamed — the marker
 * has to land on `total_amount` today and on `amount` in an older payload, and
 * the alias that keeps both rendering must not cost the marker.
 */
export type RelatedPath = string | string[]

export interface EvaluationSpec {
  label: string
  /** Display order among checks of equal severity. */
  order: number
  relatedPath?: RelatedPath
  /**
   * Read one result object into an outcome.
   *
   * **Return `null` for any shape not positively recognised.** The caller then
   * falls back to the generic classifier, which reports `UNRECOGNISED` rather
   * than guessing — because guessing "passed" is how a genuine duplicate gets
   * approved. A reader that cannot be sure must say so, not assume.
   */
  read(result: Record<string, unknown>, context: EvaluationContext): EvaluationOutcome | null
}

/**
 * A condition that blocks approval.
 *
 * Separate from the evaluations on purpose: a gate must hold whether or not
 * the agent ran the corresponding check. An invoice with no PO reference is
 * unapprovable even if `action_conclusion` never mentions purchase orders.
 */
export interface DecisionGate {
  id: string
  title: string
  /** Shown in the banner and on the disabled button's tooltip. */
  reason: string
  relatedPath?: RelatedPath
  when(context: EvaluationContext): boolean
}

/** One path or several, always as a list. */
export function relatedPaths(path: RelatedPath | undefined): string[] {
  if (path === undefined) return []
  return Array.isArray(path) ? path : [path]
}
