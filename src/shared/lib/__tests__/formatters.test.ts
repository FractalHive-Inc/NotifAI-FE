import { describe, expect, it } from 'vitest'
import { formatDateShort, formatIndianAmount } from '../formatters'

describe('formatIndianAmount', () => {
  it('formats values in Indian number grouping without a currency prefix', () => {
    expect(formatIndianAmount(840487.32, 'INR')).toBe('8,40,487.32')
    expect(formatIndianAmount(5509861.3, 'INR')).toBe('55,09,861.30')
  })
})

describe('formatDateShort', () => {
  it('renders a date-only string as that calendar day, whatever the viewer offset', () => {
    expect(formatDateShort('2026-08-26')).toBe('Aug 26, 2026')
  })

  it('still renders a full timestamp as an instant', () => {
    expect(formatDateShort(new Date(2026, 7, 26, 9, 30))).toBe('Aug 26, 2026')
  })
})
