import { type Table } from '@tanstack/react-table'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Pagination,
} from '@/shared/components/ui/pagination'
import { type RowSelectionConfig } from './table-types'

export interface TablePaginationProps<TData> {
  table: Table<TData>
  pageSizeOptions?: number[]
  rowSelectionConfig?: RowSelectionConfig<TData>
  selectedCount?: number
  totalCount?: number
}

export function TablePagination<TData>({
  table,
  pageSizeOptions,
  rowSelectionConfig,
  selectedCount = 0,
  totalCount = 0,
}: TablePaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()

  const getPageWindow = (): (number | 'ellipsis-start' | 'ellipsis-end')[] => {
    if (pageCount === 0) return []

    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = []
    const maxVisiblePages = 5

    if (pageCount <= maxVisiblePages) {
      for (let i = 0; i < pageCount; i++) pages.push(i)
    } else {
      let startPage = Math.max(0, currentPage - 2)
      let endPage = Math.min(pageCount - 1, currentPage + 2)

      if (currentPage <= 2) {
        endPage = 4
      } else if (currentPage >= pageCount - 3) {
        startPage = pageCount - 5
      }

      for (let i = startPage; i <= endPage; i++) pages.push(i)

      if (startPage > 0) {
        pages[0] = 0
        if (startPage > 1) pages[1] = 'ellipsis-start'
      }
      if (endPage < pageCount - 1) {
        pages[pages.length - 1] = pageCount - 1
        if (endPage < pageCount - 2) pages[pages.length - 2] = 'ellipsis-end'
      }
    }

    return pages
  }

  return (
    <div className="flex items-center justify-between mt-2">
      {/* Left: row info */}
      <div className="text-muted-foreground text-sm">
        {rowSelectionConfig && selectedCount > 0 ? (
          <span>
            <strong>{selectedCount.toLocaleString()}</strong> of{' '}
            <strong>{totalCount.toLocaleString()}</strong> item(s) selected.
          </span>
        ) : (
          <span>
            {table.getRowModel().rows.length} of {totalCount.toLocaleString()} row(s) shown.
          </span>
        )}
      </div>

      {/* Right: page size + pagination controls */}
      <div className="flex items-center gap-4 py-2">
        {pageSizeOptions && pageSizeOptions.length > 0 && (
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium text-muted-foreground">Rows per page</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger className="h-8 w-17.5">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeOptions.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Pagination className="w-auto mx-0">
          <PaginationContent>
            {/* First page */}
            <PaginationItem>
              <PaginationFirst
                onClick={() => table.setPageIndex(0)}
                aria-disabled={!table.getCanPreviousPage()}
                className={!table.getCanPreviousPage() ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>

            {/* Previous page */}
            <PaginationItem>
              <PaginationPrevious
                onClick={() => table.previousPage()}
                aria-disabled={!table.getCanPreviousPage()}
                className={!table.getCanPreviousPage() ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>

            {/* Page number window */}
            {getPageWindow().map((page) => {
              if (page === 'ellipsis-start' || page === 'ellipsis-end') {
                return (
                  <PaginationItem key={page}>
                    <PaginationEllipsis />
                  </PaginationItem>
                )
              }

              return (
                <PaginationItem key={`page-${page}`}>
                  <PaginationLink
                    isActive={currentPage === page}
                    onClick={() => table.setPageIndex(page)}
                  >
                    {page + 1}
                  </PaginationLink>
                </PaginationItem>
              )
            })}

            {/* Next page */}
            <PaginationItem>
              <PaginationNext
                onClick={() => table.nextPage()}
                aria-disabled={!table.getCanNextPage()}
                className={!table.getCanNextPage() ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>

            {/* Last page */}
            <PaginationItem>
              <PaginationLast
                onClick={() => table.setPageIndex(pageCount - 1)}
                aria-disabled={!table.getCanNextPage()}
                className={!table.getCanNextPage() ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
