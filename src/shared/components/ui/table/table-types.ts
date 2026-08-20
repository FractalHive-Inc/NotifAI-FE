import { type ColumnDef, type ColumnPinningState, type TableOptions } from '@tanstack/react-table'

export type { ColumnPinningState }

export type Selection = {
  mode: 'include' | 'exclude'
  ids: Set<string>
}

export interface BulkAction<TData> {
  /** Unique key for the action */
  id: string
  /** Display label */
  label: string
  /** Optional icon component or ReactNode */
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode
  /** Action click handler */
  onClick: (selection: Selection, selectedPageRows: TData[]) => void
  /** Button variant styling */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost'
  /** Disabled state */
  disabled?: boolean
}

export interface RowSelectionConfig<TData> {
  /** Controlled selection state */
  selection?: Selection
  /** Called with updated selection state and selected row objects on current page whenever selection changes */
  onSelectionChange?: (selection: Selection, selectedPageRows: TData[]) => void
  /** Total count of items matching current filters across all pages */
  totalCount?: number
  /** Custom row key extractor (defaults to row.id or index) */
  getRowId?: (row: TData, index: number) => string
  /** Configurable bulk actions rendered in the selection banner */
  actions?: BulkAction<TData>[]
  /** Max visible bulk action buttons before collapsing excess actions into an overflow menu (default: 2) */
  maxVisibleActions?: number
}

export interface FilterOption {
  label: string
  value: string
}

/** Discriminated union for all filter types */
export type FilterConfig =
  | SelectFilterConfig
  | SingleSelectFilterConfig
  | TextFilterConfig
  | NumberFilterConfig
  | DateFilterConfig
  | DateRangeFilterConfig

export interface SelectFilterConfig {
  filterType: 'select'
  id: string
  label: string
  options: FilterOption[]
  isMulti?: boolean
}

export interface SingleSelectFilterConfig {
  filterType: 'singleSelect'
  id: string
  label: string
  options: FilterOption[]
}

export interface TextFilterConfig {
  filterType: 'text'
  id: string
  label: string
  placeholder?: string
}

export type NumberFilterCondition = 'between' | 'greater_than' | 'less_than' | 'equals'

export interface NumberFilterConfig {
  filterType: 'number'
  id: string
  label: string
  min?: number
  max?: number
  step?: number
  prefix?: string // e.g. '$'
  suffix?: string
  presets?: {
    label: string
    value: [number, number]
    condition?: NumberFilterCondition
  }[]
}

export interface DateFilterConfig {
  filterType: 'date'
  id: string
  label: string
}

export interface DateRangeFilterConfig {
  filterType: 'dateRange'
  id: string
  label: string
}

/** The stored value shape per filter type */
export type FilterValue =
  | string[] // select
  | string // text
  | [number, number] // number range [min, max]
  | Date // date
  | [Date | null, Date | null] // dateRange [from, to]

/** A persisted/saved filter configuration */
export interface SavedFilter {
  id: string
  name: string
  starred: boolean
  /** Map of column id → filter value */
  conditions: Record<string, FilterValue>
  createdAt?: string
}

export interface DataTableProps<TData, TValue> {
  /**
   * Column definitions.
   */
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  tableOptions?: Omit<TableOptions<TData>, 'data' | 'columns' | 'getCoreRowModel'>
  className?: string
  isTableLoading?: boolean
  skeletonRowCount?: number
  tableName?: string
  searchPlaceholders?: string[]
  /** Column ids that cannot be dragged (e.g. a selection checkbox column) */
  disableReorderFor?: string[]
  /** Called whenever the user finishes reordering columns */
  onColumnOrderChange?: (order: string[]) => void
  /** Called whenever the search input value changes */
  onSearchChange?: (value: string) => void
  /** Filter configurations passed to the table's filter popover */
  filters?: FilterConfig[]
  /** Externally managed list of saved filters (from DB, etc.) */
  savedFilters?: SavedFilter[]
  /** Called when the user saves a new filter config */
  onSaveFilter?: (filter: SavedFilter) => void | Promise<void>
  /** Called when the user updates an existing saved filter */
  onUpdateFilter?: (filter: SavedFilter) => void | Promise<void>
  /** Called when the user deletes a saved filter */
  onDeleteFilter?: (id: string) => void
  /** Called when the user stars/un-stars a saved filter */
  onStarFilter?: (id: string, starred: boolean) => void
  /**
   * When provided, a checkbox column is prepended to the table enabling
   * per-row and select-all selection.
   */
  rowSelection?: RowSelectionConfig<TData>
  /**
   * Configurable options for the number of rows per page dropdown.
   * If provided, a dropdown will be displayed next to the pagination controls.
   */
  pageSizeOptions?: number[]
  /** Called whenever the user changes column pinning */
  onColumnPinningChange?: (pinning: ColumnPinningState) => void
  /** Storage key to persist column pinning and reorder state in localStorage. Defaults to tableName if available. */
  storageKey?: string
  /**
   * Fixed height for the table container. When specified, vertical overflow will be scrollable.
   * e.g., "400px", "50vh", or a number in pixels.
   */
  tableHeight?: string | number
  /**
   * Called when a data row is clicked. Clicks originating inside the selection
   * checkbox, or on an interactive element within a cell, are ignored.
   */
  onRowClick?: (row: TData) => void
}
