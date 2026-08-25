import { useCallback, useState, type ReactNode } from 'react'

import { AdvancedDataTable } from '@/shared/components/ui/table'
import type { DataTableProps } from '@/shared/components/ui/table'

import { shouldRenderEmptyState } from './empty-state'
import { useSavedFilters } from './use-saved-filters'

export interface AppDataTableProps<TData, TValue> extends DataTableProps<TData, TValue> {
  /**
   * Rendered instead of the table when the dataset is genuinely empty.
   *
   * Composed here rather than inside the registry table, which hardcodes a
   * "No results." cell. Anything expressible by wrapping belongs in this layer:
   * a registry refresh cannot take it away.
   */
  emptyState?: ReactNode
}

/**
 * The app's table.
 *
 * Pages import this, never `ui/table` directly (enforced by the
 * `no-restricted-imports` boundary in eslint.config.js). Everything under
 * `shared/components/ui/` is a pristine mirror of the FractalHive registry and
 * is replaced wholesale on refresh, so app-specific behaviour lives here — and
 * when upstream renames a prop, this file is the single place that adapts.
 */
export function DataTable<TData, TValue>({
  emptyState,
  ...props
}: AppDataTableProps<TData, TValue>) {
  // Persistence for the popover's "Saved Filters" tab. The registry component
  // renders the save UI whether or not anyone is listening, so without these it
  // reports success and stores nothing. A page may still pass its own — a
  // backend-backed implementation would — and those win.
  const saved = useSavedFilters(props.storageKey)

  // The registry table owns the search box but keeps no state for it — it just
  // forwards keystrokes. Mirroring the term here is what lets the empty-state
  // decision below know a search is what emptied the table; without it, typing
  // a term that matches nothing unmounts the table and the search box with it,
  // leaving no way to clear the term.
  const [searchTerm, setSearchTerm] = useState('')
  const { onSearchChange } = props
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value)
      onSearchChange?.(value)
    },
    [onSearchChange],
  )

  const isEmpty = shouldRenderEmptyState({
    hasEmptyState: Boolean(emptyState),
    isTableLoading: Boolean(props.isTableLoading),
    rowCount: props.data.length,
    activeFilterCount: props.tableOptions?.state?.columnFilters?.length ?? 0,
    hasSearchTerm: searchTerm.trim().length > 0,
  })

  if (isEmpty) return <>{emptyState}</>

  return (
    <AdvancedDataTable
      {...props}
      onSearchChange={handleSearchChange}
      savedFilters={props.savedFilters ?? saved.savedFilters}
      onSaveFilter={props.onSaveFilter ?? saved.onSaveFilter}
      onUpdateFilter={props.onUpdateFilter ?? saved.onUpdateFilter}
      onDeleteFilter={props.onDeleteFilter ?? saved.onDeleteFilter}
      onStarFilter={props.onStarFilter ?? saved.onStarFilter}
    />
  )
}
