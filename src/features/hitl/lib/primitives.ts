import type {
  DateValue,
  FieldKind,
  ListValue,
  MoneyFormat,
  MoneyValue,
  RawValue,
  TextValue,
} from './types'

/**
 * Type guards and value parsers for the agent's loose payload.
 *
 * Every function here is total: none throws, for any input. That is what lets
 * `parseDocInsights` promise the same, and lets the UI render every branch
 * without a try/catch or an error boundary.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

/** Coerces array members to display strings; non-arrays give null. */
export function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.map((item) => (typeof item === 'string' ? item : stringify(item)))
}

/** A display string for any value, never `[object Object]`. */
export function stringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** `purchase_order_number` -> `Purchase Order Number`. */
export function titleCase(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .map((word) =>
      // Leave acronyms the agent already capitalised alone (GST, TIN, VAT, PO).
      word.length <= 4 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(' ')
}

const SYMBOL_CURRENCIES: Record<string, string> = {
  '₹': 'INR',
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₱': 'PHP',
}

const DEFAULT_MONEY_FORMAT: MoneyFormat = {
  prefix: '',
  suffix: '',
  groupSeparator: '',
  decimalSeparator: '.',
  decimals: 2,
  numeric: false,
  parenthesisedNegative: false,
}

/**
 * Parse a money value that may be a JSON number (`2434211.86`) or a formatted
 * string (`"PHP 24,118.80"`). Both occur in the same payload.
 *
 * Returns the raw text unchanged alongside the parsed number: the reviewer must
 * always see exactly what the agent produced, and the number exists only for
 * reconciliation arithmetic.
 *
 * The hard part is the separator. There is no locale in the payload, so the rule
 * is: a separator followed by exactly three digits, in a string whose whole shape
 * matches a grouping pattern, is grouping; anything else is a decimal point.
 * That gives `"2,028,509.88"` -> 2028509.88, `"1.500"` -> 1500, `"1,50"` -> 1.5.
 */
export function parseMoney(input: unknown): MoneyValue {
  if (input === null || input === undefined) {
    return { kind: 'money', raw: '', value: null, currency: null, format: DEFAULT_MONEY_FORMAT }
  }

  if (typeof input === 'number') {
    const finite = Number.isFinite(input)
    return {
      kind: 'money',
      raw: String(input),
      value: finite ? input : null,
      currency: null,
      format: { ...DEFAULT_MONEY_FORMAT, numeric: true, decimals: decimalsOf(input) },
    }
  }

  const raw = stringify(input)
  let s = raw.trim()

  if (!s) {
    return { kind: 'money', raw, value: null, currency: null, format: DEFAULT_MONEY_FORMAT }
  }

  let currency: string | null = null
  let prefix = ''
  let suffix = ''

  // Symbol anywhere, or an alphabetic code at either end.
  for (const [symbol, code] of Object.entries(SYMBOL_CURRENCIES)) {
    if (s.includes(symbol)) {
      currency = code
      const at = s.indexOf(symbol)
      if (at === 0) prefix = s.slice(0, symbol.length)
      else suffix = s.slice(at)
      s = s.replace(symbol, '')
      break
    }
  }

  if (!currency) {
    const leading = /^([A-Za-z]{2,4})\s*/.exec(s)
    if (leading) {
      currency = leading[1].toUpperCase()
      prefix = leading[0]
      s = s.slice(leading[0].length)
    } else {
      const trailing = /\s*([A-Za-z]{2,4})$/.exec(s)
      if (trailing) {
        currency = trailing[1].toUpperCase()
        suffix = trailing[0]
        s = s.slice(0, s.length - trailing[0].length)
      }
    }
  }

  s = s.trim()

  const parenthesised = /^\(.*\)$/.test(s)
  let negative = parenthesised || s.startsWith('-')
  s = s.replace(/^\(|\)$/g, '').replace(/^[-+]/, '')

  const digits = s.replace(/[^0-9.,]/g, '')
  if (!digits) {
    return {
      kind: 'money',
      raw,
      value: null,
      currency,
      format: { ...DEFAULT_MONEY_FORMAT, prefix, suffix },
    }
  }

  const { cleaned, groupSeparator, decimalSeparator, decimals } = resolveSeparators(digits)
  const parsed = Number(cleaned)

  if (!Number.isFinite(parsed)) {
    return {
      kind: 'money',
      raw,
      value: null,
      currency,
      format: { ...DEFAULT_MONEY_FORMAT, prefix, suffix },
    }
  }

  if (parsed === 0) negative = false

  return {
    kind: 'money',
    raw,
    value: negative ? -parsed : parsed,
    currency,
    format: {
      prefix,
      suffix,
      groupSeparator,
      decimalSeparator,
      decimals,
      numeric: false,
      parenthesisedNegative: parenthesised,
    },
  }
}

function decimalsOf(value: number): number {
  const text = String(value)
  const dot = text.indexOf('.')
  return dot === -1 ? 0 : text.length - dot - 1
}

function resolveSeparators(digits: string): {
  cleaned: string
  groupSeparator: MoneyFormat['groupSeparator']
  decimalSeparator: MoneyFormat['decimalSeparator']
  decimals: number
} {
  const lastComma = digits.lastIndexOf(',')
  const lastDot = digits.lastIndexOf('.')

  const finish = (
    cleaned: string,
    groupSeparator: MoneyFormat['groupSeparator'],
    decimalSeparator: MoneyFormat['decimalSeparator'],
  ) => {
    const dot = cleaned.indexOf('.')
    return {
      cleaned,
      groupSeparator,
      decimalSeparator,
      decimals: dot === -1 ? 0 : cleaned.length - dot - 1,
    }
  }

  // Both present: the rightmost is the decimal point, the other is grouping.
  if (lastComma !== -1 && lastDot !== -1) {
    return lastComma > lastDot
      ? finish(digits.replace(/\./g, '').replace(',', '.'), '.', ',')
      : finish(digits.replace(/,/g, ''), ',', '.')
  }

  if (lastComma !== -1) {
    return /^\d{1,3}(,\d{3})+$/.test(digits)
      ? finish(digits.replace(/,/g, ''), ',', '.')
      : finish(digits.replace(',', '.'), '', ',')
  }

  if (lastDot !== -1) {
    return /^\d{1,3}(\.\d{3})+$/.test(digits)
      ? finish(digits.replace(/\./g, ''), '.', ',')
      : finish(digits, '', '.')
  }

  return finish(digits, '', '.')
}

/** Re-emit a number in the shape the agent originally used. */
export function formatMoney(value: number, format: MoneyFormat): string {
  if (format.numeric) return String(value)

  const negative = value < 0
  const absolute = Math.abs(value)
  const fixed = absolute.toFixed(format.decimals)
  const [whole, fraction] = fixed.split('.')

  const grouped = format.groupSeparator
    ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, format.groupSeparator)
    : whole

  let body = fraction ? `${grouped}${format.decimalSeparator}${fraction}` : grouped

  if (negative) {
    body = format.parenthesisedNegative ? `(${body})` : `-${body}`
  }

  return `${format.prefix}${body}${format.suffix}`
}

/** `"20%"` -> 0.2. Null for anything unparseable. */
export function parsePercent(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input / 100 : null
  if (typeof input !== 'string') return null

  const digits = input.replace(/[^0-9.,-]/g, '')
  if (!digits) return null

  const parsed = Number(resolveSeparators(digits.replace(/^-/, '')).cleaned)
  if (!Number.isFinite(parsed)) return null

  return (input.trim().startsWith('-') ? -parsed : parsed) / 100
}

const DATE_PATTERN = /^(\d{1,2})([/\-.])(\d{1,2})\2(\d{4})$/

/**
 * Parse the agent's `DD/MM/YYYY` dates.
 *
 * The round-trip check is what rejects `31/02/2024` — `Date.UTC` would happily
 * roll it forward to 2 March, and a confidently wrong date on a review screen is
 * worse than an unformatted one. Ambiguous inputs like `03/04/2024` are read as
 * stated in the contract, and the raw string stays the primary display.
 */
export function parseDMY(input: unknown): DateValue {
  const raw = stringify(input)
  const match = DATE_PATTERN.exec(raw.trim())

  if (!match) return { kind: 'date', raw, iso: null, separator: '/' }

  const day = Number(match[1])
  const separator = match[2]
  const month = Number(match[3])
  const year = Number(match[4])

  const date = new Date(Date.UTC(year, month - 1, day))
  const roundTrips =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day

  if (!roundTrips) return { kind: 'date', raw, iso: null, separator }

  return { kind: 'date', raw, iso: date.toISOString().slice(0, 10), separator }
}

/** Re-emit an ISO date in the agent's original `DD/MM/YYYY` shape. */
export function formatDMY(iso: string, separator: string): string {
  const [year, month, day] = iso.split('-')
  return [day, month, year].join(separator)
}

export function textValue(input: unknown): TextValue {
  return { kind: 'text', raw: stringify(input) }
}

export function listValue(items: string[]): ListValue {
  return { kind: 'list', raw: items.join(', '), items }
}

export function rawValue(input: unknown): RawValue {
  return { kind: 'raw', raw: stringify(input), json: input }
}

const MONEY_SHAPE = /^[A-Za-z]{2,4}\s*[\d,.]+$/
const SYMBOL_SHAPE = /[₹$€£¥₱]/

/** Best guess at how to render a value we have no spec for. */
export function inferKind(value: unknown): FieldKind {
  if (Array.isArray(value)) return 'list'
  if (isRecord(value)) return 'raw'
  if (typeof value === 'number') return 'text'
  if (typeof value !== 'string') return 'text'

  const trimmed = value.trim()
  if (DATE_PATTERN.test(trimmed)) return 'date'
  if (MONEY_SHAPE.test(trimmed) || SYMBOL_SHAPE.test(trimmed)) return 'money'

  return 'text'
}

/** Build a `FieldValue` of a given kind, without ever throwing. */
export function toFieldValue(value: unknown, kind: FieldKind) {
  switch (kind) {
    case 'money':
      return parseMoney(value)
    case 'date':
      return parseDMY(value)
    case 'list': {
      const items = asStringArray(value)
      return items ? listValue(items) : textValue(value)
    }
    case 'raw':
      return rawValue(value)
    default:
      return textValue(value)
  }
}
