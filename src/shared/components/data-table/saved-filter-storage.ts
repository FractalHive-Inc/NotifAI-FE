import type { FilterValue, SavedFilter } from '@/shared/components/ui/table/table-types'

/**
 * Serialisation for saved filters.
 *
 * `conditions` holds live `Date` objects for the date filters, and JSON turns
 * those into strings. Everything downstream tests `instanceof Date` — the
 * table's own `auto` filterFn, and `approvalFiltersFromColumns` — so a naively
 * round-tripped "Received: last 30 days" reloads as a filter that silently
 * matches nothing.
 *
 * Dates are tagged on the way out rather than sniffed on the way back in. A
 * reviver that guesses from the shape of a string would also convert a *text*
 * filter whose value happens to look like a timestamp, and JSON gives us no way
 * to tell those apart after the fact.
 */

interface TaggedDate {
  __type: 'date'
  iso: string
}

const isTaggedDate = (value: unknown): value is TaggedDate =>
  typeof value === 'object' &&
  value !== null &&
  (value as TaggedDate).__type === 'date' &&
  typeof (value as TaggedDate).iso === 'string'

function encodeValue(value: unknown): unknown {
  if (value instanceof Date)
    return { __type: 'date', iso: value.toISOString() } satisfies TaggedDate
  if (Array.isArray(value)) return value.map(encodeValue)
  if (typeof value === 'object' && value !== null) {
    // DateAndTimeRangeValue — { date, startTime, endTime }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        encodeValue(inner),
      ]),
    )
  }
  return value
}

function decodeValue(value: unknown): unknown {
  if (isTaggedDate(value)) {
    const date = new Date(value.iso)
    // A corrupted tag must not become an Invalid Date that silently fails every
    // comparison it takes part in.
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (Array.isArray(value)) return value.map(decodeValue)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        decodeValue(inner),
      ]),
    )
  }
  return value
}

/** Shape check, so a stale or hand-edited entry is dropped rather than crashing a page. */
function isSavedFilterShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<SavedFilter>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.conditions === 'object' &&
    candidate.conditions !== null
  )
}

export function serializeSavedFilters(filters: SavedFilter[]): string {
  return JSON.stringify(
    filters.map((filter) => ({
      ...filter,
      conditions: encodeValue(filter.conditions),
    })),
  )
}

/**
 * Total: any malformed input yields an empty list rather than throwing. This
 * reads from localStorage, which can hold anything a previous version wrote.
 */
export function parseSavedFilters(raw: string | null | undefined): SavedFilter[] {
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  return parsed.filter(isSavedFilterShape).map((filter) => {
    const entry = filter as SavedFilter
    return {
      ...entry,
      starred: Boolean(entry.starred),
      conditions: decodeValue(entry.conditions) as Record<string, FilterValue>,
    }
  })
}
