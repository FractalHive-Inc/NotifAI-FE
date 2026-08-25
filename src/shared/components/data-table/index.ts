/**
 * App-owned table layer. Pages import from here.
 *
 * It also re-exports the registry types pages need, so that a page never has to
 * reach into `ui/table` (or, worse, deep-import `ui/table/table-types`) and
 * couple itself to a file that gets overwritten on every registry refresh.
 */
export { DataTable, type AppDataTableProps } from './data-table'
export { useSavedFilters, type SavedFilterHandlers } from './use-saved-filters'
export { parseSavedFilters, serializeSavedFilters } from './saved-filter-storage'

export type {
  ColumnDef,
  DataTableProps,
  RowSelectionConfig,
  Selection,
  ColumnPinningState,
} from '@/shared/components/ui/table'

export type {
  BulkAction,
  FilterConfig,
  FilterOption,
  FilterValue,
  SavedFilter,
} from '@/shared/components/ui/table/table-types'
