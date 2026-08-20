import { type Table } from '@tanstack/react-table'
import { type FilterConfig, type FilterValue, type SavedFilter } from './table-types'

export function formatDate(date: Date | null | undefined): string {
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatNumber(value: number, prefix?: string, suffix?: string): string {
  const formatted = new Intl.NumberFormat('en-US').format(value)
  return `${prefix ?? ''}${formatted}${suffix ?? ''}`
}

export function buildFilterSummary(
  filters: FilterConfig[],
  conditions: Record<string, FilterValue>,
): string {
  const parts: string[] = []
  for (const f of filters) {
    const val = conditions[f.id]
    if (!val) continue
    if (f.filterType === 'select' && Array.isArray(val) && val.length > 0) {
      parts.push(`${f.label} (${val.length})`)
    } else if (
      (f.filterType === 'select' || f.filterType === 'singleSelect') &&
      typeof val === 'string' &&
      val.trim()
    ) {
      const opt = f.options.find((o) => o.value === val)
      parts.push(`${f.label}: ${opt ? opt.label : val}`)
    } else if (f.filterType === 'text' && typeof val === 'string' && val.trim()) {
      parts.push(`${f.label}`)
    } else if (f.filterType === 'number' && Array.isArray(val)) {
      parts.push(`${f.label}`)
    } else if (f.filterType === 'date' && val instanceof Date) {
      parts.push(`${f.label}`)
    } else if (f.filterType === 'dateRange' && Array.isArray(val)) {
      parts.push(`${f.label} (Last 7 days)`)
    }
  }
  return parts.join(', ')
}

export function countActiveConditions(conditions: Record<string, FilterValue>): number {
  let count = 0
  for (const val of Object.values(conditions)) {
    if (Array.isArray(val)) {
      if (val.length > 0 && val.some((v) => v !== null)) count++
    } else if (val instanceof Date) {
      count++
    } else if (typeof val === 'string' && val.trim()) {
      count++
    }
  }
  return count
}

export function conditionsFromTable<TData>(
  table: Table<TData>,
  filters: FilterConfig[],
): Record<string, FilterValue> {
  const result: Record<string, FilterValue> = {}
  for (const f of filters) {
    const raw = table.getColumn(f.id)?.getFilterValue()
    if (raw !== undefined && raw !== null) {
      result[f.id] = raw as FilterValue
    }
  }
  return result
}

export function isEmptyFilterValue(val: FilterValue | undefined): boolean {
  if (val === undefined || val === null) return true
  if (typeof val === 'string') return val.trim() === ''
  if (Array.isArray(val)) {
    if (val.length === 0) return true
    return val.every((item) => item === null || item === undefined || item === '')
  }
  return false
}

export function isSameFilterValue(
  valA: FilterValue | undefined,
  valB: FilterValue | undefined,
): boolean {
  const emptyA = isEmptyFilterValue(valA)
  const emptyB = isEmptyFilterValue(valB)
  if (emptyA && emptyB) return true
  if (emptyA !== emptyB) return false

  if (typeof valA === 'string' && typeof valB === 'string') {
    return valA.trim() === valB.trim()
  }

  if (valA instanceof Date && valB instanceof Date) {
    return valA.getTime() === valB.getTime()
  }

  if (Array.isArray(valA) && Array.isArray(valB)) {
    if (valA.length !== valB.length) return false
    for (let i = 0; i < valA.length; i++) {
      const a = valA[i]
      const b = valB[i]
      if (a instanceof Date && b instanceof Date) {
        if (a.getTime() !== b.getTime()) return false
      } else if (a !== b) {
        return false
      }
    }
    return true
  }

  return valA === valB
}

export function isSavedFilterActive(
  sf: SavedFilter,
  currentConditions: Record<string, FilterValue>,
  filters: FilterConfig[],
): boolean {
  if (!sf.conditions) return false
  const sfKeys = Object.keys(sf.conditions).filter((key) => !isEmptyFilterValue(sf.conditions[key]))
  if (sfKeys.length === 0) return false

  for (const f of filters) {
    const valA = sf.conditions[f.id]
    const valB = currentConditions[f.id]
    if (!isSameFilterValue(valA, valB)) return false
  }
  return true
}
