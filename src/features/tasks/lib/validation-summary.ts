import { getContract } from '@/features/documents/contracts'
import {
  parseActionConclusion,
  type EvaluationTone,
  type EvaluationVM,
} from '@/features/ppr/lib/parse-action-conclusion'
import type { ApprovalListItem } from '@/types/approvals'

/**
 * The Validations column: one line per document, from the same parse the review
 * page uses.
 *
 * It deliberately reuses `parseActionConclusion` rather than reading
 * `action_conclusion` directly. The rule that matters there — never report a
 * pass unless the result is explicitly positive — has to hold here too, and it
 * would not survive being reimplemented for a table cell. A reviewer who sees a
 * green tick in the list has no reason to open the task, so a false green costs
 * more here than anywhere else in the app.
 */

export type ValidationSummary =
  /** The agent sent no validations — every HITL task, and any payload without them. */
  | { kind: 'ABSENT' }
  /** Every check ran and was satisfied. The only state that renders green. */
  | { kind: 'ALL_PASSED' }
  /** At least one check needs the reviewer. Never empty. */
  | { kind: 'ISSUES'; issues: ValidationIssue[] }

export interface ValidationIssue {
  id: string
  /** What the column says — see `COLUMN_LABELS`. */
  label: string
  tone: EvaluationTone
  /** The check's full name, for the row's tooltip. */
  title: string
}

/**
 * Column wording for checks whose own answer is too terse to stand alone.
 *
 * On the review page each answer sits beside the check's name — "Is Seller Tax
 * Id Valid: Invalid Tax Id" — so the answer alone is enough. A table cell has
 * no such neighbour, and both tax checks answer with the identical string, so a
 * bare "Invalid Tax Id" would leave a reviewer unable to tell which party is
 * wrong without opening the task.
 *
 * Only failures are ever labelled from here, so these read as problems. The
 * fallback is the check's own answer, which means a new check needs no entry —
 * it just has to phrase its failure as a finding, which the contracts already do.
 */
const COLUMN_LABELS: Record<string, string> = {
  validate_seller_gstin: 'Invalid Seller GSTIN',
  // The names the seller check went by before it was split in two. The contract
  // registers them as aliases, but the view model is keyed by whichever name
  // the payload actually used, so each needs its own entry here.
  validate_gstin: 'Invalid Seller GSTIN',
  validate_vendor_gstin: 'Invalid Seller GSTIN',
  validate_buyer_gstin: 'Invalid Buyer GSTIN',
  is_purchase_order: 'No PO referenced',
}

/**
 * Tones a reviewer must act on.
 *
 * Wider than the review page's `ATTENTION_TONES` by one: `NOT_RUN` is included
 * because a check that crashed leaves its question unanswered, and a column
 * that showed "All passed" over a duplicate check that never ran would be
 * asserting something nobody verified. It surfaces as an issue and says so.
 *
 * `INFO` is excluded: "New purchase order" is a fact about the order, not a
 * problem with the document, and a row carrying only INFO has genuinely passed
 * everything that was asked of it.
 */
const ISSUE_TONES: EvaluationTone[] = ['BLOCKED', 'FAILED', 'WARNING', 'UNRECOGNISED', 'NOT_RUN']

function toIssue(evaluation: EvaluationVM): ValidationIssue {
  return {
    id: evaluation.id,
    label: COLUMN_LABELS[evaluation.id] ?? evaluation.status,
    tone: evaluation.tone,
    title: `${evaluation.label}: ${evaluation.status}`,
  }
}

export function summariseValidations(row: ApprovalListItem): ValidationSummary {
  const contract = getContract(row.document_type)

  /*
   * The PO reference is the one piece of the extraction the checks read, and
   * the list is served only that (see the backend's list query). Passing the
   * slice as a partial `doc_insights` is what lets the PO check tell "this
   * invoice names no purchase order" — which blocks approval — apart from a PO
   * that is simply new. Handing it an empty object instead would report every
   * document as blocked.
   */
  const vm = parseActionConclusion(row.action_conclusion, contract, {
    purchase_order: row.purchase_order,
  })

  if (vm.absent || vm.evaluations.length === 0) return { kind: 'ABSENT' }

  const issues = vm.evaluations.filter((e) => ISSUE_TONES.includes(e.tone)).map(toIssue)

  return issues.length === 0 ? { kind: 'ALL_PASSED' } : { kind: 'ISSUES', issues }
}

/** The document type as a reviewer reads it, from the contract registry. */
export function documentTypeLabel(row: ApprovalListItem): string | null {
  if (typeof row.document_type !== 'string' || row.document_type.trim() === '') return null
  return getContract(row.document_type).label
}
