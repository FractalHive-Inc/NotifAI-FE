import { describe, expect, it } from 'vitest'

import { approvalFiltersFromColumns } from '../approval-filters'

describe('approvalFiltersFromColumns', () => {
  it('sends nothing when no filter is set', () => {
    expect(approvalFiltersFromColumns([])).toEqual({})
  })

  it('maps the text and select columns', () => {
    expect(
      approvalFiltersFromColumns([
        { id: 'status', value: 'PENDING' },
        { id: 'document_id', value: 'INV-1024' },
        { id: 'customer_name', value: 'Acme' },
        { id: 'document_type', value: 'commercial_invoice' },
      ]),
    ).toEqual({
      status: ['PENDING'],
      document_id: 'INV-1024',
      customer_name: 'Acme',
      document_type: ['commercial_invoice'],
    })
  })

  it('sends every ticked option, not just the first', () => {
    expect(
      approvalFiltersFromColumns([
        { id: 'status', value: ['REJECTED', 'PUSHED_TO_TALLY'] },
        { id: 'document_type', value: ['commercial_invoice', 'purchase_order'] },
      ]),
    ).toEqual({
      status: ['REJECTED', 'PUSHED_TO_TALLY'],
      document_type: ['commercial_invoice', 'purchase_order'],
    })
  })

  it('accepts a single-select value, which arrives as a bare string', () => {
    expect(approvalFiltersFromColumns([{ id: 'status', value: 'APPROVED' }])).toEqual({
      status: ['APPROVED'],
    })
  })

  it('drops a select that was cleared to an empty list', () => {
    expect(approvalFiltersFromColumns([{ id: 'status', value: [] }])).toEqual({})
  })

  it('trims text and drops whitespace-only values', () => {
    expect(approvalFiltersFromColumns([{ id: 'customer_name', value: '  Acme  ' }])).toEqual({
      customer_name: 'Acme',
    })
    expect(approvalFiltersFromColumns([{ id: 'customer_name', value: '   ' }])).toEqual({})
  })

  it('sends a date range as calendar dates, not UTC instants', () => {
    // 1 Jan, before 05:30 UTC+X, is still 31 Dec in toISOString() — the bug this guards.
    const filters = approvalFiltersFromColumns([
      { id: 'created_at', value: [new Date(2026, 0, 1, 2, 0), new Date(2026, 0, 31, 23, 0)] },
    ])
    expect(filters).toEqual({ created_from: '2026-01-01', created_to: '2026-01-31' })
  })

  it('accepts a one-sided date range', () => {
    expect(
      approvalFiltersFromColumns([{ id: 'created_at', value: [new Date(2026, 5, 9), null] }]),
    ).toEqual({ created_from: '2026-06-09' })
  })

  it('keeps a zero confidence bound', () => {
    // `if (min)` would silently drop this and widen the filter.
    expect(approvalFiltersFromColumns([{ id: 'confidence_score', value: [0, 50] }])).toEqual({
      confidence_min: 0,
      confidence_max: 50,
    })
  })

  it('ignores columns the API does not support', () => {
    expect(approvalFiltersFromColumns([{ id: 'validations', value: 'anything' }])).toEqual({})
  })
})
