import { describe, expect, it } from 'vitest'
import gstState from '@/features/documents/__fixtures__/commercial-invoice-gst-state.json'
import state from '@/features/documents/__fixtures__/commercial-invoice-state.json'
import {
  commercialInvoiceContract as invoice,
  evaluateGates,
  getContract,
} from '@/features/documents/contracts'
import { failuresByFieldPath, parseActionConclusion } from '../parse-action-conclusion'

const INSIGHTS = state.doc_insights
const SAMPLE = state.action_conclusion

/** The payload as the agent sends it today: PO as an object, tax IDs renamed. */
const GST_INSIGHTS = gstState.doc_insights
const GST_SAMPLE = gstState.action_conclusion

/** The same invoice with no PO written on it — the blocking case. */
const withoutPo = { ...INSIGHTS, purchase_order: '' }

const parse = (conclusion: unknown, insights: unknown = INSIGHTS, contract = invoice) =>
  parseActionConclusion(conclusion, contract, insights)

const find = (vm: ReturnType<typeof parse>, id: string) =>
  vm.evaluations.find((evaluation) => evaluation.id === id)

describe('parseActionConclusion — the real sample', () => {
  const vm = parse(SAMPLE)

  /*
   * The polarity trap. `is_duplicate` is named for the bad outcome and answers
   * with the good one, so a reader that assumed `true` meant "yes, duplicated"
   * would flag every clean invoice.
   */
  it('reads is_new: true as "not a duplicate"', () => {
    const duplicate = find(vm, 'is_duplicate')
    expect(duplicate?.tone).toBe('PASSED')
    expect(duplicate?.status).toBe('No duplicate found')
  })

  it('labels each check for a reviewer, not for the API', () => {
    expect(find(vm, 'is_duplicate')?.label).toBe('Is Invoice Duplicated')
    expect(find(vm, 'validate_seller_gstin')?.label).toBe('Is Seller Tax Id Valid')
    expect(find(vm, 'validate_buyer_gstin')?.label).toBe('Is Buyer Tax Id Valid')
    expect(find(vm, 'is_amount_valid')?.label).toBe('Is Amount Valid')
    expect(find(vm, 'is_purchase_order')?.label).toBe('Purchase Order Status')
  })

  /*
   * "Failed" would be ambiguous between an invalid tax ID and a validator that
   * crashed. The row says which. The agent's own message and error code are
   * deliberately not shown — they restate the answer and name it in our
   * vocabulary, not the reviewer's.
   */
  it('states an invalid tax ID as an answer, not as a failure', () => {
    const seller = find(vm, 'validate_seller_gstin')
    expect(seller?.status).toBe('Invalid Tax Id')
    expect(seller?.results[0].headline).toBeNull()
    expect(seller?.results[0].errorCode).toBeNull()
  })

  it('validates the two parties independently', () => {
    expect(find(vm, 'validate_seller_gstin')?.status).toBe('Invalid Tax Id')
    expect(find(vm, 'validate_buyer_gstin')?.status).toBe('Valid Tax Id')
  })

  it('reads is_amount_valid: false as an invalid amount', () => {
    expect(find(vm, 'is_amount_valid')?.tone).toBe('FAILED')
    expect(find(vm, 'is_amount_valid')?.status).toBe('Invalid Amount')
  })

  /*
   * A PO that is new is a fact about the order, not a problem with the
   * invoice. It is stated and nothing is asked of the reviewer.
   */
  it('states a new purchase order without asking anything of the reviewer', () => {
    const po = find(vm, 'is_purchase_order')
    expect(po?.tone).toBe('INFO')
    expect(po?.status).toBe('New purchase order')
    expect(po?.results[0].headline).toBeNull()
    expect(po?.results[0].detail).toBeNull()
  })

  it('states an already-known purchase order the same way', () => {
    const conclusion = { evaluations: { is_purchase_order: [{ is_purchase_order_new: false }] } }
    const po = find(parse(conclusion), 'is_purchase_order')
    expect(po?.tone).toBe('INFO')
    expect(po?.status).toBe('Existing purchase order')
  })

  it('recognises every check the contract declares', () => {
    expect(vm.evaluations.every((evaluation) => evaluation.recognised)).toBe(true)
  })

  it('counts by tone', () => {
    expect(vm.counts.FAILED).toBe(2)
    expect(vm.counts.PASSED).toBe(2)
    expect(vm.counts.INFO).toBe(1)
    expect(vm.counts.WARNING).toBe(0)
    expect(vm.counts.UNRECOGNISED).toBe(0)
  })

  /*
   * Contract order, not worst-first. Sorting by severity moves a check to a
   * different place depending on what else went wrong that day, and re-creates
   * the problems/everything-else split the panel deliberately does not have.
   */
  it('keeps the contract’s order regardless of outcome', () => {
    expect(vm.evaluations.map((evaluation) => evaluation.id)).toEqual([
      'is_duplicate',
      'validate_seller_gstin',
      'validate_buyer_gstin',
      'is_amount_valid',
      'is_purchase_order',
    ])
  })

  it('puts checks the contract never declared after the ones it did', () => {
    const withExtra = {
      evaluations: { ...SAMPLE.evaluations, some_new_check: [{ flag: true }] },
    }
    expect(parse(withExtra).evaluations.at(-1)?.id).toBe('some_new_check')
  })

  it('marks the fields that have a problem, and only those', () => {
    const byPath = failuresByFieldPath(vm)
    expect(byPath.get('seller_details.gst_tin')?.[0].id).toBe('validate_seller_gstin')
    expect(byPath.get('amount')?.[0].id).toBe('is_amount_valid')

    // A passing check is not a problem, and neither is a PO that happens to be
    // new — so neither field is marked.
    expect(byPath.has('buyer_details.gst_tin')).toBe(false)
    expect(byPath.has('purchase_order')).toBe(false)
  })
})

/**
 * An invoice with no PO reference cannot be approved. The rule is stated twice
 * on purpose — once as a gate, so it holds even if the agent never ran the
 * check, and once as the check's own outcome, so the panel agrees with the
 * banner instead of contradicting it.
 */
describe('the missing-PO rule', () => {
  it('blocks the check when the invoice references no PO', () => {
    const po = find(parse(SAMPLE, withoutPo), 'is_purchase_order')
    expect(po?.tone).toBe('BLOCKED')
    expect(po?.status).toBe('Not referenced')
    // The one PO outcome that does ask something of the reviewer says so.
    expect(po?.results[0].headline).toBe('This invoice does not reference a purchase order')
  })

  it('marks the purchase order field only when it is blocking', () => {
    const byPath = failuresByFieldPath(parse(SAMPLE, withoutPo))
    expect(byPath.get('purchase_order')?.[0].tone).toBe('BLOCKED')
  })

  it('blocks regardless of what the PO check reported', () => {
    const conclusion = { evaluations: { is_purchase_order: [{ is_purchase_order_new: false }] } }
    expect(find(parse(conclusion, withoutPo), 'is_purchase_order')?.tone).toBe('BLOCKED')
  })

  it('fires the gate from doc_insights alone, with no validations at all', () => {
    expect(evaluateGates(invoice, withoutPo)).toHaveLength(1)
    expect(evaluateGates(invoice, withoutPo)[0].id).toBe('missing_po_reference')
  })

  it('treats a whitespace-only and a missing reference the same as an empty one', () => {
    expect(evaluateGates(invoice, { ...INSIGHTS, purchase_order: '   ' })).toHaveLength(1)

    const absent = { ...INSIGHTS } as Record<string, unknown>
    delete absent.purchase_order
    expect(evaluateGates(invoice, absent)).toHaveLength(1)
  })

  it('does not fire when the invoice does reference a PO', () => {
    expect(evaluateGates(invoice, INSIGHTS)).toEqual([])
  })

  it('does not apply to documents whose contract does not declare it', () => {
    expect(evaluateGates(getContract('purchase_order'), withoutPo)).toEqual([])
  })
})

/**
 * The same rule against the payload the agent sends today, where the PO
 * reference is an object rather than a string.
 *
 * This is the case that made the gate necessary again: `stringify` of
 * `{purchase_order_number: ""}` is `'{"purchase_order_number":""}'`, which is
 * not empty — so an invoice referencing no PO would have sailed through a
 * check that reads the object as text, and the Approve button would have been
 * enabled on exactly the document it exists to stop.
 */
describe('the missing-PO rule — purchase_order as an object', () => {
  const insights = GST_INSIGHTS as Record<string, unknown>

  const withPoNumber = (purchase_order_number: string) => ({
    ...insights,
    purchase_order: { purchase_order_date: '', purchase_order_number },
  })

  it('does not fire when the object carries a number', () => {
    expect(evaluateGates(invoice, insights)).toEqual([])
  })

  it('fires when the number is empty', () => {
    const gates = evaluateGates(invoice, withPoNumber(''))
    expect(gates).toHaveLength(1)
    expect(gates[0].id).toBe('missing_po_reference')
  })

  it('fires when the number is whitespace, or the key is absent entirely', () => {
    expect(evaluateGates(invoice, withPoNumber('   '))).toHaveLength(1)
    expect(evaluateGates(invoice, { ...insights, purchase_order: {} })).toHaveLength(1)
  })

  it('marks the PO number field, at the path the field actually has', () => {
    const vm = parseActionConclusion(GST_SAMPLE, invoice, withPoNumber(''))
    const byPath = failuresByFieldPath(vm)

    expect(byPath.get('purchase_order.purchase_order_number')?.[0].tone).toBe('BLOCKED')
  })

  it('agrees with the check, which reports the same thing', () => {
    const vm = parseActionConclusion(GST_SAMPLE, invoice, withPoNumber(''))
    const po = find(vm, 'is_purchase_order')

    expect(po?.tone).toBe('BLOCKED')
    expect(po?.status).toBe('Not referenced')
  })
})

/**
 * A validator that could not run is not a validator that said no.
 *
 * The tax-ID service reports an exhausted subscription as `flag: false` with
 * `CREDIT_NOT_AVAILABLE` — the same shape as a genuinely invalid GSTIN. Reading
 * it as "Invalid Tax Id" tells the reviewer something about the supplier that
 * nobody actually checked.
 */
describe('a tax check that never reached the registry', () => {
  const vm = parseActionConclusion(GST_SAMPLE, invoice, GST_INSIGHTS)

  it('reports it as not verified rather than as invalid', () => {
    for (const id of ['validate_seller_gstin', 'validate_buyer_gstin']) {
      const check = find(vm, id)
      expect(check?.tone).toBe('NOT_RUN')
      expect(check?.status).toBe('Not verified')
      expect(check?.status).not.toBe('Invalid Tax Id')
    }
  })

  it('says why, and keeps the code for whoever has to fix it', () => {
    const seller = find(vm, 'validate_seller_gstin')
    expect(seller?.results[0].headline).toBe('The tax registry could not be reached')
    expect(seller?.results[0].detail).toBe('Credit Expire.')
    expect(seller?.results[0].errorCode).toBe('CREDIT_NOT_AVAILABLE')
  })

  it('does not mark the tax ID field, because nothing is known about it', () => {
    expect(failuresByFieldPath(vm).has('seller_details.tax_id')).toBe(false)
  })

  // The safety direction: an unfamiliar code stays a verdict.
  it('still reports an actual invalid GSTIN as invalid', () => {
    const conclusion = {
      evaluations: {
        validate_seller_gstin: [
          { flag: false, message: 'Invalid GSTIN Number.', errorCode: 'INVALID_GSTNUMBER' },
        ],
      },
    }

    const check = find(
      parseActionConclusion(conclusion, invoice, GST_INSIGHTS),
      'validate_seller_gstin',
    )
    expect(check?.tone).toBe('FAILED')
    expect(check?.status).toBe('Invalid Tax Id')
  })

  it('marks the renamed tax_id field when the check does fail', () => {
    const conclusion = { evaluations: { validate_seller_gstin: [{ flag: false }] } }
    const byPath = failuresByFieldPath(parseActionConclusion(conclusion, invoice, GST_INSIGHTS))

    expect(byPath.get('seller_details.tax_id')?.[0].id).toBe('validate_seller_gstin')
  })

  it('marks the renamed total_amount field when the amount check fails', () => {
    const conclusion = { evaluations: { is_amount_valid: [{ is_amount_valid: false }] } }
    const byPath = failuresByFieldPath(parseActionConclusion(conclusion, invoice, GST_INSIGHTS))

    expect(byPath.get('total_amount')?.[0].id).toBe('is_amount_valid')
  })
})

describe('parseActionConclusion — legacy names', () => {
  it('still reads the pre-split seller check', () => {
    for (const legacy of ['validate_gstin', 'validate_vendor_gstin']) {
      const vm = parse({ evaluations: { [legacy]: [{ flag: false, message: 'Invalid GSTIN.' }] } })
      expect(vm.evaluations[0].tone).toBe('FAILED')
      expect(vm.evaluations[0].relatedPaths).toContain('seller_details.gst_tin')
    }
  })
})

/**
 * The safety property. Contract readers cover the checks we know; everything
 * else falls to the generic classifier, whose rule is that a pass must be
 * explicit. A false green here means a reviewer approves a document on the
 * strength of a check that did not actually pass.
 */
describe('parseActionConclusion — never a false pass', () => {
  it('treats an unknown shape as needing review, not as passed', () => {
    const vm = parse({ evaluations: { mystery: [{ outcome: 'ok' }] } })
    expect(vm.evaluations[0].tone).toBe('UNRECOGNISED')
    expect(vm.evaluations[0].recognised).toBe(false)
  })

  it('treats a known check answering in an unknown shape as needing review', () => {
    const vm = parse({ evaluations: { is_duplicate: [{ duplicate: 'no' }] } })
    expect(vm.evaluations[0].tone).toBe('UNRECOGNISED')
    // The label still comes from the contract — we know what was checked, just
    // not what it concluded.
    expect(vm.evaluations[0].label).toBe('Is Invoice Duplicated')
  })

  it('reads success:false + error as a tool that never ran', () => {
    const vm = parse({
      evaluations: {
        is_duplicate: [
          { success: false, error: 'Something went wrong during the tool execution!' },
        ],
      },
    })
    expect(vm.evaluations[0].tone).toBe('NOT_RUN')
  })

  it('does not pass a success:true result that carries an error code', () => {
    const vm = parse({ evaluations: { odd: [{ success: true, errorCode: 'SOMETHING_WRONG' }] } })
    expect(vm.evaluations[0].tone).toBe('UNRECOGNISED')
  })

  it('does not pass a success:true result that also says flag:false', () => {
    const vm = parse({ evaluations: { odd: [{ success: true, flag: false }] } })
    expect(vm.evaluations[0].tone).not.toBe('PASSED')
  })

  it('does not pass a success:true result carrying an error message', () => {
    const vm = parse({ evaluations: { odd: [{ success: true, error: 'duplicate found' }] } })
    expect(vm.evaluations[0].tone).toBe('UNRECOGNISED')
  })

  it('passes only on an explicit positive verdict', () => {
    expect(parse({ evaluations: { a: [{ flag: true, message: 'ok' }] } }).evaluations[0].tone).toBe(
      'PASSED',
    )
    expect(parse({ evaluations: { b: [{ success: true }] } }).evaluations[0].tone).toBe('PASSED')
  })

  it('takes the worst tone when an evaluation returns several results', () => {
    const vm = parse({
      evaluations: { is_duplicate: [{ is_new: true }, { is_new: false }] },
    })
    expect(vm.evaluations[0].tone).toBe('FAILED')
    expect(vm.evaluations[0].results).toHaveLength(2)
  })

  it('interprets nothing for a document type it has no contract for', () => {
    const vm = parse(SAMPLE, INSIGHTS, getContract('bill_of_lading'))

    expect(vm.evaluations.every((evaluation) => !evaluation.recognised)).toBe(true)

    // The bespoke shapes carry no verdict the generic classifier can read, so
    // they say "review this" rather than guessing either way.
    for (const id of ['is_duplicate', 'is_amount_valid', 'is_purchase_order']) {
      expect(find(vm, id)?.tone).toBe('UNRECOGNISED')
    }

    // `flag` is explicitly positive or negative whoever sent it, so those two
    // still read correctly — just under their raw names.
    expect(find(vm, 'validate_seller_gstin')?.tone).toBe('FAILED')
    expect(find(vm, 'validate_buyer_gstin')?.tone).toBe('PASSED')
    expect(find(vm, 'validate_seller_gstin')?.label).toBe('Validate Seller Gstin')
  })

  it('falls back rather than crashing when a reader throws', () => {
    const broken = {
      ...invoice,
      evaluations: {
        is_duplicate: {
          ...invoice.evaluations.is_duplicate,
          read: () => {
            throw new Error('bad contract')
          },
        },
      },
    }

    const vm = parse({ evaluations: { is_duplicate: [{ is_new: true }] } }, INSIGHTS, broken)
    expect(vm.evaluations[0].tone).toBe('UNRECOGNISED')
  })
})

describe('parseActionConclusion — never throws', () => {
  const mutants: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['a string', 'nope'],
    ['a number', 7],
    ['an array', []],
    ['an empty object', {}],
    ['empty evaluations', { evaluations: {} }],
    ['evaluations as a string', { evaluations: 'none' }],
    ['evaluations as an array', { evaluations: [] }],
    ['a result that is null', { evaluations: { a: [null] } }],
    ['a result that is a string', { evaluations: { a: ['failed'] } }],
    ['a result that is a number', { evaluations: { a: [1] } }],
    ['an empty result list', { evaluations: { a: [] } }],
    ['a bare object instead of a list', { evaluations: { a: { flag: false } } }],
    ['a known check given a null result', { evaluations: { is_duplicate: [null] } }],
    ['evaluations at the top level', SAMPLE.evaluations],
    ['the real sample', SAMPLE],
  ]

  it.each(mutants)('survives %s', (_label, input) => {
    expect(() => parse(input)).not.toThrow()
    expect(Array.isArray(parse(input).evaluations)).toBe(true)
  })

  it('survives malformed doc_insights alongside a valid conclusion', () => {
    for (const insights of [null, undefined, 'nope', 42, []]) {
      expect(() => parse(SAMPLE, insights)).not.toThrow()
    }
  })

  it('flags an absent action_conclusion rather than inventing an empty pass', () => {
    expect(parse(undefined).absent).toBe(true)
    expect(parse(SAMPLE).absent).toBe(false)
  })

  it('accepts evaluations passed without the wrapper', () => {
    const vm = parse(SAMPLE.evaluations)
    expect(vm.evaluations).toHaveLength(5)
    expect(vm.absent).toBe(false)
  })
})
