import { describe, expect, it } from 'vitest'

import { shouldRenderEmptyState } from '../empty-state'

const base = {
  hasEmptyState: true,
  isTableLoading: false,
  rowCount: 0,
  activeFilterCount: 0,
  hasSearchTerm: false,
}

describe('shouldRenderEmptyState', () => {
  it('stands in for the table when the dataset is genuinely empty', () => {
    expect(shouldRenderEmptyState(base)).toBe(true)
  })

  it('defers to the table when the caller supplied no empty state', () => {
    expect(shouldRenderEmptyState({ ...base, hasEmptyState: false })).toBe(false)
  })

  it('defers to the skeleton rows while loading', () => {
    expect(shouldRenderEmptyState({ ...base, isTableLoading: true })).toBe(false)
  })

  it('defers to the table once there are rows', () => {
    expect(shouldRenderEmptyState({ ...base, rowCount: 3 })).toBe(false)
  })

  it('keeps the table — and its toolbar — when a filter is what emptied it', () => {
    // Otherwise the user filters to zero rows and loses the control that would
    // let them filter back.
    expect(shouldRenderEmptyState({ ...base, activeFilterCount: 1 })).toBe(false)
  })

  it('keeps the table — and its toolbar — when a search term is what emptied it', () => {
    // Same trap as a filter, and worse: the search box lives in the toolbar, so
    // replacing the table takes away the only control that can clear the term.
    expect(shouldRenderEmptyState({ ...base, hasSearchTerm: true })).toBe(false)
  })

  it('treats a whitespace-only term as no search at all', () => {
    // The wrapper trims before asking, so " " must still read as genuinely empty.
    expect(shouldRenderEmptyState({ ...base, hasSearchTerm: false })).toBe(true)
  })
})
