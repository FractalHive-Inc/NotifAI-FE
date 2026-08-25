import { describe, expect, it } from 'vitest'

import { parseSavedFilters, serializeSavedFilters } from '../saved-filter-storage'
import type { SavedFilter } from '@/shared/components/ui/table/table-types'

const filter = (conditions: SavedFilter['conditions']): SavedFilter => ({
  id: 'filter-1',
  name: 'My filter',
  starred: false,
  conditions,
  createdAt: '2026-08-25T10:00:00.000Z',
})

describe('saved filter storage', () => {
  it('round-trips a text filter', () => {
    const [restored] = parseSavedFilters(serializeSavedFilters([filter({ customer_name: 'Acme' })]))
    expect(restored.conditions.customer_name).toBe('Acme')
  })

  it('restores a date range as real Dates', () => {
    // The whole point: everything downstream tests `instanceof Date`.
    const from = new Date(2026, 0, 1)
    const to = new Date(2026, 0, 31)
    const [restored] = parseSavedFilters(
      serializeSavedFilters([filter({ created_at: [from, to] })]),
    )

    const range = restored.conditions.created_at as [Date | null, Date | null]
    expect(range[0]).toBeInstanceOf(Date)
    expect(range[1]).toBeInstanceOf(Date)
    expect(range[0]?.getTime()).toBe(from.getTime())
    expect(range[1]?.getTime()).toBe(to.getTime())
  })

  it('keeps a one-sided range one-sided', () => {
    const [restored] = parseSavedFilters(
      serializeSavedFilters([filter({ created_at: [new Date(2026, 5, 9), null] })]),
    )
    const range = restored.conditions.created_at as [Date | null, Date | null]
    expect(range[0]).toBeInstanceOf(Date)
    expect(range[1]).toBeNull()
  })

  it('leaves a text value that merely looks like a timestamp as a string', () => {
    // A shape-sniffing reviver would turn this into a Date and break the filter.
    const [restored] = parseSavedFilters(
      serializeSavedFilters([filter({ document_id: '2026-01-01T00:00:00.000Z' })]),
    )
    expect(restored.conditions.document_id).toBe('2026-01-01T00:00:00.000Z')
    expect(restored.conditions.document_id).not.toBeInstanceOf(Date)
  })

  it('round-trips a number range including a zero bound', () => {
    const [restored] = parseSavedFilters(
      serializeSavedFilters([filter({ confidence_score: [0, 70] })]),
    )
    expect(restored.conditions.confidence_score).toEqual([0, 70])
  })

  it('round-trips the date-and-time range shape', () => {
    const date = new Date(2026, 2, 14)
    const [restored] = parseSavedFilters(
      serializeSavedFilters([
        filter({ received_at: { date, startTime: '09:00', endTime: '17:00' } }),
      ]),
    )
    const value = restored.conditions.received_at as {
      date: Date | null
      startTime?: string
      endTime?: string
    }
    expect(value.date).toBeInstanceOf(Date)
    expect(value.startTime).toBe('09:00')
  })

  it('keeps createdAt a string rather than reviving it', () => {
    const [restored] = parseSavedFilters(serializeSavedFilters([filter({ status: 'PENDING' })]))
    expect(restored.createdAt).toBe('2026-08-25T10:00:00.000Z')
  })

  it('returns an empty list for junk rather than throwing', () => {
    expect(parseSavedFilters(null)).toEqual([])
    expect(parseSavedFilters('')).toEqual([])
    expect(parseSavedFilters('not json')).toEqual([])
    expect(parseSavedFilters('{"not":"an array"}')).toEqual([])
  })

  it('drops malformed entries but keeps the good ones', () => {
    const raw = JSON.stringify([{ id: 'x' }, { id: 'y', name: 'Good', conditions: {} }])
    const restored = parseSavedFilters(raw)
    expect(restored).toHaveLength(1)
    expect(restored[0].name).toBe('Good')
  })

  it('drops a corrupted date tag instead of yielding an Invalid Date', () => {
    const raw = JSON.stringify([
      { id: 'x', name: 'Bad date', conditions: { created_at: [{ __type: 'date', iso: 'nope' }] } },
    ])
    const range = parseSavedFilters(raw)[0].conditions.created_at as unknown[]
    expect(range[0]).toBeNull()
  })
})
