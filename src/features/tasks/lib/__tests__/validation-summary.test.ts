import { describe, expect, it } from 'vitest'
import gstState from '@/features/documents/__fixtures__/commercial-invoice-gst-state.json'
import type { ApprovalListItem } from '@/types/approvals'
import { documentTypeLabel, summariseValidations } from '../validation-summary'

/**
 * The list row as the backend now builds it: the four slices projected out of
 * `agent_requests.state`, and nothing else from the extraction. Building the
 * fixture row the same way the SQL does is the point — a test fed the whole
 * `doc_insights` would pass while the real column, which never receives it,
 * reported something different.
 */
function row(overrides: Partial<ApprovalListItem> = {}): ApprovalListItem {
  return {
    customer_name: gstState.doc_insights.seller_details.name,
    document_type: gstState.classification_status.correct_use_case,
    action_conclusion: { evaluations: CLEAN },
    purchase_order: gstState.doc_insights.purchase_order,
    ...overrides,
  } as ApprovalListItem
}

/**
 * An invoice where every check was satisfied.
 *
 * Written out rather than taken from a fixture: both stored payloads have
 * failures in them, and a baseline that is already red cannot show that a
 * single injected failure is what turned the column red.
 */
const CLEAN = {
  is_duplicate: [{ is_new: true }],
  validate_seller_gstin: [{ flag: true, message: 'Valid GSTIN Number.' }],
  validate_buyer_gstin: [{ flag: true, message: 'Valid GSTIN Number.' }],
  is_amount_valid: [{ is_amount_valid: true }],
  is_purchase_order: [{ is_purchase_order_new: true }],
}

const labels = (r: ApprovalListItem) => {
  const summary = summariseValidations(r)
  return summary.kind === 'ISSUES' ? summary.issues.map((issue) => issue.label) : []
}

/** Break exactly one check, leaving the rest of a clean invoice untouched. */
const withEvaluation = (name: string, value: unknown) =>
  row({ action_conclusion: { evaluations: { ...CLEAN, [name]: value } } })

describe('summariseValidations', () => {
  it('goes green only when every check was satisfied', () => {
    expect(summariseValidations(row()).kind).toBe('ALL_PASSED')
  })

  /*
   * "New purchase order" is a fact about the order, not a complaint about the
   * document — an INFO row must not keep an otherwise clean invoice out of green.
   */
  it('does not treat an informational check as a problem', () => {
    const existing = withEvaluation('is_purchase_order', [{ is_purchase_order_new: false }])
    expect(summariseValidations(existing).kind).toBe('ALL_PASSED')
  })

  it('reports the stored sample exactly as the review page does', () => {
    expect(labels(row({ action_conclusion: gstState.action_conclusion }))).toEqual([
      'Invalid Seller GSTIN',
      'Invalid Buyer GSTIN',
    ])
  })

  it('says nothing when the agent sent no validations, as HITL does', () => {
    expect(summariseValidations(row({ action_conclusion: null })).kind).toBe('ABSENT')
    expect(summariseValidations(row({ action_conclusion: {} })).kind).toBe('ABSENT')
  })

  it('names each failure rather than counting them', () => {
    const r = withEvaluation('is_duplicate', [{ is_new: false }])
    expect(labels(r)).toEqual(['Duplicate invoice'])
  })

  /*
   * Both tax checks answer with the identical string. In the panel each sits
   * beside its own heading; in a table cell there is nothing to tell them
   * apart, so the column has to.
   */
  it('distinguishes the seller and buyer tax checks, which answer identically', () => {
    expect(labels(withEvaluation('validate_seller_gstin', [{ flag: false }]))).toEqual([
      'Invalid Seller GSTIN',
    ])
    expect(labels(withEvaluation('validate_buyer_gstin', [{ flag: false }]))).toEqual([
      'Invalid Buyer GSTIN',
    ])
  })

  it('reports an invalid amount', () => {
    expect(labels(withEvaluation('is_amount_valid', [{ is_amount_valid: false }]))).toEqual([
      'Invalid Amount',
    ])
  })

  it('lists every failure, not just the worst', () => {
    const r = row({
      action_conclusion: {
        evaluations: {
          ...CLEAN,
          is_duplicate: [{ is_new: false }],
          validate_seller_gstin: [{ flag: false }],
        },
      },
    })
    expect(labels(r)).toEqual(['Duplicate invoice', 'Invalid Seller GSTIN'])
  })

  /*
   * The rule the whole column exists to protect. A reviewer who sees green in
   * the list has no reason to open the task, so anything short of an explicit
   * pass must not render as one.
   */
  describe('never reports a pass it was not told about', () => {
    it('treats an uninterpretable result as an issue', () => {
      const summary = summariseValidations(withEvaluation('is_duplicate', [{ verdict: 'maybe' }]))
      expect(summary.kind).toBe('ISSUES')
    })

    it('treats a check that crashed as an issue, not a pass', () => {
      const summary = summariseValidations(
        withEvaluation('is_duplicate', [{ success: false, error: 'lookup timed out' }]),
      )
      expect(summary.kind).toBe('ISSUES')
      if (summary.kind === 'ISSUES') expect(summary.issues[0].tone).toBe('NOT_RUN')
    })

    it('does not go green on a document type it has no contract for', () => {
      const summary = summariseValidations(
        row({ document_type: 'bill_of_lading', action_conclusion: { evaluations: { foo: [{}] } } }),
      )
      expect(summary.kind).toBe('ISSUES')
    })
  })

  /*
   * The PO slice is the one piece of the extraction the list is served, and
   * only because these two cases are indistinguishable without it.
   */
  describe('the purchase order reference', () => {
    it('does not treat a referenced PO as a problem', () => {
      expect(summariseValidations(row()).kind).toBe('ALL_PASSED')
    })

    it('flags an invoice that references no PO at all', () => {
      const r = row({ purchase_order: { purchase_order_number: '' } })
      expect(labels(r)).toEqual(['No PO referenced'])
    })

    it('flags it when the slice is missing entirely', () => {
      expect(labels(row({ purchase_order: null }))).toEqual(['No PO referenced'])
    })
  })

  it('survives any shape the agent might send', () => {
    for (const conclusion of [undefined, null, 'nonsense', 42, [], { evaluations: 'nope' }]) {
      expect(() => summariseValidations(row({ action_conclusion: conclusion }))).not.toThrow()
    }
  })
})

describe('documentTypeLabel', () => {
  it('names a known type from the contract registry', () => {
    expect(documentTypeLabel(row())).toBe('Commercial Invoice')
  })

  it('title-cases a type it has never seen rather than guessing', () => {
    expect(documentTypeLabel(row({ document_type: 'bill_of_lading' }))).toBe('Bill Of Lading')
  })

  it('reports nothing when the document was never classified', () => {
    expect(documentTypeLabel(row({ document_type: null }))).toBeNull()
    expect(documentTypeLabel(row({ document_type: '  ' }))).toBeNull()
  })
})
