import * as React from 'react'

import {
  type ColumnDef,
  type ColumnPinningState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Table as TanStackTable,
  type TableOptions,
  useReactTable,
} from '@tanstack/react-table'
import {
  Filter,
  Columns3,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { AnimatedSearchInput } from '@/shared/components/ui/animated-search-input'

import { TablePagination } from './table-pagination'
import { TableBulkActions } from './table-bulk-actions'
import { TableHeaderRow } from './table-header-row'
import { TableDataRow } from './table-data-row'
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from './table-primitives'
import { IndeterminateCheckbox } from './table-indeterminate-checkbox'
import { TableSkeletonRows } from './table-skeleton'
import { getColumnId, SELECTION_COLUMN_ID } from './table-utils'
import { type DataTableProps, type RowSelectionConfig, type Selection } from './table-types'
import { ColumnManagerPopover } from './table-column-manager'
import { TableFilterPopover } from './table-filter'
import { SortableHeader } from './table-sortable-header'

const AdvancedDataTable = <TData, TValue>({
  columns,
  data,
  tableOptions = {},
  className,
  isTableLoading = false,
  skeletonRowCount = 10,
  tableName,
  searchPlaceholders = ['Search by email', 'Search by name'],
  disableReorderFor = [],
  onColumnOrderChange,
  onSearchChange,
  filters,
  savedFilters,
  onSaveFilter,
  onUpdateFilter,
  onDeleteFilter,
  onStarFilter,
  rowSelection: rowSelectionConfig,
  pageSizeOptions = [10, 20, 30, 50],
  tableHeight,
  storageKey,
  onColumnPinningChange,
  onRowClick,
  emptyState,
}: DataTableProps<TData, TValue>) => {
  // ─── Selection state (select-all with exceptions pattern) ──────────────
  const [uncontrolledSelection, setUncontrolledSelection] = React.useState<Selection>({
    mode: 'include',
    ids: new Set(),
  })

  // ─── Scroll state for sticky column shadow ──────────────────────────────
  const [isScrolled, setIsScrolled] = React.useState(false)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const handleTableScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled((e.currentTarget as HTMLDivElement).scrollLeft > 0)
  }, [])

  const selection = rowSelectionConfig?.selection ?? uncontrolledSelection
  const totalCount = rowSelectionConfig?.totalCount ?? data.length

  const getRowKey = React.useCallback(
    (row: TData, index: number): string => {
      if (rowSelectionConfig?.getRowId) {
        return rowSelectionConfig.getRowId(row, index)
      }
      if (typeof row === 'object' && row !== null && 'id' in row) {
        const rowWithId = row as Record<string, unknown>
        if (rowWithId.id !== undefined && rowWithId.id !== null && rowWithId.id !== '') {
          return String(rowWithId.id)
        }
      }
      return String(index)
    },
    [rowSelectionConfig],
  )

  const isRowSelected = React.useCallback(
    (rowId: string) => {
      return selection.mode === 'include' ? selection.ids.has(rowId) : !selection.ids.has(rowId)
    },
    [selection],
  )

  // ─── Drag state ───────────────────────────────────────────────────────────
  const [isAnyDragging, setIsAnyDragging] = React.useState(false)

  // ─── Selection column & helper actions ─────────────────────────────────
  const tableRef = React.useRef<TanStackTable<TData> | null>(null)

  const updateSelection = React.useCallback(
    (updater: Selection | ((prev: Selection) => Selection)) => {
      if (!rowSelectionConfig?.selection) {
        setUncontrolledSelection((prev) =>
          typeof updater === 'function' ? updater(prev) : updater,
        )
      }
      if (rowSelectionConfig?.onSelectionChange) {
        const currentSel = rowSelectionConfig.selection ?? uncontrolledSelection
        const nextSel = typeof updater === 'function' ? updater(currentSel) : updater
        const rows = tableRef.current?.getRowModel().rows ?? []
        const selectedPageRows = rows
          .filter((r) => {
            const key = getRowKey(r.original, r.index)
            return nextSel.mode === 'include' ? nextSel.ids.has(key) : !nextSel.ids.has(key)
          })
          .map((r) => r.original)
        rowSelectionConfig.onSelectionChange(nextSel, selectedPageRows)
      }
    },
    [rowSelectionConfig, uncontrolledSelection, getRowKey],
  )

  const selectionColumn = React.useMemo<ColumnDef<TData, TValue> | null>(() => {
    if (!rowSelectionConfig) return null
    return {
      id: SELECTION_COLUMN_ID,
      enableSorting: false,
      enableHiding: false,
      header: () => null,
      cell: ({ row }) => {
        const rowId = getRowKey(row.original, row.index)
        const checked = isRowSelected(rowId)
        return (
          <IndeterminateCheckbox
            checked={checked}
            onChange={() => {
              updateSelection((prev) => {
                const nextIds = new Set(prev.ids)
                if (nextIds.has(rowId)) {
                  nextIds.delete(rowId)
                } else {
                  nextIds.add(rowId)
                }
                return { ...prev, ids: nextIds }
              })
            }}
            aria-label={`Select row ${rowId}`}
          />
        )
      },
    } as ColumnDef<TData, TValue>
  }, [rowSelectionConfig, getRowKey, isRowSelected, updateSelection])

  // ─── Column order tracking ────────────────────────────────────────────────
  const resolvedColumns = React.useMemo<ColumnDef<TData, TValue>[]>(
    () => (selectionColumn ? [selectionColumn, ...columns] : columns),
    [selectionColumn, columns],
  )

  const defaultColumnOrder = React.useMemo(
    () => resolvedColumns.map((col, index) => getColumnId(col, index)),
    [resolvedColumns],
  )

  // ─── Column order & pinning localStorage persistence ──────────────────────
  const effectiveStorageKey = React.useMemo(() => {
    if (storageKey) return storageKey
    if (tableName) return `fh_table_${tableName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    return 'fh_table_default'
  }, [storageKey, tableName])

  const [columnOrder, setColumnOrder] = React.useState<string[]>(() => {
    let initial = defaultColumnOrder
    if (effectiveStorageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(effectiveStorageKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed.columnOrder)) {
            const stillValid = parsed.columnOrder.filter((id: string) =>
              defaultColumnOrder.includes(id),
            )
            const missing = defaultColumnOrder.filter((id: string) => !stillValid.includes(id))
            initial = [...stillValid, ...missing]
          }
        }
      } catch {
        // Ignore JSON errors
      }
    }
    return initial
  })

  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(() => {
    if (effectiveStorageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(effectiveStorageKey)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.columnPinning && typeof parsed.columnPinning === 'object') {
            return parsed.columnPinning
          }
        }
      } catch {
        // Ignore JSON errors
      }
    }
    return tableOptions.state?.columnPinning ?? { left: [], right: [] }
  })

  React.useEffect(() => {
    setColumnOrder((prev) => {
      const stillValid = prev.filter((id) => defaultColumnOrder.includes(id))
      const missing = defaultColumnOrder.filter((id) => !stillValid.includes(id))
      return [...stillValid, ...missing]
    })
  }, [defaultColumnOrder])

  React.useEffect(() => {
    if (!effectiveStorageKey || typeof window === 'undefined') return
    try {
      localStorage.setItem(effectiveStorageKey, JSON.stringify({ columnOrder, columnPinning }))
    } catch (e) {
      console.warn('Failed to save table settings to localStorage:', e)
    }
  }, [effectiveStorageKey, columnOrder, columnPinning])

  // ─── Table instance ───────────────────────────────────────────────────────
  const table = useReactTable({
    data,
    columns: resolvedColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    onColumnOrderChange: (updater) => {
      const nextOrder = typeof updater === 'function' ? updater(columnOrder) : updater
      setColumnOrder(nextOrder)
      onColumnOrderChange?.(nextOrder)
    },
    onColumnPinningChange: (updater) => {
      const nextPinning = typeof updater === 'function' ? updater(columnPinning) : updater
      setColumnPinning(nextPinning)
      onColumnPinningChange?.(nextPinning)
    },
    ...(rowSelectionConfig && {
      enableRowSelection: true,
    }),
    ...tableOptions,
    state: {
      columnOrder,
      columnPinning,
      ...tableOptions.state,
    },
  })
  tableRef.current = table

  // ─── Current page rows & page selection status ───────────────────────────
  const currentPageRows = table.getRowModel().rows
  const currentPageKeys = React.useMemo(
    () => currentPageRows.map((r) => getRowKey(r.original, r.index)),
    [currentPageRows, getRowKey],
  )

  const isAllPageSelected = React.useMemo(() => {
    if (currentPageKeys.length === 0) return false
    return currentPageKeys.every((key) => isRowSelected(key))
  }, [currentPageKeys, isRowSelected])

  const isSomePageSelected = React.useMemo(() => {
    if (currentPageKeys.length === 0) return false
    const selectedOnPageCount = currentPageKeys.filter((key) => isRowSelected(key)).length
    return selectedOnPageCount > 0 && selectedOnPageCount < currentPageKeys.length
  }, [currentPageKeys, isRowSelected])

  const selectedCount = React.useMemo(() => {
    if (selection.mode === 'include') {
      return selection.ids.size
    } else {
      return Math.max(0, totalCount - selection.ids.size)
    }
  }, [selection, totalCount])

  const toggleAllPageRows = React.useCallback(() => {
    updateSelection((prev) => {
      const nextIds = new Set(prev.ids)
      if (prev.mode === 'include') {
        if (isAllPageSelected) {
          currentPageKeys.forEach((key) => nextIds.delete(key))
        } else {
          currentPageKeys.forEach((key) => nextIds.add(key))
        }
      } else {
        if (isAllPageSelected) {
          currentPageKeys.forEach((key) => nextIds.add(key))
        } else {
          currentPageKeys.forEach((key) => nextIds.delete(key))
        }
      }
      return { ...prev, ids: nextIds }
    })
  }, [updateSelection, isAllPageSelected, currentPageKeys])

  const selectAllMatchingFilters = React.useCallback(() => {
    updateSelection({ mode: 'exclude', ids: new Set() })
  }, [updateSelection])

  const clearSelection = React.useCallback(() => {
    updateSelection({ mode: 'include', ids: new Set() })
  }, [updateSelection])

  const getSelectedPageRows = React.useCallback(() => {
    return currentPageRows
      .filter((r) => isRowSelected(getRowKey(r.original, r.index)))
      .map((r) => r.original)
  }, [currentPageRows, isRowSelected, getRowKey])

  const handleReorder = React.useCallback(
    (nextOrder: string[]) => {
      setColumnOrder(nextOrder)
      onColumnOrderChange?.(nextOrder)
    },
    [onColumnOrderChange],
  )

  const totalCols = table.getAllColumns().length

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={cn('space-y-4 relative w-full h-full', className)}>
      <div className="rounded-[40px] shadow px-3 py-2 bg-fh-gray-50 border border-[#DDE1E5]">
        <div>
          {/* Toolbar */}
          <div className="py-3 px-3 flex justify-between items-center">
            <p className="font-bold">{tableName}</p>
            <div className="flex gap-2 items-center">
              <AnimatedSearchInput
                placeholders={searchPlaceholders}
                onChange={(e: { target: { value: string } }) => onSearchChange?.(e.target.value)}
              />

              {filters && filters.length > 0 && (
                <TableFilterPopover
                  table={table}
                  filters={filters || []}
                  savedFilters={savedFilters}
                  onSaveFilter={onSaveFilter}
                  onUpdateFilter={onUpdateFilter}
                  onDeleteFilter={onDeleteFilter}
                  onStarFilter={onStarFilter}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Filter"
                    className="bg-white"
                  >
                    <Filter className="size-5" strokeWidth={1.5} />
                  </Button>
                </TableFilterPopover>
              )}
              <ColumnManagerPopover
                table={table}
                columnOrder={columnOrder}
                onColumnOrderChange={handleReorder}
                defaultColumnOrder={defaultColumnOrder}
                excludeColumns={[SELECTION_COLUMN_ID]}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Manage columns"
                  className="bg-white"
                >
                  <Columns3 className="size-5" strokeWidth={1.5} />
                </Button>
              </ColumnManagerPopover>
            </div>
          </div>

          {/* Table wrapper */}
          <div className="rounded-[1.75rem] p-3 bg-white">
            <TableBulkActions
              rowSelectionConfig={rowSelectionConfig}
              selectedCount={selectedCount}
              totalCount={totalCount}
              selection={selection}
              currentPageRowsCount={currentPageRows.length}
              isAllPageSelected={isAllPageSelected}
              selectAllMatchingFilters={selectAllMatchingFilters}
              clearSelection={clearSelection}
              getSelectedPageRows={getSelectedPageRows}
            />

            <div className="rounded-2xl overflow-hidden relative">
              <Table
                containerStyle={{ height: tableHeight }}
                scrollContainerRef={scrollContainerRef}
                onScrollContainer={handleTableScroll}
              >
                {/* ── Header ──────────────────────────────────────────────── */}
                <TableHeader className="sticky top-0 z-20 bg-fh-primary-50 rounded-t-2xl">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableHeaderRow
                      key={headerGroup.id}
                      headerGroup={headerGroup}
                      isAllPageSelected={isAllPageSelected}
                      isSomePageSelected={isSomePageSelected}
                      toggleAllPageRows={toggleAllPageRows}
                      columnOrder={columnOrder}
                      handleReorder={handleReorder}
                      disableReorderFor={disableReorderFor}
                      isAnyDragging={isAnyDragging}
                      setIsAnyDragging={setIsAnyDragging}
                      isScrolled={isScrolled}
                    />
                  ))}
                </TableHeader>

                {/* ── Body ────────────────────────────────────────────────── */}
                <TableBody>
                  {isTableLoading ? (
                    <TableSkeletonRows
                      table={table}
                      skeletonRowCount={skeletonRowCount}
                      isScrolled={isScrolled}
                    />
                  ) : table.getRowModel().rows?.length ? (
                    table
                      .getRowModel()
                      .rows.map((row) => (
                        <TableDataRow
                          key={row.id}
                          row={row}
                          getRowKey={getRowKey}
                          isRowSelected={isRowSelected}
                          isScrolled={isScrolled}
                          onRowClick={onRowClick}
                        />
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={totalCols} className="h-24 text-center">
                        {emptyState ?? 'No results.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        <TablePagination
          table={table}
          pageSizeOptions={pageSizeOptions}
          rowSelectionConfig={rowSelectionConfig}
          selectedCount={selectedCount}
          totalCount={totalCount}
        />
      </div>
    </div>
  )
}

interface DataTableDefProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  tableOptions?: Omit<TableOptions<TData>, 'data' | 'columns' | 'getCoreRowModel'>
  className?: string
  isHiddenPagination?: boolean
  totalRows?: number
}

function DataTable<TData, TValue>({
  columns,
  data,
  tableOptions = {},
  className,
  isHiddenPagination = false,
  totalRows,
}: DataTableDefProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    ...tableOptions,
  })

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? (
                        <span className="text-muted-foreground text-xs font-normal">Column</span>
                      ) : (
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
                          {flexRender(header.column.columnDef.header, header.getContext()) || (
                            <span className="text-muted-foreground text-xs font-normal">
                              Column
                            </span>
                          )}
                        </SortableHeader>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isHiddenPagination && (
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            {tableOptions.enableRowSelection && (
              <>
                {table.getFilteredSelectedRowModel().rows.length} of{' '}
                {table.getFilteredRowModel().rows.length} row(s) selected.
              </>
            )}
            <div>
              Showing {table.getRowModel().rows.length} of{' '}
              {totalRows ?? table.getFilteredRowModel().rows.length} row(s).
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="Go to first page"
            >
              <ChevronsLeft className="size-4" />
              <span className="sr-only">Go to first page</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Go to previous page</span>
            </Button>
            <div className="flex items-center gap-1 text-sm">
              <div>Page</div>
              <strong>
                {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
              </strong>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Go to next page"
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">Go to next page</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Go to last page"
            >
              <ChevronsRight className="size-4" />
              <span className="sr-only">Go to last page</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
export {
  AdvancedDataTable,
  type DataTableProps,
  type RowSelectionConfig,
  type ColumnDef,
  DataTable,
}
