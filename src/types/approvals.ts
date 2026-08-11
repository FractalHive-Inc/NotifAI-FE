/**
 * Approval types, mirroring the backend's `nai.approvals` and
 * `nai.agent_requests` rows verbatim (snake_case, hand-maintained).
 *
 * Enums are the `type` + `const` pair rather than a TS `enum` — the app's
 * tsconfig sets `erasableSyntaxOnly`, so `enum` will not compile.
 */

export type UseCase = 'HITL' | 'PPR'
export const UseCase = {
  HITL: 'HITL' as const,
  PPR: 'PPR' as const,
}

/**
 * Which kind of approval a task is, mirroring `nai.approval_type_enum`.
 *
 * `PPR` and `HITL` both hang off an agent request; `DOCUMENT` references a
 * stored document, and `TRANSACTION` is declared in the enum but not yet
 * satisfiable — `nai.transactions` does not exist.
 *
 * Note this is *not* the same axis as `UseCase`, which selects the review page.
 * Nothing in the app reads `approval_type` today; it is here so the row type
 * matches what the API actually returns.
 */
export type ApprovalType = 'HITL' | 'PPR' | 'DOCUMENT' | 'TRANSACTION'

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECLASSIFY'
export const ApprovalStatus = {
  PENDING: 'PENDING' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
  RECLASSIFY: 'RECLASSIFY' as const,
}

/** Whether the agent was successfully told about the decision. */
export type CallbackStatus = 'PENDING' | 'SENT' | 'FAILED'

/** Whether an approved document reached Tally as a purchase voucher. */
export type TallyPushStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

/** What the reviewer can do on the HITL page. */
export type ApprovalAction = 'APPROVE' | 'RECLASSIFY' | 'REJECT'

/**
 * The document types the agent recognises. `UNKNOWN` is not something the agent
 * sends — it is what the platform sends back when a reviewer rejects.
 *
 * Open rather than closed: the set grows as documents are added, and a value
 * this build has never heard of is a rendering question, not a type error. What
 * each type *means* — its fields, checks, and labels — lives in
 * `features/documents/contracts`, which is also where the selectable list and
 * the display labels are derived from. Keeping a second list here is how a new
 * document type ends up renderable but not selectable.
 */
export type CorrectUseCase = 'commercial_invoice' | 'purchase_order' | 'UNKNOWN' | (string & {})

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RECLASSIFY: 'Reclassified',
}

export interface ClassificationStatus {
  extraction_status: 'CLASSIFIED' | 'RECLASSIFY'
  correct_use_case: string
}

/**
 * The agent's state. Only the outer shape is known — `doc_insights` is
 * deliberately `unknown`, because the parser in `features/hitl/lib` is the only
 * thing allowed to interpret it, and typing it here would imply a guarantee the
 * agent does not give.
 */
export interface AgentState {
  doc_insights?: unknown
  confidence_score?: number
  classification_status?: ClassificationStatus
  [key: string]: unknown
}

export interface AgentRequest {
  id: string
  idempotency_key: string
  job_id: string
  thread_id: string
  source: string
  use_case: UseCase
  message: string | null
  state: AgentState
  confidence_score: number | null
  status: string
  received_at: string
  created_at: string
  updated_at: string
}

export interface Approval {
  id: string
  approval_type: ApprovalType
  status: ApprovalStatus
  agent_request_id: string | null
  document_id: string | null
  assignee_email: string
  thread_id: string | null
  decision: Record<string, unknown> | null
  comments: string | null
  decided_by: string | null
  decided_by_email: string | null
  decided_at: string | null
  callback_status: CallbackStatus | null
  callback_error: string | null
  callback_at: string | null
  callback_attempts: number
  /**
   * The second downstream, and a separate axis from `callback_status`.
   *
   * That one is whether the agent heard the decision; this is whether the
   * document reached Tally. No approval has both: HITL owes the agent a
   * callback and has nothing to post, PPR is the reverse. NULL therefore means
   * "nothing is owed to Tally" — every HITL task, and every rejected or
   * still-pending document approval.
   */
  tally_status: TallyPushStatus | null
  tally_voucher_id: string | null
  tally_error: string | null
  tally_at: string | null
  tally_attempts: number
  created_at: string
  updated_at: string
}

/**
 * A row in the Tasks list — the approval plus the columns joined from the
 * request, and the few values projected out of the agent's `state`.
 *
 * Those last four are slices, not the whole extraction: the list polls every
 * five seconds, so it is served what it renders and nothing more. They stay
 * `unknown` for the same reason `AgentState.doc_insights` does — the agent
 * makes no promise about their shape, and the parsers are the only things
 * allowed to decide what they mean.
 */
export interface ApprovalListItem extends Approval {
  use_case: UseCase | null
  source: string | null
  job_id: string | null
  confidence_score: number | null
  /** The number printed on the document: the invoice's, or the PO's. */
  document_id: string | null
  /** The counterparty the document is from — `seller_details.name`. */
  customer_name: string | null
  /** The agent's classification, e.g. `commercial_invoice`. Resolved via `getContract`. */
  document_type: string | null
  /** The agent's business validations, verbatim. */
  action_conclusion: unknown
  /** The PO reference alone — what the PO checks need to reach a verdict. */
  purchase_order: unknown
}

/** The detail response, with the full agent request embedded. */
export interface ApprovalDetail extends Approval {
  agent_request: AgentRequest | null
}

/**
 * What the backend recorded when the decision was made.
 *
 * `doc_insights` is the *approved* extraction: the reviewer's corrections when
 * they made any, the agent's original otherwise. The untouched original always
 * stays on `agent_request.state.doc_insights`, so the pair is what shows a
 * reviewer which values are theirs — see `lib/diff-insights`.
 */
export interface DecisionRecord {
  action?: ApprovalAction
  extraction_status?: string
  correct_use_case?: string
  doc_insights?: unknown
  edited?: boolean
}

export function decisionRecord(approval: ApprovalDetail): DecisionRecord {
  return (approval.decision ?? {}) as DecisionRecord
}

/**
 * The extraction to render: what was approved, or what the agent extracted if
 * nothing has been decided yet.
 *
 * Without this, a decided task shows the agent's original values with no sign
 * that a human corrected them — the corrections are recorded, published and
 * filed, and invisible on the one page that exists to show them.
 */
export function displayedInsights(approval: ApprovalDetail): unknown {
  const decided = decisionRecord(approval)
  return decided.doc_insights ?? approval.agent_request?.state?.doc_insights
}

export interface ApprovalListResponse {
  approvals: ApprovalListItem[]
  pagination: { page: number; limit: number; total: number; total_pages: number }
}

export interface ApprovalFilters {
  status?: ApprovalStatus
  use_case?: UseCase
  source?: string
}

export interface DecisionInput {
  action: ApprovalAction
  correct_use_case?: CorrectUseCase
  comments?: string | null
  /** Sent only when the reviewer actually changed something. */
  doc_insights?: Record<string, unknown>
}

export interface DocumentUrlResponse {
  filename: string
  content_type: string
  /**
   * True when the backend will serve HTML it converted from the source file
   * (.docx) rather than the file itself. Decides how the preview frames it —
   * see DocumentPreviewPane.
   */
  converted: boolean
  expires_at: string | null
  provider: string
}

/**
 * Normalise confidence for display.
 *
 * The contract does not say whether the scale is 0..1 or 0..100, and both appear
 * in the wild, so the guess lives in exactly one place. Not shown on the HITL
 * page itself — only in the Tasks list.
 */
export function formatConfidence(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${Math.round(value <= 1 ? value * 100 : value)}%`
}

/**
 * The decision was recorded but never reached the system waiting on it. Not a
 * failure of the task itself — hence a separate marker rather than a status.
 *
 * Each use case has exactly one downstream, and the check has to follow the
 * right one. HITL owes the agent a callback and leaves the document stuck
 * mid-extraction without it. PPR owes Tally a purchase voucher, and only when
 * the reviewer approved — a rejected document is posted nowhere, which is why
 * this reads `tally_status` rather than deriving anything from the decision.
 *
 * A NULL on the relevant axis means nothing was ever owed, so there is nothing
 * to warn about.
 *
 * Lives here rather than on the Tasks page because the dashboard counts these
 * too, and two copies of this rule would eventually disagree about how many
 * there are.
 */
export function isUndelivered(row: ApprovalListItem): boolean {
  if (row.status === 'PENDING') return false

  if (row.use_case === 'PPR') {
    return row.tally_status !== null && row.tally_status !== 'SUCCESS'
  }

  return row.use_case === 'HITL' && row.callback_status !== 'SENT'
}
