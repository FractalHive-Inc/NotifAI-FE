import type { ColumnFiltersState } from '@tanstack/react-table'

import type { ApprovalFilters, ApprovalStatusFilter } from '@/types/approvals'

/**
 * Column-filter state, translated into the query the approvals API takes.
 *
 * Shared by the Tasks and Tally tables: both read the same endpoint, both run
 * with `manualFiltering`, and both had their own inline copy of this mapping
 * that only understood `status`.
 *
 * Column ids are the contract on one side and `ApprovalFilters` keys on the
 * other — a column id that does not appear here is simply not sent, which is
 * why `filterConfig` for these tables must only list columns the API supports.
 */

/** A calendar date, not an instant: `toISOString()` would shift it across UTC. */
function toCalendarDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * A text column's value: the panel writes a bare string.
 */
function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * A select column's value, as a list.
 *
 * The panel writes an array when the filter is multi-select and a bare string
 * when it is not, and both shapes reach here — a reader that only understood
 * the string silently sent no filter at all once a column was switched from
 * `singleSelect` to `select`. An empty list is `undefined`: no selection is no
 * filter, not a filter matching nothing.
 */
function listValue(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : [value]
  const entries = raw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  return entries.length > 0 ? entries : undefined
}

export function approvalFiltersFromColumns(columnFilters: ColumnFiltersState): ApprovalFilters {
  const filters: ApprovalFilters = {}
  const read = (id: string) => columnFilters.find((filter) => filter.id === id)?.value

  /**
   * Sent as a list, and `PUSHED_TO_TALLY` is sent as-is: it is a label the
   * Status column derives rather than a status any row stores, and only the API
   * can turn it into the two-column condition it stands for *and* OR that with
   * the other ticked statuses. Expanding it here would have forced a single
   * status per query.
   */
  const status = listValue(read('status'))
  if (status) filters.status = status as ApprovalStatusFilter[]

  const documentId = textValue(read('document_id'))
  if (documentId) filters.document_id = documentId

  const customerName = textValue(read('customer_name'))
  if (customerName) filters.customer_name = customerName

  const documentType = listValue(read('document_type'))
  if (documentType) filters.document_type = documentType

  // dateRange stores [from, to]; either end may be null while the user is
  // mid-selection, and an open end is a legitimate one-sided bound.
  const created = read('created_at')
  if (Array.isArray(created)) {
    const [from, to] = created
    if (from instanceof Date) filters.created_from = toCalendarDate(from)
    if (to instanceof Date) filters.created_to = toCalendarDate(to)
  }

  // number stores [min, max]. 0 is a real bound, so check the type, not truthiness.
  const confidence = read('confidence_score')
  if (Array.isArray(confidence) && confidence.length === 2) {
    const [min, max] = confidence
    if (typeof min === 'number' && Number.isFinite(min)) filters.confidence_min = min
    if (typeof max === 'number' && Number.isFinite(max)) filters.confidence_max = max
  }

  return filters
}
