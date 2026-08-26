import { type Table } from '@tanstack/react-table'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { TableRow, TableCell } from './table-primitives'
import { SELECTION_COLUMN_ID } from './table-utils'
import { cn } from '@/shared/lib/utils'

export interface TableSkeletonRowsProps<TData> {
  table: Table<TData>
  skeletonRowCount?: number
  isScrolled?: boolean
}

export function TableSkeletonRows<TData>({
  table,
  skeletonRowCount = 5,
  isScrolled = false,
}: TableSkeletonRowsProps<TData>) {
  const headerGroup = table.getHeaderGroups()[0]
  const selectionHeader = headerGroup?.headers.find((h) => h.column.id === SELECTION_COLUMN_ID)
  const allUserHeaders =
    headerGroup?.headers.filter((h) => h.column.id !== SELECTION_COLUMN_ID) ?? []
  const pinnedHeaders = allUserHeaders.filter((h) => h.column.getIsPinned() === 'left')
  const unpinnedHeaders = allUserHeaders.filter((h) => h.column.getIsPinned() !== 'left')
  const isSelectionLastPinned = selectionHeader && pinnedHeaders.length === 0

  return (
    <>
      {Array.from({ length: skeletonRowCount }).map((_, rowIndex) => {
        let currentLeft = 0
        return (
          <TableRow
            key={`skeleton-row-${rowIndex}`}
            className="bg-white hover:bg-slate-50 border-b"
          >
            {/* 1. Selection Skeleton Cell */}
            {selectionHeader && (
              <TableCell
                className={cn(
                  'sticky z-10 w-12 pr-0 bg-inherit',
                  isSelectionLastPinned &&
                    isScrolled &&
                    'after:absolute after:top-0 after:left-full after:bottom-0 after:w-5 after:bg-gradient-to-r after:from-black/[0.08] after:to-transparent after:pointer-events-none after:z-20',
                )}
                style={{ left: currentLeft }}
                {...((currentLeft += 48), {})}
              >
                <Skeleton className="size-4 rounded" />
              </TableCell>
            )}

            {/* 2. Pinned Columns Skeleton Cells */}
            {pinnedHeaders.map((header, colIdx) => {
              const w = header.getSize()
              const leftPos = currentLeft
              currentLeft += w
              const isLastIndex = colIdx === pinnedHeaders.length - 1
              const widths = ['60%', '80%', '45%', '70%', '90%']
              const width = widths[(rowIndex + colIdx) % widths.length]
              return (
                <TableCell
                  key={`skeleton-pinned-${header.id}-${colIdx}`}
                  className={cn(
                    'sticky z-10 bg-inherit',
                    isLastIndex &&
                      isScrolled &&
                      'after:absolute after:top-0 after:left-full after:bottom-0 after:w-5 after:bg-gradient-to-r after:from-black/[0.08] after:to-transparent after:pointer-events-none after:z-20',
                  )}
                  style={{ left: leftPos, minWidth: w, width: w }}
                >
                  <Skeleton className="h-4 rounded-md" style={{ width }} />
                </TableCell>
              )
            })}

            {/* 4. Unpinned Columns Skeleton Cells */}
            {unpinnedHeaders.map((header, colIdx) => {
              const widths = ['70%', '40%', '85%', '60%', '75%']
              const width = widths[(rowIndex + colIdx) % widths.length]
              return (
                <TableCell key={`skeleton-unpinned-${header.id}-${colIdx}`}>
                  <Skeleton className="h-4 rounded-md" style={{ width }} />
                </TableCell>
              )
            })}
          </TableRow>
        )
      })}
    </>
  )
}
