import { describe, expect, it } from 'vitest'
import type { ApprovalDetail } from '@/types/approvals'
import { documentNumber } from '../document-id'

/**
 * An approval carrying whatever the agent extracted. `doc_insights` is `unknown`
 * on the type for a reason, so the tests below feed it shapes the agent could
 * plausibly produce — including ones it should not.
 */
function approval(docInsights: unknown): ApprovalDetail {
  return { agent_request: { state: { doc_insights: docInsights } } } as ApprovalDetail
}

describe('documentNumber', () => {
  it('reads the invoice number', () => {
    expect(documentNumber(approval({ invoice_number: 'INV-PHI-2024-0045' }))).toBe(
      'INV-PHI-2024-0045',
    )
  })

  it('falls back to the purchase order number', () => {
    expect(documentNumber(approval({ purchase_order_number: 'PO-FRA-7526' }))).toBe('PO-FRA-7526')
  })

  /**
   * The invoice wins, matching the backend's COALESCE. An invoice keeps its PO
   * reference nested under `purchase_order`, so a top-level collision means the
   * payload is unusual — and the invoice is still the number on the page.
   */
  it('prefers the invoice number when both are present', () => {
    const both = { invoice_number: 'INV-1', purchase_order_number: 'PO-1' }
    expect(documentNumber(approval(both))).toBe('INV-1')
  })

  it('returns null when neither number was extracted', () => {
    expect(documentNumber(approval({ seller_details: { name: 'Apex' } }))).toBeNull()
  })

  /** A blank string is not a label — the caller needs to fall back to the id. */
  it('treats an empty number as missing', () => {
    expect(documentNumber(approval({ invoice_number: '' }))).toBeNull()
  })

  it('survives a doc_insights that is not an object', () => {
    expect(documentNumber(approval('unparsed'))).toBeNull()
    expect(documentNumber(approval(null))).toBeNull()
    expect(documentNumber(approval([{ invoice_number: 'INV-1' }]))).toBeNull()
  })

  /** A non-string number is the agent breaking its own shape, not a label. */
  it('ignores a number that is not a string', () => {
    expect(documentNumber(approval({ invoice_number: 42 }))).toBeNull()
  })

  it('handles an approval with no agent request at all', () => {
    expect(documentNumber(undefined)).toBeNull()
    expect(documentNumber({ agent_request: null } as ApprovalDetail)).toBeNull()
  })
})
