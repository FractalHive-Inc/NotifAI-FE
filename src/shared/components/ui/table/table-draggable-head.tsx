import { type Header } from '@tanstack/react-table'
import { Reorder, useDragControls } from 'framer-motion'
import { GripVertical } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

export interface DraggableTableHeadProps<TData = unknown, TValue = unknown> {
  header: Header<TData, TValue>
  colSpan: number
  children: React.ReactNode
  disabled?: boolean
  /** True while any column in this row is being dragged */
  isDragging?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  /** Extra classes merged into the <th> — use to override default sizing (e.g. compact nested headers) */
  className?: string
}

export function DraggableTableHead<TData, TValue>({
  header,
  colSpan,
  children,
  disabled,
  isDragging,
  onDragStart,
  onDragEnd,
  className,
}: DraggableTableHeadProps<TData, TValue>) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      as="th"
      value={header.column.id}
      dragListener={false}
      dragControls={dragControls}
      // Use spring only while dragging so neighbours animate smoothly into place.
      // When idle, keep layout changes instant to avoid unwanted transitions.
      transition={
        isDragging ? { type: 'spring', stiffness: 500, damping: 40 } : { layout: { duration: 0 } }
      }
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileDrag={{
        scale: 1.03,
        boxShadow: '0 8px 20px -6px rgba(0,0,0,0.25)',
        zIndex: 40,
        cursor: 'grabbing',
      }}
      colSpan={colSpan}
      className={cn(
        'sticky top-0 z-20 select-none bg-fh-primary-50 border-b border-white/30',
        'text-muted-foreground h-12 px-4 text-left align-middle font-medium',
        '[&:has([role=checkbox])]:w-12 [&:has([role=checkbox])]:pr-0',
        className,
      )}
    >
      <div className="flex items-center gap-1">
        {!disabled && (
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
            aria-label={`Reorder column: ${header.column.id}`}
            onPointerDown={(e) => dragControls.start(e)}
          >
            <GripVertical className="size-3.5" aria-hidden="true" />
          </button>
        )}
        {children}
      </div>
    </Reorder.Item>
  )
}
