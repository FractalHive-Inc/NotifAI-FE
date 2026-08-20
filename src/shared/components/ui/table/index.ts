export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './table-primitives'

// Sub-components
export { SortableHeader } from './table-sortable-header'
export { DraggableTableHead } from './table-draggable-head'
export { IndeterminateCheckbox } from './table-indeterminate-checkbox'
export { ColumnManagerPopover } from './table-column-manager'
export { TableFilterPopover, TableFilterDrawer } from './table-filter'
export { TableSkeletonRows, type TableSkeletonRowsProps } from './table-skeleton'
export { TableToolbar } from './table-toolbar'
export { TablePagination } from './table-pagination'
export { TableBulkActions } from './table-bulk-actions'
export { TableHeaderRow } from './table-header-row'
export { TableDataRow } from './table-data-row'

// Utilities & constants
export { getColumnId, SELECTION_COLUMN_ID } from './table-utils'

// Types
export type {
  RowSelectionConfig,
  DataTableProps,
  Selection,
  ColumnPinningState,
} from './table-types'

// Main component
export { AdvancedDataTable, type ColumnDef, DataTable } from './table'
