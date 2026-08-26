import { type Table } from '@tanstack/react-table'
import { Filter, Columns3 } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { ButtonGroup } from '@/shared/components/ui/button-group'
import { AnimatedSearchInput } from '@/shared/components/ui/animated-search-input'

import { TableFilterPopover } from './table-filter'
import { ColumnManagerPopover } from './table-column-manager'
import { SELECTION_COLUMN_ID } from './table-utils'
import { type FilterConfig } from './table-types'

export interface TableToolbarProps<TData> {
  table: Table<TData>
  tableName?: string
  searchPlaceholders?: string[]
  onSearchChange?: (value: string) => void
  filters?: FilterConfig[]
  columnOrder: string[]
  onColumnOrderChange: (order: string[]) => void
  defaultColumnOrder: string[]
}

export function TableToolbar<TData>({
  table,
  tableName,
  searchPlaceholders,
  onSearchChange,
  filters,
  columnOrder,
  onColumnOrderChange,
  defaultColumnOrder,
}: TableToolbarProps<TData>) {
  return (
    <div className="py-3 px-3 flex justify-between items-center">
      <p className="font-bold">{tableName}</p>
      <div className="flex gap-2 items-center">
        <AnimatedSearchInput
          placeholders={searchPlaceholders!}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
        <ButtonGroup>
          <TableFilterPopover table={table} filters={filters || []}>
            <Button type="button" variant="outline" size="icon" aria-label="Filter">
              <Filter className="size-5" strokeWidth={1.5} />
            </Button>
          </TableFilterPopover>
          <ColumnManagerPopover
            table={table}
            columnOrder={columnOrder}
            onColumnOrderChange={onColumnOrderChange}
            defaultColumnOrder={defaultColumnOrder}
            excludeColumns={[SELECTION_COLUMN_ID]}
          >
            <Button type="button" variant="outline" size="icon" aria-label="Manage columns">
              <Columns3 className="size-5" strokeWidth={1.5} />
            </Button>
          </ColumnManagerPopover>
        </ButtonGroup>
      </div>
    </div>
  )
}
