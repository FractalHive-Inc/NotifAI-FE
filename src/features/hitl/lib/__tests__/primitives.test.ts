import { describe, expect, it } from 'vitest'
import {
  formatDMY,
  formatMoney,
  parseDMY,
  parseMoney,
  parsePercent,
  titleCase,
} from '../primitives'

describe('parseMoney', () => {
  it.each([
    // input                   value          currency
    ['PHP 24,118.80', 24118.8, 'PHP'],
    ['PHP 2,028,509.88', 2028509.88, 'PHP'],
    ['2,028,509.88', 2028509.88, null],
    ['1,234.00 USD', 1234, 'USD'],
    ['₱1,500.50', 1500.5, 'PHP'],
    ['940633.20', 940633.2, null],
    ['0', 0, null],
  ])('parses %s', (input, value, currency) => {
    const result = parseMoney(input)
    expect(result.value).toBeCloseTo(value as number, 2)
    expect(result.currency).toBe(currency)
    expect(result.raw).toBe(input)
  })

  it('treats a JSON number as money without inventing a currency', () => {
    const result = parseMoney(2434211.86)
    expect(result.value).toBe(2434211.86)
    expect(result.currency).toBeNull()
    expect(result.format.numeric).toBe(true)
  })

  // The genuinely ambiguous cases. There is no locale in the payload, so these
  // pin the documented heuristic: a separator followed by exactly three digits,
  // in a string shaped like grouping, is grouping. Everything else is decimal.
  it('reads "1.500" as grouped thousands', () => {
    expect(parseMoney('1.500').value).toBe(1500)
  })

  it('reads "1,50" as a decimal comma', () => {
    expect(parseMoney('1,50').value).toBeCloseTo(1.5, 2)
  })

  it('reads parenthesised values as negative', () => {
    const result = parseMoney('(1,234.56)')
    expect(result.value).toBeCloseTo(-1234.56, 2)
    expect(result.format.parenthesisedNegative).toBe(true)
  })

  it.each([[''], ['N/A'], ['—'], [null], [undefined], [{}], [[]]])(
    'returns null rather than throwing for %s',
    (input) => {
      expect(() => parseMoney(input)).not.toThrow()
      expect(parseMoney(input).value).toBeNull()
    },
  )

  // Indian grouping (1,00,000) does not match the 3-digit grouping shape, so it
  // falls through to the decimal branch. Pinned so the behaviour is a decision
  // rather than a surprise — the reviewer still sees the raw string either way.
  it('does not misread Indian grouping as thousands', () => {
    const result = parseMoney('₹1,00,000')
    expect(result.currency).toBe('INR')
    expect(result.raw).toBe('₹1,00,000')
  })
})

describe('formatMoney', () => {
  // The point of the whole format-capture exercise: an unchanged value must come
  // back out byte-identical, or editing silently rewrites the agent's payload.
  it.each([['PHP 24,118.80'], ['PHP 2,028,509.88'], ['1,234.00 USD'], ['940633.20']])(
    'round-trips %s unchanged',
    (input) => {
      const parsed = parseMoney(input)
      expect(formatMoney(parsed.value as number, parsed.format)).toBe(input)
    },
  )

  it('re-emits an edited value in the original shape', () => {
    const parsed = parseMoney('PHP 24,118.80')
    expect(formatMoney(25000, parsed.format)).toBe('PHP 25,000.00')
  })

  it('keeps a numeric field numeric', () => {
    const parsed = parseMoney(2434211.86)
    expect(formatMoney(2434211.86, parsed.format)).toBe('2434211.86')
  })
})

describe('parseDMY', () => {
  it('parses DD/MM/YYYY', () => {
    expect(parseDMY('24/08/2024').iso).toBe('2024-08-24')
  })

  // Date.UTC would roll this forward to 2 March. A confidently wrong date on a
  // review screen is worse than an unformatted one.
  it('rejects an impossible date instead of rolling it over', () => {
    expect(parseDMY('31/02/2024').iso).toBeNull()
  })

  it.each([['not a date'], [''], [null], [42], [{}]])('never throws on %s', (input) => {
    expect(() => parseDMY(input)).not.toThrow()
    expect(parseDMY(input).iso).toBeNull()
  })

  it('round-trips through formatDMY preserving the separator', () => {
    const parsed = parseDMY('20-08-2024')
    expect(parsed.iso).toBe('2024-08-20')
    expect(formatDMY(parsed.iso as string, parsed.separator)).toBe('20-08-2024')
  })
})

describe('parsePercent', () => {
  it('converts a percentage string to a fraction', () => {
    expect(parsePercent('20%')).toBeCloseTo(0.2, 6)
  })

  it.each([[''], ['N/A'], [null], [{}]])('returns null for %s', (input) => {
    expect(parsePercent(input)).toBeNull()
  })
})

describe('titleCase', () => {
  it.each([
    ['purchase_order_number', 'Purchase Order Number'],
    ['country_of_origin', 'Country Of Origin'],
    ['incoterms', 'Incoterms'],
  ])('formats %s', (input, expected) => {
    expect(titleCase(input)).toBe(expected)
  })
})
