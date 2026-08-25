import * as React from 'react'

import type { SavedFilter } from '@/shared/components/ui/table/table-types'

import { parseSavedFilters, serializeSavedFilters } from './saved-filter-storage'

/**
 * Persistence for the filter popover's "Saved Filters" tab.
 *
 * The registry popover is bring-your-own-storage: it renders the save UI
 * unconditionally but owns nothing, so with no handlers wired a user types a
 * name, clicks Save, `onSaveFilter?.()` no-ops, and the tab switches to an empty
 * "No saved filters yet" — looking like it worked. This supplies the five props
 * the popover expects.
 *
 * localStorage, keyed off the table's own `storageKey`, which is already the
 * stable per-table identity used for column layout. Swapping this for API calls
 * later means changing this file and nothing else — the wrapper and the pages
 * do not know where the filters live.
 */
export interface SavedFilterHandlers {
  savedFilters: SavedFilter[]
  onSaveFilter: (filter: SavedFilter) => void
  onUpdateFilter: (filter: SavedFilter) => void
  onDeleteFilter: (id: string) => void
  onStarFilter: (id: string, starred: boolean) => void
}

const bucketFor = (storageKey: string) => `${storageKey}:filters`

function read(storageKey: string | undefined): SavedFilter[] {
  if (!storageKey || typeof window === 'undefined') return []
  try {
    return parseSavedFilters(window.localStorage.getItem(bucketFor(storageKey)))
  } catch {
    // Private-mode Safari and friends throw on access, not just on write.
    return []
  }
}

export function useSavedFilters(storageKey?: string): SavedFilterHandlers {
  const [savedFilters, setSavedFilters] = React.useState<SavedFilter[]>(() => read(storageKey))

  // A different table means a different bucket; without this, navigating from
  // Tasks to Party Onboarding would show the Tasks filters until a write.
  // Adjusted during render rather than in an effect — React's documented
  // pattern for state derived from a prop — so no frame is ever painted with
  // the previous table's filters.
  const [loadedKey, setLoadedKey] = React.useState(storageKey)
  if (loadedKey !== storageKey) {
    setLoadedKey(storageKey)
    setSavedFilters(read(storageKey))
  }

  /**
   * Persisted from an effect, matching how the table already stores its column
   * layout — and keeping the state updaters pure, which React requires: an
   * updater that writes to localStorage runs twice under StrictMode.
   */
  React.useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(bucketFor(storageKey), serializeSavedFilters(savedFilters))
    } catch (error) {
      // Out of quota, or storage disabled: the filters still work for this
      // session, they just will not survive a reload.
      console.warn('Failed to persist saved filters:', error)
    }
  }, [storageKey, savedFilters])

  const commit = React.useCallback(
    (next: (previous: SavedFilter[]) => SavedFilter[]) => setSavedFilters(next),
    [],
  )

  const onSaveFilter = React.useCallback(
    (filter: SavedFilter) => commit((previous) => [...previous, filter]),
    [commit],
  )

  const onUpdateFilter = React.useCallback(
    (filter: SavedFilter) =>
      commit((previous) => previous.map((entry) => (entry.id === filter.id ? filter : entry))),
    [commit],
  )

  const onDeleteFilter = React.useCallback(
    (id: string) => commit((previous) => previous.filter((entry) => entry.id !== id)),
    [commit],
  )

  const onStarFilter = React.useCallback(
    (id: string, starred: boolean) =>
      commit((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, starred } : entry)),
      ),
    [commit],
  )

  return { savedFilters, onSaveFilter, onUpdateFilter, onDeleteFilter, onStarFilter }
}
