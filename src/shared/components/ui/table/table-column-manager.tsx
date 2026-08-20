import * as React from 'react'

import { type Table, type Column } from '@tanstack/react-table'
import { Reorder, useDragControls } from 'framer-motion'
import { Eye, EyeOff, GripVertical, Pin, RotateCcw } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

// ─── Draggable row inside the popover list ───────────────────────────────────

interface ColumnItemProps<TData = unknown, TValue = unknown> {
  column: Column<TData, TValue>
  /** The display label shown in the list */
  label: string
}

function ColumnItem<TData, TValue>({ column, label }: ColumnItemProps<TData, TValue>) {
  const dragControls = useDragControls()
  const isVisible = column.getIsVisible()
  const isPinned = column.getIsPinned() === 'left'

  return (
    <Reorder.Item
      value={column.id}
      dragListener={false}
      dragControls={dragControls}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-2 select-none',
        'hover:bg-muted/50 transition-colors cursor-default',
        !isVisible && 'opacity-50',
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing shrink-0"
        aria-label={`Reorder column ${label}`}
        onPointerDown={(e) => dragControls.start(e)}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Column name */}
      <span className="flex-1 text-sm font-medium truncate">{label}</span>

      {/* Visibility toggle */}
      <button
        type="button"
        className={cn(
          'shrink-0 transition-colors',
          isVisible
            ? 'text-muted-foreground hover:text-foreground'
            : 'text-muted-foreground/40 hover:text-muted-foreground',
        )}
        onClick={() => column.toggleVisibility()}
        aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
      >
        {isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>

      {/* Pin toggle */}
      <button
        type="button"
        className={cn(
          'shrink-0 transition-colors',
          isPinned ? 'text-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground',
        )}
        onClick={() => column.pin(isPinned ? false : 'left')}
        aria-label={isPinned ? `Unpin ${label}` : `Pin ${label} left`}
      >
        <Pin className={cn('size-4', isPinned && 'fill-current')} />
      </button>
    </Reorder.Item>
  )
}

// ─── Main ColumnManagerPopover ───────────────────────────────────────────────

export interface ColumnManagerPopoverProps<TData = unknown> {
  table: Table<TData>
  /** Current ordered list of column ids */
  columnOrder: string[]
  /** Called when the user reorders columns inside the popover */
  onColumnOrderChange: (order: string[]) => void
  /** Original column order — used by the Reset button */
  defaultColumnOrder: string[]
  /**
   * Column IDs to exclude from the manager panel
   * (e.g. SELECTION_COLUMN_ID, expand column)
   */
  excludeColumns?: string[]
  /** The button/icon that opens the popover */
  children: React.ReactNode
}

export function ColumnManagerPopover<TData>({
  table,
  columnOrder,
  onColumnOrderChange,
  defaultColumnOrder,
  excludeColumns = [],
  children,
}: ColumnManagerPopoverProps<TData>) {
  // Derive an ordered list of manageable columns from columnOrder
  const manageableColumns = React.useMemo(() => {
    const allCols = table.getAllColumns()
    const colMap = new Map(allCols.map((c) => [c.id, c]))

    // Follow columnOrder for ordering, then append anything missing
    const ordered = [
      ...columnOrder.filter((id) => !excludeColumns.includes(id) && colMap.has(id)),
      ...allCols
        .map((c) => c.id)
        .filter((id) => !excludeColumns.includes(id) && !columnOrder.includes(id)),
    ]

    return ordered.map((id) => colMap.get(id)!).filter(Boolean)
  }, [table, columnOrder, excludeColumns])

  const visibleCount = manageableColumns.filter((c) => c.getIsVisible()).length
  const totalCount = manageableColumns.length

  // IDs of manageable columns in order — drives the Reorder.Group
  const manageableIds = manageableColumns.map((c) => c.id)

  const handleReorder = (newIds: string[]) => {
    // Merge reordered manageable IDs back with the excluded ones
    // Excluded columns keep their relative position (prepended/appended as configured)
    const excluded = columnOrder.filter((id) => excludeColumns.includes(id))
    // Prepend excluded (e.g. selection checkbox first, then the rest)
    onColumnOrderChange([...excluded, ...newIds])
  }

  const handleReset = () => {
    // Reset order
    onColumnOrderChange(defaultColumnOrder)
    // Reset visibility — make all columns visible
    table.getAllColumns().forEach((col) => {
      if (col.getCanHide()) col.toggleVisibility(true)
    })
    // Reset pinning
    table.resetColumnPinning()
  }

  const getLabel = (col: Column<TData, unknown>): string => {
    const headerDef = col.columnDef.header
    if (typeof headerDef === 'string') return headerDef
    // fallback to readable column id
    return col.id
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim()
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 shadow-xl rounded-2xl border-0"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-sm font-bold">Manage Columns</span>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleReset}
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        </div>

        {/* Draggable column list */}
        <Reorder.Group
          axis="y"
          values={manageableIds}
          onReorder={handleReorder}
          className="px-2 py-1 space-y-0.5 max-h-72 overflow-y-auto"
        >
          {manageableColumns.map((col) => (
            <ColumnItem key={col.id} column={col} label={getLabel(col)} />
          ))}
        </Reorder.Group>

        {/* Footer */}
        <div className="px-4 py-3 text-xs text-muted-foreground border-t mt-1">
          {visibleCount} of {totalCount} Visible
        </div>
      </PopoverContent>
    </Popover>
  )
}
