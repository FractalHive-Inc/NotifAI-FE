import { type Table } from '@tanstack/react-table'
import {
  type FilterConfig,
  type FilterValue,
  type SavedFilter,
  type DateAndTimeRangeValue,
} from './table-types'

export function formatDate(date: Date | null | undefined): string {
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(timeStr?: string, use12Hour: boolean = true): string {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h)) return timeStr
  const displayM = isNaN(m) ? '00' : String(m).padStart(2, '0')
  if (!use12Hour) {
    return `${String(h).padStart(2, '0')}:${displayM}`
  }
  const period = h >= 12 ? 'PM' : 'AM'
  const displayH = h % 12 === 0 ? 12 : h % 12
  return `${String(displayH).padStart(2, '0')}:${displayM} ${period}`
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
    } else if (f.filterType === 'dateAndTimeRange' && val) {
      if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        const dVal = val as DateAndTimeRangeValue
        const use12h = f.use12Hour !== false
        const dStr = dVal.date ? formatDate(dVal.date) : ''
        const tStr =
          dVal.startTime && dVal.endTime
            ? `${formatTime(dVal.startTime, use12h)}–${formatTime(dVal.endTime, use12h)}`
            : dVal.startTime
              ? `from ${formatTime(dVal.startTime, use12h)}`
              : dVal.endTime
                ? `until ${formatTime(dVal.endTime, use12h)}`
                : ''
        if (dStr && tStr) {
          parts.push(`${f.label}: ${dStr} (${tStr})`)
        } else if (dStr) {
          parts.push(`${f.label}: ${dStr}`)
        } else if (tStr) {
          parts.push(`${f.label} (${tStr})`)
        } else {
          parts.push(`${f.label}`)
        }
      } else if (Array.isArray(val)) {
        parts.push(`${f.label}`)
      }
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
    } else if (
      typeof val === 'object' &&
      val !== null &&
      !Array.isArray(val) &&
      !(val instanceof Date)
    ) {
      const dVal = val as DateAndTimeRangeValue
      if (
        dVal.date ||
        (dVal.startTime && dVal.startTime.trim()) ||
        (dVal.endTime && dVal.endTime.trim())
      ) {
        count++
      }
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
  if (typeof val === 'object' && !(val instanceof Date)) {
    const dVal = val as DateAndTimeRangeValue
    return !dVal.date && !dVal.startTime?.trim() && !dVal.endTime?.trim()
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

  if (
    typeof valA === 'object' &&
    valA !== null &&
    !Array.isArray(valA) &&
    !(valA instanceof Date) &&
    typeof valB === 'object' &&
    valB !== null &&
    !Array.isArray(valB) &&
    !(valB instanceof Date)
  ) {
    const a = valA as DateAndTimeRangeValue
    const b = valB as DateAndTimeRangeValue
    const dateSame =
      (!a.date && !b.date) ||
      (a.date instanceof Date && b.date instanceof Date && a.date.getTime() === b.date.getTime())
    return (
      dateSame &&
      (a.startTime ?? '').trim() === (b.startTime ?? '').trim() &&
      (a.endTime ?? '').trim() === (b.endTime ?? '').trim()
    )
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
