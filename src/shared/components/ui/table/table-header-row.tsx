import { flexRender, type HeaderGroup } from '@tanstack/react-table'
import { Reorder } from 'motion/react'
import { Pin } from 'lucide-react'

import { DraggableTableHead } from './table-draggable-head'
import { IndeterminateCheckbox } from './table-indeterminate-checkbox'
import { SortableHeader } from './table-sortable-header'
import { SELECTION_COLUMN_ID } from './table-utils'
import { cn } from '@/shared/lib/utils'

export interface TableHeaderRowProps<TData> {
  headerGroup: HeaderGroup<TData>
  isAllPageSelected: boolean
  isSomePageSelected: boolean
  toggleAllPageRows: () => void
  columnOrder: string[]
  handleReorder: (nextOrder: string[]) => void
  disableReorderFor: string[]
  isAnyDragging: boolean
  setIsAnyDragging: (isDragging: boolean) => void
  isScrolled?: boolean
}

export function TableHeaderRow<TData>({
  headerGroup,
  isAllPageSelected,
  isSomePageSelected,
  toggleAllPageRows,
  columnOrder,
  handleReorder,
  disableReorderFor,
  isAnyDragging,
  setIsAnyDragging,
  isScrolled = false,
}: TableHeaderRowProps<TData>) {
  const selectionHeader = headerGroup.headers.find((h) => h.column.id === SELECTION_COLUMN_ID)
  const allUserHeaders = headerGroup.headers.filter((h) => h.column.id !== SELECTION_COLUMN_ID)
  const pinnedHeaders = allUserHeaders.filter((h) => h.column.getIsPinned() === 'left')
  const unpinnedHeaders = allUserHeaders.filter((h) => h.column.getIsPinned() !== 'left')

  const isSelectionLastPinned = selectionHeader && pinnedHeaders.length === 0

  const selectionLeft = 0
  const selectionWidth = selectionHeader ? 48 : 0
  const pinnedStartLeft = selectionWidth

  const pinnedHeaderOffsets: number[] = []
  let curr = pinnedStartLeft
  for (const h of pinnedHeaders) {
    pinnedHeaderOffsets.push(curr)
    curr += h.getSize()
  }

  return (
    <tr key={headerGroup.id} className="">
      {/* 1. Selection Header (Sticky Left & Top) */}
      {selectionHeader && (
        <th
          className={cn(
            'sticky top-0 z-30 bg-[#ebf0f5] h-12 w-12 px-4 text-left align-middle font-medium border-b border-white/30',
            isSelectionLastPinned &&
              isScrolled &&
              'after:absolute after:top-0 after:left-full after:bottom-0 after:w-5 after:bg-linear-to-r after:from-black/8 after:to-transparent after:pointer-events-none after:z-30',
          )}
          style={{ left: selectionLeft, top: 0 }}
        >
          <IndeterminateCheckbox
            checked={isAllPageSelected}
            indeterminate={isSomePageSelected}
            onChange={toggleAllPageRows}
            aria-label="Select all rows on this page"
          />
        </th>
      )}

      {/* 2. User Pinned Headers (Sticky Left & Top) */}
      {pinnedHeaders.map((header, index) => {
        const w = header.getSize()
        const leftPos = pinnedHeaderOffsets[index]
        const isLastIndex = index === pinnedHeaders.length - 1
        return (
          <th
            key={header.id}
            colSpan={header.colSpan}
            className={cn(
              'sticky top-0 z-30 bg-[#ebf0f5] h-12 px-4 text-left  align-middle font-medium uppercase text-primary border-b border-white/30',
              isLastIndex &&
                isScrolled &&
                'after:absolute after:top-0 after:left-full after:bottom-0 after:w-5 after:bg-gradient-to-r after:from-black/[0.08] after:to-transparent after:pointer-events-none after:z-30',
            )}
            style={{ left: leftPos, minWidth: w, width: w, top: 0 }}
          >
            <div className="flex items-center gap-1 ">
              {header.isPlaceholder ? null : (
                <SortableHeader
                  canSort={header.column.getCanSort()}
                  sorted={
                    header.column.getIsSorted() === false
                      ? false
                      : header.column.getIsSorted() === 'asc'
                        ? 'asc'
                        : 'desc'
                  }
                  onSort={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1.5 uppercase">
                    <Pin className="size-3 fill-current opacity-40 rotate-45" />
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </div>
                </SortableHeader>
              )}
            </div>
          </th>
        )
      })}

      {/* 4. Reorderable User Headers */}
      <Reorder.Group
        as="td"
        style={{ display: 'contents' }}
        axis="x"
        values={columnOrder}
        onReorder={handleReorder}
      >
        {unpinnedHeaders.map((header) => (
          <DraggableTableHead
            key={header.id}
            header={header}
            colSpan={header.colSpan}
            disabled={disableReorderFor.includes(header.column.id)}
            isDragging={isAnyDragging}
            onDragStart={() => setIsAnyDragging(true)}
            onDragEnd={() => setIsAnyDragging(false)}
          >
            {header.isPlaceholder ? (
              <span className="text-muted-foreground text-xs font-normal">Column</span>
            ) : (
              <SortableHeader
                className="uppercase text-[#14181d]"
                canSort={header.column.getCanSort()}
                sorted={
                  header.column.getIsSorted() === false
                    ? false
                    : header.column.getIsSorted() === 'asc'
                      ? 'asc'
                      : 'desc'
                }
                onSort={header.column.getToggleSortingHandler()}
              >
                {flexRender(header.column.columnDef.header, header.getContext()) || (
                  <span className="text-muted-foreground text-xs font-normal">Column</span>
                )}
              </SortableHeader>
            )}
          </DraggableTableHead>
        ))}
      </Reorder.Group>
    </tr>
  )
}
