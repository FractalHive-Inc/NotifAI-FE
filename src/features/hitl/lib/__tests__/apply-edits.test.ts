import { describe, expect, it } from 'vitest'
import sample from '../__fixtures__/commercial-invoice.json'
import { applyEdits, emptyEditSet, normaliseEdit, pathKey } from '../apply-edits'
import { parseDocInsights } from '../parse-doc-insights'
import type { EditSet, FieldEdit } from '../apply-edits'
import type { FieldVM } from '../types'

/** Deep copy as a mutable bag, so mutants can add and delete keys freely. */
const clone = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>

function findField(id: string): FieldVM {
  const vm = parseDocInsights(sample)
  const field = vm.sections.flatMap((section) => section.fields).find((f) => f.id === id)
  if (!field) throw new Error(`fixture has no field ${id}`)
  return field
}

function editSetOf(...edits: FieldEdit[]): EditSet {
  return {
    fields: new Map(edits.map((edit) => [pathKey(edit.path), edit])),
    lineItems: null,
  }
}

describe('normaliseEdit', () => {
  it('re-emits money in the shape the agent used', () => {
    const subtotal = findField('tax.subtotal_ex_tax')
    expect(normaliseEdit('2500000', subtotal.value)).toBe('PHP 2,500,000.00')
  })

  it('keeps a numeric money field numeric', () => {
    const amount = findField('summary.amount')
    expect(normaliseEdit('2500000.50', amount.value)).toBe(2500000.5)
  })

  it('re-emits dates in the agent´s DD/MM/YYYY format', () => {
    const date = findField('summary.date')
    expect(normaliseEdit('01/09/2024', date.value)).toBe('01/09/2024')
  })

  // A reviewer who types something we cannot parse has still told us something.
  it('passes unparseable input through rather than discarding it', () => {
    const amount = findField('summary.amount')
    expect(normaliseEdit('to be confirmed', amount.value)).toBe('to be confirmed')
  })

  it('leaves text alone', () => {
    const invoiceNumber = findField('summary.invoice_number')
    expect(normaliseEdit('INV-999', invoiceNumber.value)).toBe('INV-999')
  })
})

describe('applyEdits', () => {
  it('never mutates the original', () => {
    const original = clone(sample)
    const snapshot = JSON.stringify(original)

    applyEdits(
      original,
      editSetOf({ path: ['invoice_number'], raw: 'INV-999', previousRaw: 'INV-PHI-2024-0045' }),
      parseDocInsights(original).lineItems,
    )

    expect(JSON.stringify(original)).toBe(snapshot)
  })

  it('writes a root field', () => {
    const result = applyEdits(
      sample,
      editSetOf({ path: ['invoice_number'], raw: 'INV-999', previousRaw: 'INV-PHI-2024-0045' }),
      parseDocInsights(sample).lineItems,
    )
    expect(result.invoice_number).toBe('INV-999')
  })

  it('writes a nested party field', () => {
    const result = applyEdits(
      sample,
      editSetOf({
        path: ['seller_details', 'gst_tin'],
        raw: '27AAPFU0939F1ZV',
        previousRaw: 'TIN-905822773',
      }),
      parseDocInsights(sample).lineItems,
    )
    expect((result.seller_details as Record<string, unknown>).gst_tin).toBe('27AAPFU0939F1ZV')
  })

  // payment_details is an array of single-key objects; an edit must land at the
  // right index rather than collapsing the array into an object.
  it('writes back into the payment_details array shape', () => {
    const result = applyEdits(
      sample,
      editSetOf({
        path: ['payment_details', 0, 'payment_terms'],
        raw: 'Net 45',
        previousRaw: 'Open Account – 30 days',
      }),
      parseDocInsights(sample).lineItems,
    )

    expect(Array.isArray(result.payment_details)).toBe(true)
    expect((result.payment_details as Array<Record<string, unknown>>)[0].payment_terms).toBe(
      'Net 45',
    )
    expect((result.payment_details as Array<Record<string, unknown>>)[1].bank_details).toBe(
      'Provided under separate secure communication',
    )
  })

  it('un-transposes edited rows back into the parallel arrays', () => {
    const vm = parseDocInsights(sample)
    const rows = vm.lineItems.rows.map((row) => row.map((cell) => cell?.raw ?? ''))
    rows[0][0] = 'PHP 25,000.00'

    const result = applyEdits(sample, { fields: new Map(), lineItems: { rows } }, vm.lineItems)
    const description = result.invoice_description as Record<string, string[]>

    expect(description['Unit Price'][0]).toBe('PHP 25,000.00')
    expect(description['Unit Price']).toHaveLength(9)
    expect(description['Line Total'][0]).toBe('PHP 940,633.20')
  })

  it('refuses to un-transpose misaligned arrays', () => {
    const ragged = clone(sample)
    const description = ragged.invoice_description as Record<string, string[]>
    description['Unit Price'] = description['Unit Price'].slice(0, 8)

    const vm = parseDocInsights(ragged)
    const rows = vm.lineItems.rows.map((row) => row.map((cell) => cell?.raw ?? ''))

    expect(() =>
      applyEdits(ragged, { fields: new Map(), lineItems: { rows } }, vm.lineItems),
    ).toThrow(/misaligned/)
  })

  it('is a no-op with an empty edit set', () => {
    const vm = parseDocInsights(sample)
    const result = applyEdits(sample, emptyEditSet(), vm.lineItems)
    expect(result).toEqual(sample)
  })

  /**
   * The round-trip that the whole format-capture design exists for: parse the
   * document, "edit" every field to its own current value, write back, and the
   * payload must be byte-identical. Any drift here is the parser silently
   * rewriting the agent's data.
   */
  it('round-trips every field unchanged', () => {
    const vm = parseDocInsights(sample)

    const fields = new Map(
      vm.sections
        .flatMap((section) => section.fields)
        .filter((field) => field.editable)
        .map((field) => [
          pathKey(field.path),
          {
            path: field.path,
            raw: normaliseEdit(field.value.raw, field.value) as string,
            previousRaw: field.value.raw,
          },
        ]),
    )

    const rows = vm.lineItems.rows.map((row) => row.map((cell) => cell?.raw ?? ''))
    const result = applyEdits(sample, { fields, lineItems: { rows } }, vm.lineItems)

    expect(result).toEqual(sample)
  })
})
