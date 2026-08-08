import { describe, expect, it } from 'vitest'
import state from '@/features/documents/__fixtures__/commercial-invoice-state.json'
import { changesByKey, diffInsights } from '../diff-insights'

/** The extraction half of the captured PPR state. */
const sample = state.doc_insights

const clone = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>

describe('diffInsights', () => {
  it('reports nothing when the approved extraction is the agent’s own', () => {
    expect(diffInsights(sample, clone(sample))).toEqual([])
  })

  it('reports a corrected scalar with both values', () => {
    const corrected = clone(sample)
    corrected.invoice_number = 'INV-PHI-2024-0046'

    expect(diffInsights(sample, corrected)).toEqual([
      {
        path: 'invoice_number',
        key: 'invoice_number',
        from: 'INV-PHI-2024-0045',
        to: 'INV-PHI-2024-0046',
      },
    ])
  })

  it('reaches into nested objects', () => {
    const corrected = clone(sample)
    ;(corrected.seller_details as Record<string, unknown>).gst_tin = 'TIN-000000000'

    const changes = diffInsights(sample, corrected)

    expect(changes).toHaveLength(1)
    expect(changes[0].path).toBe('seller_details.gst_tin')
    expect(changes[0].to).toBe('TIN-000000000')
  })

  /*
   * `payment_details` is the agent's array of single-key objects. The index is
   * in the path so the change can be located in the payload, and out of the key
   * so it still matches the field, which is rendered from the merged object.
   */
  it('strips array indices from the field key but keeps them in the path', () => {
    const corrected = clone(sample)
    ;(corrected.payment_details as Record<string, unknown>[])[0].payment_terms = 'Net 45'

    const [change] = diffInsights(sample, corrected)

    expect(change.path).toBe('payment_details.0.payment_terms')
    expect(change.key).toBe('payment_details.payment_terms')
  })

  it('treats a field the reviewer cleared as a change to empty', () => {
    const corrected = clone(sample)
    corrected.currency = ''

    expect(diffInsights(sample, corrected)).toEqual([
      { path: 'currency', key: 'currency', from: 'PHP', to: '' },
    ])
  })

  /*
   * A key that only one side has is still a correction — a reviewer deleting a
   * field, or the write-back adding one. Reporting nothing would make the
   * approved payload differ from the page that claims to show it.
   */
  it('reports a key present on only one side', () => {
    const removed = clone(sample)
    delete removed.due_date

    expect(diffInsights(sample, removed)).toEqual([
      { path: 'due_date', key: 'due_date', from: '15/09/2024', to: '' },
    ])

    const added = clone(sample)
    added.incoterms = 'FOB'

    expect(diffInsights(sample, added)).toEqual([
      { path: 'incoterms', key: 'incoterms', from: '', to: 'FOB' },
    ])
  })

  it('never throws on a payload that is not an object', () => {
    expect(diffInsights(null, undefined)).toEqual([])
    expect(diffInsights('a string', 42)).toEqual([])
    expect(() => diffInsights(sample, null)).not.toThrow()
  })

  it('reports one entry per changed line-item cell', () => {
    const corrected = clone(sample)
    const table = corrected.invoice_description as Record<string, string[]>
    const column = Object.keys(table)[0]
    table[column] = [...table[column]]
    table[column][0] = 'Something else entirely'

    const changes = diffInsights(sample, corrected)

    expect(changes).toHaveLength(1)
    expect(changes[0].to).toBe('Something else entirely')
  })
})

describe('changesByKey', () => {
  it('keys changes by field so a section can look one up', () => {
    const corrected = clone(sample)
    corrected.invoice_number = 'INV-2'

    const map = changesByKey(diffInsights(sample, corrected))

    expect(map.get('invoice_number')?.from).toBe('INV-PHI-2024-0045')
    expect(map.get('currency')).toBeUndefined()
  })

  /*
   * Several array paths collapse onto one key. The map holds one entry per
   * field because that is what a field can render; taking the first keeps it
   * deterministic rather than "whichever was walked last".
   */
  it('keeps the first change when two paths share a key', () => {
    const corrected = clone(sample)
    const payments = corrected.payment_details as Record<string, unknown>[]
    payments[0] = { note: 'first' }
    payments[1] = { note: 'second' }

    const changes = diffInsights(sample, corrected)
    const map = changesByKey(changes)

    expect(map.get('payment_details.note')?.to).toBe('first')
  })
})
