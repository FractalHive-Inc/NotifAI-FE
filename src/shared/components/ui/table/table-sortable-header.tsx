import * as React from 'react'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

export interface SortableHeaderProps {
  canSort: boolean
  sorted: false | 'asc' | 'desc'
  onSort?: (event: unknown) => void
  children: React.ReactNode
  className?: string
}

export function SortableHeader({
  canSort,
  sorted,
  onSort,
  className,
  children,
}: SortableHeaderProps) {
  if (!canSort) {
    return <div className={cn('font-medium', className)}>{children}</div>
  }

  const sortLabel =
    sorted === 'asc'
      ? `${children} (sorted ascending, click to sort descending)`
      : sorted === 'desc'
        ? `${children} (sorted descending, click to remove sort)`
        : `${children} (click to sort ascending)`

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('data-[state=open]:bg-accent -ml-3 h-8', className)}
      onClick={(e) => onSort?.(e)}
      aria-label={sortLabel}
    >
      <span>{children}</span>
      {sorted === 'asc' ? (
        <ArrowUp className="ml-2 size-4" aria-hidden="true" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="ml-2 size-4" aria-hidden="true" />
      ) : (
        <ArrowUpDown className="ml-2 size-4 opacity-50" aria-hidden="true" />
      )}
    </Button>
  )
}
