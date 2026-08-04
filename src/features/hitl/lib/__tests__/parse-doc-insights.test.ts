import { describe, expect, it } from 'vitest'
import state from '@/features/documents/__fixtures__/commercial-invoice-state.json'
import {
  commercialInvoiceContract as invoice,
  getContract,
  purchaseOrderContract as purchaseOrder,
} from '@/features/documents/contracts'
import { parseDocInsights } from '../parse-doc-insights'
import type { DocInsightsVM, FieldValue } from '../types'

/**
 * The extraction half of the captured PPR state. Read from the complete
 * fixture rather than a standalone copy, so the payload these tests assert on
 * is the same one the validations tests read their `action_conclusion` from.
 */
const sample = state.doc_insights

/** Deep copy as a mutable bag, so mutants can add and delete keys freely. */
const clone = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>

/** Every key path reachable in the input, excluding array indices. */
function inputKeyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => inputKeyPaths(item, prefix))
  }
  if (typeof value !== 'object' || value === null) return []

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    const nested = inputKeyPaths(child, path)
    return nested.length > 0 ? nested : [path]
  })
}

/**
 * Everything the view model actually puts in front of the reviewer.
 *
 * Array indices are dropped so these line up with `inputKeyPaths` — a field path
 * of `payment_details.0.payment_terms` and an input path of
 * `payment_details.payment_terms` are the same field.
 */
function renderedLabels(vm: DocInsightsVM): string[] {
  const withoutIndices = (path: Array<string | number>) =>
    path.filter((segment) => typeof segment !== 'number').join('.')

  return [
    ...vm.sections.flatMap((section) => section.fields.map((field) => withoutIndices(field.path))),
    ...vm.lineItems.columns.map((column) => column.sourceKey),
  ]
}

describe('parseDocInsights — the real sample', () => {
  const vm = parseDocInsights(sample, invoice)

  it('groups the known fields into sections', () => {
    const ids = vm.sections.map((section) => section.id)
    expect(ids).toEqual(
      expect.arrayContaining(['summary', 'buyer', 'seller', 'payment', 'tax', 'trade']),
    )
  })

  it('flattens payment_details from an array of single-key objects', () => {
    const payment = vm.sections.find((section) => section.id === 'payment')
    expect(payment?.fields.map((field) => field.label)).toEqual(['Payment Terms', 'Bank Details'])
    // Path points at the array index, so an edit writes back where it came from.
    expect(payment?.fields[0].path).toEqual(['payment_details', 0, 'payment_terms'])
  })

  it('transposes the four parallel arrays into nine rows', () => {
    expect(vm.lineItems.rows).toHaveLength(9)
    expect(vm.lineItems.ragged).toBe(false)
    expect(vm.lineItems.columns.map((column) => column.id)).toEqual([
      'unit_price',
      'line_total',
      'qty',
      'description',
    ])
  })

  // The trap this guards: "Qty / Unit" and "Unit Price" both contain "Unit".
  it('does not let the qty column steal Unit Price', () => {
    const byId = Object.fromEntries(
      vm.lineItems.columns.map((column) => [column.id, column.sourceKey]),
    )
    expect(byId.unit_price).toBe('Unit Price')
    expect(byId.qty).toBe('Qty / Unit')
  })

  it('reconciles both totals', () => {
    expect(vm.reconciliation.map((check) => check.status)).toEqual(['OK', 'OK'])
  })

  it('sums the line totals to exactly the stated subtotal', () => {
    const check = vm.reconciliation[0]
    expect(check.actualMinor).toBe(202850988)
    expect(check.expectedMinor).toBe(202850988)
  })

  it('produces no warnings for a well-formed document', () => {
    expect(vm.warnings).toEqual([])
  })

  // The invariant that actually protects against agent drift: a key the reviewer
  // never sees is data they are approving blind.
  it('renders every key present in the input', () => {
    const rendered = new Set(renderedLabels(vm))
    const missing = inputKeyPaths(sample).filter((path) => {
      if (path.startsWith('invoice_description.')) return false
      return !rendered.has(path)
    })
    expect(missing).toEqual([])
  })
})

describe('parseDocInsights — contract drift', () => {
  it('keeps a renamed column as a column rather than dropping it', () => {
    const drifted = clone(sample)
    const description = drifted.invoice_description as Record<string, unknown>
    description['Unit Rate'] = description['Unit Price']
    delete description['Unit Price']

    const vm = parseDocInsights(drifted, invoice)
    const unitPrice = vm.lineItems.columns.find((column) => column.id === 'unit_price')
    expect(unitPrice?.sourceKey).toBe('Unit Rate')
    expect(vm.lineItems.rows).toHaveLength(9)
  })

  it('surfaces an unrecognised extra column instead of hiding it', () => {
    const drifted = clone(sample)
    const description = drifted.invoice_description as Record<string, unknown>
    description['HSN Code'] = new Array(9).fill('8471')

    const vm = parseDocInsights(drifted, invoice)
    expect(vm.lineItems.columns.map((column) => column.label)).toContain('HSN Code')
  })

  it('warns on ragged arrays and renders the longest column in full', () => {
    const ragged = clone(sample)
    const description = ragged.invoice_description as Record<string, string[]>
    description['Unit Price'] = description['Unit Price'].slice(0, 8)

    const vm = parseDocInsights(ragged, invoice)
    expect(vm.lineItems.ragged).toBe(true)
    expect(vm.lineItems.rows).toHaveLength(9)
    expect(vm.warnings.map((warning) => warning.code)).toContain('RAGGED_LINE_ITEMS')

    // Missing cell is explicitly null, never silently padded.
    const unitPriceIndex = vm.lineItems.columns.findIndex((c) => c.id === 'unit_price')
    expect(vm.lineItems.rows[8][unitPriceIndex]).toBeNull()
  })

  it('accepts line items as an array of row objects', () => {
    const alternative = {
      invoice_description: [
        { Description: 'Widget', 'Qty / Unit': '2 Units', 'Line Total': 'PHP 100.00' },
        { Description: 'Gadget', 'Qty / Unit': '1 Unit', 'Line Total': 'PHP 50.00' },
      ],
    }

    const vm = parseDocInsights(alternative, invoice)
    expect(vm.lineItems.rows).toHaveLength(2)
    expect(vm.lineItems.ragged).toBe(false)
  })

  it('puts an unknown top-level key into Additional Fields', () => {
    const vm = parseDocInsights({ ...clone(sample), shipping_mode: 'Sea Freight' }, invoice)
    const additional = vm.sections.find((section) => section.id === 'additional')
    expect(additional?.fields.map((field) => field.label)).toContain('Shipping Mode')
  })

  it('puts an unknown extra_fields key into Additional Fields', () => {
    const drifted = clone(sample)
    ;(drifted.extra_fields as Record<string, unknown>).lc_number = 'LC-99213'

    const vm = parseDocInsights(drifted, invoice)
    const additional = vm.sections.find((section) => section.id === 'additional')
    expect(additional?.fields.map((field) => field.label)).toContain('Lc Number')
  })

  it('does not lose a new field added inside buyer_details', () => {
    const drifted = clone(sample)
    ;(drifted.buyer_details as Record<string, unknown>).contact_email = 'ap@apex.example'

    const vm = parseDocInsights(drifted, invoice)
    const rendered = new Set(renderedLabels(vm))
    expect(rendered.has('buyer_details.contact_email')).toBe(true)
  })

  it('reports INCOMPUTABLE, not MISMATCH, when the VAT rate is missing', () => {
    const drifted = clone(sample)
    delete (drifted.extra_fields as Record<string, unknown>).vat_rate

    const vm = parseDocInsights(drifted, invoice)
    const check = vm.reconciliation.find((c) => c.id === 'subtotal_plus_vat_vs_amount')
    expect(check?.status).toBe('INCOMPUTABLE')
    expect(check?.reason).toBeTruthy()
  })

  it('reports MISMATCH when the numbers genuinely disagree', () => {
    const drifted = clone(sample) as Record<string, unknown>
    drifted.amount = 9999999.99

    const vm = parseDocInsights(drifted, invoice)
    const check = vm.reconciliation.find((c) => c.id === 'subtotal_plus_vat_vs_amount')
    expect(check?.status).toBe('MISMATCH')
  })

  it('handles amount arriving as a formatted string', () => {
    const drifted = clone(sample) as Record<string, unknown>
    drifted.amount = 'PHP 2,434,211.86'

    const vm = parseDocInsights(drifted, invoice)
    expect(vm.reconciliation[1].status).toBe('OK')
  })

  it('renames a field without losing it, via an alias', () => {
    const drifted = clone(sample)
    const seller = drifted.seller_details as Record<string, unknown>
    seller.tax_id = seller.gst_tin
    delete seller.gst_tin

    const vm = parseDocInsights(drifted, invoice)
    const sellerSection = vm.sections.find((section) => section.id === 'seller')
    const taxId = sellerSection?.fields.find((field) => field.label === 'Tax ID')

    expect(taxId?.value.raw).toBe('TIN-905822773')
    // The path follows the key that was actually found, so an edit writes back
    // to the name the agent used rather than the one we prefer.
    expect(taxId?.path).toEqual(['seller_details', 'tax_id'])
  })

  it('handles payment_details arriving as a plain object', () => {
    const drifted = clone(sample) as Record<string, unknown>
    drifted.payment_details = { payment_terms: 'Net 30' }

    const vm = parseDocInsights(drifted, invoice)
    const payment = vm.sections.find((section) => section.id === 'payment')
    expect(payment?.fields[0].value.raw).toBe('Net 30')
  })
})

/**
 * The parser knows nothing about invoices; the contract supplies all of it.
 * These are the assertions that keep it that way.
 */
describe('parseDocInsights — the contract decides', () => {
  it('renders a purchase order under its own headings', () => {
    const po = { purchase_order_number: 'PO-FRA-7526', currency: 'PHP', amount: 1000 }
    const vm = parseDocInsights(po, purchaseOrder)

    expect(vm.sections.find((section) => section.id === 'summary')?.title).toBe(
      'Purchase Order Summary',
    )
  })

  it('runs no reconciliation on a document whose contract asks for none', () => {
    const po = { purchase_order_number: 'PO-FRA-7526', currency: 'PHP', amount: 1000 }
    expect(parseDocInsights(po, purchaseOrder).reconciliation).toEqual([])
  })

  // "Show it whenever there is a need" cuts both ways: a card of grey rows is
  // noise, but a figure that is present and unreadable is a real signal.
  it('drops the reconciliation card when the document carries none of its figures', () => {
    const bare = { invoice_number: 'INV-1', buyer_details: { name: 'Apex' } }
    expect(parseDocInsights(bare, invoice).reconciliation).toEqual([])
  })

  it('keeps the card when a figure is present but unreadable', () => {
    const odd = clone(sample)
    ;(odd.extra_fields as Record<string, unknown>).vat_rate = 'twenty percent'

    const vm = parseDocInsights(odd, invoice)
    expect(vm.reconciliation).toHaveLength(2)
    expect(vm.reconciliation[1].status).toBe('INCOMPUTABLE')
  })

  it('renders every field of an unknown document type, claiming nothing', () => {
    const contract = getContract('bill_of_lading')
    const vm = parseDocInsights({ bl_number: 'BL-1', vessel: 'MV Test' }, contract)

    expect(contract.label).toBe('Bill Of Lading')
    expect(vm.reconciliation).toEqual([])
    // Everything renders, but nothing is filed under a heading that would
    // misrepresent what this document is.
    expect(vm.sections.every((section) => section.id === 'additional')).toBe(true)
    expect(vm.sections.flatMap((section) => section.fields.map((field) => field.label))).toEqual(
      expect.arrayContaining(['Bl Number', 'Vessel']),
    )
  })
})

/**
 * The totality sweep. `parseDocInsights` promises never to throw, and every UI
 * component below it renders unconditionally on that basis — so this is the
 * assertion holding the whole design up.
 */
describe('parseDocInsights — never throws', () => {
  const raggedDescription = clone(sample)
  ;(raggedDescription.invoice_description as Record<string, string[]>)['Qty / Unit'] = []

  const mutants: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a string', 'not an object'],
    ['an empty string', ''],
    ['an array', []],
    ['an array of scalars', [1, 2, 3]],
    ['a boolean', true],
    ['an empty object', {}],
    ['NaN amount', { amount: NaN }],
    ['null amount', { amount: null }],
    ['object amount', { amount: { value: 1 } }],
    ['invoice_description as a string', { invoice_description: 'nine items' }],
    ['invoice_description as null', { invoice_description: null }],
    ['invoice_description as a number', { invoice_description: 7 }],
    ['invoice_description as an empty object', { invoice_description: {} }],
    ['invoice_description of non-arrays', { invoice_description: { a: 1, b: 2 } }],
    ['invoice_description of mixed types', { invoice_description: { a: [1, null, {}] } }],
    ['buyer_details as a string', { buyer_details: 'Apex' }],
    ['buyer_details as an array', { buyer_details: [] }],
    ['payment_details as a string', { payment_details: 'Net 30' }],
    ['payment_details of scalars', { payment_details: [1, 'two', null] }],
    ['extra_fields as a string', { extra_fields: 'none' }],
    ['extra_fields as an array', { extra_fields: [] }],
    ['deeply nested extra_fields', { extra_fields: { a: { b: { c: { d: 1 } } } } }],
    ['circular-ish repeated refs', (() => ({ a: sample, b: sample }))()],
    ['dates as numbers', { date: 20240824, due_date: null }],
    ['vat_rate as a number', { extra_fields: { vat_rate: 20 } }],
    ['ragged with an empty column', raggedDescription],
    ['the real sample', sample],
  ]

  it.each(mutants)('survives %s', (_label, input) => {
    expect(() => parseDocInsights(input, invoice)).not.toThrow()

    const vm = parseDocInsights(input, invoice)
    expect(Array.isArray(vm.sections)).toBe(true)
    expect(Array.isArray(vm.warnings)).toBe(true)
    expect(Array.isArray(vm.reconciliation)).toBe(true)
    // Never more than the contract declared; fewer when the document carries
    // none of the figures they need.
    expect(vm.reconciliation.length).toBeLessThanOrEqual(2)
  })

  it('never renders [object Object]', () => {
    for (const [, input] of mutants) {
      const vm = parseDocInsights(input, invoice)
      const values: FieldValue[] = vm.sections.flatMap((section) =>
        section.fields.map((field) => field.value),
      )
      for (const value of values) {
        expect(value.raw).not.toContain('[object Object]')
      }
    }
  })

  it('warns rather than silently emptying when given a non-object', () => {
    const vm = parseDocInsights('not an object', invoice)
    expect(vm.warnings.map((warning) => warning.code)).toContain('NOT_AN_OBJECT')
    expect(vm.raw).toBe('not an object')
  })
})
