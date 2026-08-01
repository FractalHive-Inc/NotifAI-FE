import { describe, expect, it } from 'vitest'
import { failuresByFieldPath, parseActionConclusion } from '../parse-action-conclusion'

/** The real sample: every check negative, in two different shapes. */
const SAMPLE = {
  evaluations: {
    is_duplicate: [{ success: false, error: 'Something went wrong during the tool execution!' }],
    is_purchase_order: [
      { success: false, error: 'Something went wrong during the tool execution!' },
    ],
    validate_vendor_gstin: [
      { flag: false, message: 'Invalid GSTIN Number.', data: {}, errorCode: 'INVALID_GSTNUMBER' },
    ],
  },
}

describe('parseActionConclusion — the real sample', () => {
  const vm = parseActionConclusion(SAMPLE)

  it('reads a false flag as a business failure', () => {
    const gstin = vm.evaluations.find((e) => e.id === 'validate_vendor_gstin')
    expect(gstin?.status).toBe('FAILED')
    expect(gstin?.results[0].message).toBe('Invalid GSTIN Number.')
    expect(gstin?.results[0].errorCode).toBe('INVALID_GSTNUMBER')
  })

  // The distinction that keeps a reviewer from rejecting an invoice because a
  // tool crashed.
  it('reads success:false + error as a tool that never ran', () => {
    expect(vm.evaluations.find((e) => e.id === 'is_duplicate')?.status).toBe('NOT_RUN')
    expect(vm.evaluations.find((e) => e.id === 'is_purchase_order')?.status).toBe('NOT_RUN')
  })

  it('counts each status', () => {
    expect(vm.counts).toEqual({ PASSED: 0, FAILED: 1, NOT_RUN: 2, UNRECOGNISED: 0 })
  })

  it('sorts the worst first', () => {
    expect(vm.evaluations[0].status).toBe('FAILED')
  })

  it('humanises the check name', () => {
    expect(vm.evaluations.find((e) => e.id === 'validate_vendor_gstin')?.label).toBe(
      'Validate Vendor Gstin',
    )
  })

  it('pins the GSTIN failure to the seller field', () => {
    const byPath = failuresByFieldPath(vm)
    expect(byPath.get('seller_details.gst_tin')?.[0].id).toBe('validate_vendor_gstin')
  })
})

/**
 * The safety property. No confirmed passing shape exists yet, so the parser must
 * never invent one — a false green here means a reviewer approves a document on
 * the strength of a check that did not actually pass.
 */
describe('parseActionConclusion — never a false pass', () => {
  it('treats an unknown shape as needing review, not as passed', () => {
    const vm = parseActionConclusion({ evaluations: { mystery: [{ outcome: 'ok' }] } })
    expect(vm.evaluations[0].status).toBe('UNRECOGNISED')
  })

  it('does not pass a success:true result that carries an error code', () => {
    const vm = parseActionConclusion({
      evaluations: { odd: [{ success: true, errorCode: 'SOMETHING_WRONG' }] },
    })
    expect(vm.evaluations[0].status).toBe('UNRECOGNISED')
  })

  it('does not pass a success:true result that also says flag:false', () => {
    const vm = parseActionConclusion({ evaluations: { odd: [{ success: true, flag: false }] } })
    expect(vm.evaluations[0].status).not.toBe('PASSED')
  })

  it('does not pass a success:true result carrying an error message', () => {
    const vm = parseActionConclusion({
      evaluations: { odd: [{ success: true, error: 'duplicate found' }] },
    })
    expect(vm.evaluations[0].status).toBe('UNRECOGNISED')
  })

  it('passes only on an explicit positive verdict', () => {
    const flagged = parseActionConclusion({ evaluations: { a: [{ flag: true, message: 'ok' }] } })
    expect(flagged.evaluations[0].status).toBe('PASSED')

    const clean = parseActionConclusion({ evaluations: { b: [{ success: true }] } })
    expect(clean.evaluations[0].status).toBe('PASSED')
  })

  it('takes the worst status when an evaluation returns several results', () => {
    const vm = parseActionConclusion({
      evaluations: { multi: [{ flag: true }, { flag: false, message: 'no' }] },
    })
    expect(vm.evaluations[0].status).toBe('FAILED')
    expect(vm.evaluations[0].results).toHaveLength(2)
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
    ['evaluations at the top level', SAMPLE.evaluations],
    ['the real sample', SAMPLE],
  ]

  it.each(mutants)('survives %s', (_label, input) => {
    expect(() => parseActionConclusion(input)).not.toThrow()
    const vm = parseActionConclusion(input)
    expect(Array.isArray(vm.evaluations)).toBe(true)
  })

  it('flags an absent action_conclusion rather than inventing an empty pass', () => {
    expect(parseActionConclusion(undefined).absent).toBe(true)
    expect(parseActionConclusion(SAMPLE).absent).toBe(false)
  })

  it('accepts evaluations passed without the wrapper', () => {
    const vm = parseActionConclusion(SAMPLE.evaluations)
    expect(vm.evaluations).toHaveLength(3)
    expect(vm.absent).toBe(false)
  })
})
