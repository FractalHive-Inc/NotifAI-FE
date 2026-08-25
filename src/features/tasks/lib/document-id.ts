import type { ApprovalDetail } from '@/types/approvals'

/**
 * The number printed on the document — what the Tasks list calls "Document Id".
 *
 * Not `approval.document_id`. That column is the FK to `nai.documents` and is
 * NULL on every agent-request-backed task, because an approval carries either a
 * request or a document and never both. The list endpoint computes its
 * `document_id` from the agent state instead, so anything outside that endpoint
 * has to repeat the derivation or the two screens disagree about what a task is
 * called.
 *
 * Invoice first, then purchase order: each document type prints a different
 * number and the two never collide — an invoice keeps its PO reference nested
 * under `purchase_order` rather than at the top level.
 *
 * The `typeof` guards are not defensive noise. `doc_insights` is `unknown` by
 * design; the agent promises nothing about its shape, and a payload that is not
 * what we expect should cost a fallback label, not a crash in the layout.
 */
export function documentNumber(approval: ApprovalDetail | undefined): string | null {
  const insights = approval?.agent_request?.state?.doc_insights
  if (!insights || typeof insights !== 'object') return null

  const record = insights as Record<string, unknown>
  const value = record.invoice_number ?? record.purchase_order_number

  return typeof value === 'string' && value ? value : null
}
