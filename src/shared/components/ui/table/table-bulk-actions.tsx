import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MoreVertical } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu'
import { type Selection, type RowSelectionConfig } from './table-types'

export interface TableBulkActionsProps<TData> {
  rowSelectionConfig?: RowSelectionConfig<TData>
  selectedCount: number
  totalCount: number
  selection: Selection
  currentPageRowsCount: number
  isAllPageSelected: boolean
  selectAllMatchingFilters: () => void
  clearSelection: () => void
  getSelectedPageRows: () => TData[]
}

export function TableBulkActions<TData>({
  rowSelectionConfig,
  selectedCount,
  totalCount,
  selection,
  currentPageRowsCount,
  isAllPageSelected,
  selectAllMatchingFilters,
  clearSelection,
  getSelectedPageRows,
}: TableBulkActionsProps<TData>) {
  if (!rowSelectionConfig) return null

  const maxVisibleActions = rowSelectionConfig.maxVisibleActions ?? 2
  const bulkActions = rowSelectionConfig.actions ?? []
  const visibleActions = bulkActions.slice(0, maxVisibleActions)
  const overflowActions = bulkActions.slice(maxVisibleActions)

  return (
    <AnimatePresence mode="wait">
      {selectedCount > 0 && (
        <motion.div
          key="active-selection-banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-3 flex items-center justify-between rounded-2xl bg-[#D9E6F2] px-4 py-2.5 text-sm text-[#14181D]"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {selection.mode === 'include' &&
            isAllPageSelected &&
            totalCount > currentPageRowsCount ? (
              <span>
                All <strong>{currentPageRowsCount}</strong> items on this page are selected.
                <button
                  type="button"
                  onClick={selectAllMatchingFilters}
                  className="font-medium text-primary underline hover:text-primary/80 transition-colors ml-1 cursor-pointer"
                >
                  Select all {totalCount.toLocaleString()} items matching current filters
                </button>
              </span>
            ) : (
              <span>
                <strong>{selectedCount.toLocaleString()}</strong> Selected{' '}
                {selection.mode === 'exclude' ? '(with selected filters)' : ''}
              </span>
            )}
            <span className="text-muted-foreground">•</span>
            <button
              type="button"
              onClick={clearSelection}
              className="font-medium text-primary underline hover:text-primary/80 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>

          {bulkActions.length > 0 && (
            <div className="flex items-center gap-2">
              {visibleActions.map((action) => {
                const isElement = React.isValidElement(action.icon)
                const IconComponent =
                  !isElement && action.icon ? (action.icon as React.ElementType) : null
                return (
                  <Button
                    key={action.id}
                    type="button"
                    size="sm"
                    variant={action.variant ?? 'secondary'}
                    disabled={action.disabled}
                    onClick={() => action.onClick(selection, getSelectedPageRows())}
                    // className="rounded-xl text-xs flex items-center gap-1.5"
                  >
                    {IconComponent ? (
                      <IconComponent className="size-3.5" />
                    ) : (
                      (action.icon as React.ReactNode)
                    )}
                    <span>{action.label}</span>
                  </Button>
                )
              })}

              {overflowActions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      aria-label="More bulk actions"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {overflowActions.map((action) => {
                      const isElement = React.isValidElement(action.icon)
                      const IconComponent =
                        !isElement && action.icon ? (action.icon as React.ElementType) : null
                      return (
                        <DropdownMenuItem
                          key={action.id}
                          disabled={action.disabled}
                          onClick={() => action.onClick(selection, getSelectedPageRows())}
                          className="flex items-center gap-2 cursor-pointer text-xs"
                        >
                          {IconComponent ? (
                            <IconComponent className="size-3.5" />
                          ) : (
                            (action.icon as React.ReactNode)
                          )}
                          <span>{action.label}</span>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
