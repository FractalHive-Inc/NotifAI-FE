import { describe, expect, it } from 'vitest'
import { formatIndianAmount } from '../formatters'

describe('formatIndianAmount', () => {
  it('formats values in Indian number grouping without a currency prefix', () => {
    expect(formatIndianAmount(840487.32, 'INR')).toBe('8,40,487.32')
    expect(formatIndianAmount(5509861.3, 'INR')).toBe('55,09,861.30')
  })
})
