/**
 * When the app-level empty state stands in for the table.
 *
 * Split out of the component so it can be tested without a DOM: this repo's
 * test setup is pure-logic (no jsdom / testing-library), and the interesting
 * part here is the decision, not the markup.
 */
export interface EmptyStateInput {
  /** Whether the caller supplied an empty state at all. */
  hasEmptyState: boolean
  isTableLoading: boolean
  rowCount: number
  /** Column filters currently applied — a filtered-to-nothing table is not empty. */
  activeFilterCount: number
  /** Whether the toolbar's search box currently holds a term — same reasoning. */
  hasSearchTerm: boolean
}

export function shouldRenderEmptyState({
  hasEmptyState,
  isTableLoading,
  rowCount,
  activeFilterCount,
  hasSearchTerm,
}: EmptyStateInput): boolean {
  if (!hasEmptyState) return false
  // Skeleton rows are the loading answer; an empty state would flash on every refetch.
  if (isTableLoading) return false
  if (rowCount > 0) return false
  // Replacing the table also removes the toolbar. Doing that to a user who
  // narrowed their way to zero rows strands them with no way to clear it —
  // whether they narrowed with the filter popover or the search box.
  return activeFilterCount === 0 && !hasSearchTerm
}
