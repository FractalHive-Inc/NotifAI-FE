import * as React from 'react'

import { cn } from '@/shared/lib/utils'

interface TableProps extends React.ComponentProps<'table'> {
  containerClassName?: string
  containerStyle?: React.CSSProperties
  onScrollContainer?: (e: React.UIEvent<HTMLDivElement>) => void
  scrollContainerRef?: React.Ref<HTMLDivElement>
}

function Table({
  className,
  containerClassName,
  containerStyle,
  onScrollContainer,
  scrollContainerRef,
  ...props
}: TableProps) {
  return (
    <div
      ref={scrollContainerRef}
      onScroll={onScrollContainer}
      className={cn(
        'relative w-full max-h-136 overflow-auto overscroll-none table-scrollbar',
        containerClassName,
      )}
      style={containerStyle}
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm border-separate border-spacing-0', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('sticky top-0 z-20 bg-fh-primary-50', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child>td]:border-b-0 [&_tr:last-child>th]:border-b-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('bg-muted/50 border-t font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-muted-foreground h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:w-12 [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('p-4 align-middle border-b [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption }
