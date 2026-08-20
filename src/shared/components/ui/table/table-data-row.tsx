import { flexRender, type Row } from '@tanstack/react-table'

import { TableCell, TableRow } from './table-primitives'
import { SELECTION_COLUMN_ID } from './table-utils'
import { cn } from '@/shared/lib/utils'

export interface TableDataRowProps<TData> {
  row: Row<TData>
  getRowKey: (row: TData, index: number) => string
  isRowSelected: (rowId: string) => boolean
  isScrolled?: boolean
  onRowClick?: (row: TData) => void
}

export function TableDataRow<TData>({
  row,
  getRowKey,
  isRowSelected,
  isScrolled = false,
  onRowClick,
}: TableDataRowProps<TData>) {
  const rowKey = getRowKey(row.original, row.index)
  const isSelected = isRowSelected(rowKey)

  const selectionCell = row.getVisibleCells().find((c) => c.column.id === SELECTION_COLUMN_ID)
  const allUserCells = row.getVisibleCells().filter((c) => c.column.id !== SELECTION_COLUMN_ID)
  const pinnedCells = allUserCells.filter((c) => c.column.getIsPinned() === 'left')
  const unpinnedCells = allUserCells.filter((c) => c.column.getIsPinned() !== 'left')

  const isSelectionLastPinned = selectionCell && pinnedCells.length === 0

  const selectionLeft = 0
  const selectionWidth = selectionCell ? 48 : 0
  const pinnedStartLeft = selectionWidth

  const pinnedCellOffsets: number[] = []
  let curr = pinnedStartLeft
  for (const cell of pinnedCells) {
    pinnedCellOffsets.push(curr)
    curr += cell.column.getSize()
  }

  return (
    <TableRow
      data-state={isSelected && 'selected'}
      onClick={
        onRowClick
          ? (event) => {
              // A row click must not swallow the controls inside it — the
              // selection checkbox, or any button/link/input a cell renders.
              if (
                (event.target as HTMLElement).closest(
                  'button, a, input, select, textarea, [role="checkbox"], [data-no-row-click]',
                )
              ) {
                return
              }
              onRowClick(row.original)
            }
          : undefined
      }
      className={cn(
        'bg-white group transition-colors',
        onRowClick && 'cursor-pointer',
        isSelected
          ? 'bg-fh-bg-selected-row! hover:bg-fh-bg-selected-row-hover!'
          : 'hover:bg-fh-gray-50',
      )}
    >
      {/* 1. Selection Cell (Sticky) */}
      {selectionCell && (
        <TableCell
          className={cn(
            'sticky z-10 w-12 pr-0 bg-inherit border-b group-last:border-b-0',
            isSelected && 'border-t border-t-primary',
            isSelectionLastPinned &&
              isScrolled &&
              'after:absolute after:top-0 after:left-full after:bottom-0 after:w-5 after:bg-gradient-to-r after:from-black/[0.08] after:to-transparent after:pointer-events-none after:z-20',
          )}
          style={{ left: selectionLeft }}
        >
          {flexRender(selectionCell.column.columnDef.cell, selectionCell.getContext())}
        </TableCell>
      )}

      {/* 2. User Pinned Cells (Sticky) */}
      {pinnedCells.map((cell, index) => {
        const w = cell.column.getSize()
        const leftPos = pinnedCellOffsets[index]
        const isLastIndex = index === pinnedCells.length - 1
        return (
          <TableCell
            key={cell.id}
            className={cn(
              'sticky z-10 bg-inherit border-b group-last:border-b-0',
              isSelected && 'border-t border-t-primary',
              isLastIndex &&
                isScrolled &&
                'after:absolute after:top-0 after:left-full after:bottom-0 after:w-5 after:bg-gradient-to-r after:from-black/[0.08] after:to-transparent after:pointer-events-none after:z-20',
            )}
            style={{ left: leftPos, minWidth: w, width: w }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        )
      })}

      {/* 3. Unpinned Data cells */}
      {unpinnedCells.map((cell) => (
        <TableCell key={cell.id} className={cn(isSelected && 'border-t border-t-primary')}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}
