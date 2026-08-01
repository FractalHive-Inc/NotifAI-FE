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

export type ApprovalType = 'HITL' | 'DOCUMENT' | 'TRANSACTION'

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECLASSIFY'
export const ApprovalStatus = {
  PENDING: 'PENDING' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
  RECLASSIFY: 'RECLASSIFY' as const,
}

/** Whether the agent was successfully told about the decision. */
export type CallbackStatus = 'PENDING' | 'SENT' | 'FAILED'

/** What the reviewer can do on the HITL page. */
export type ApprovalAction = 'APPROVE' | 'RECLASSIFY' | 'REJECT'

/**
 * The document types the agent recognises. `UNKNOWN` is not something the agent
 * sends — it is what the platform sends back when a reviewer rejects.
 */
export type CorrectUseCase = 'commercial_invoice' | 'purchase_order' | 'UNKNOWN'

export const DOCUMENT_TYPE_OPTIONS: Array<{ value: CorrectUseCase; label: string }> = [
  { value: 'commercial_invoice', label: 'Commercial Invoice' },
  { value: 'purchase_order', label: 'Purchase Order' },
]

export const CORRECT_USE_CASE_LABELS: Record<CorrectUseCase, string> = {
  commercial_invoice: 'Commercial Invoice',
  purchase_order: 'Purchase Order',
  UNKNOWN: 'Unknown',
}

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
  created_at: string
  updated_at: string
}

/** A row in the Tasks list — the approval plus the columns joined from the request. */
export interface ApprovalListItem extends Approval {
  use_case: UseCase | null
  source: string | null
  job_id: string | null
  confidence_score: number | null
}

/** The detail response, with the full agent request embedded. */
export interface ApprovalDetail extends Approval {
  agent_request: AgentRequest | null
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
