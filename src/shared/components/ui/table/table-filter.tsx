/* eslint-disable react-hooks/set-state-in-effect -- the popover seeds its draft state from the table when it opens; this repo's ruleset is stricter than the registry's. */
import * as React from 'react'
import { type Table } from '@tanstack/react-table'
import {
  Plus,
  MoreVertical,
  Star,
  Pencil,
  Trash2,
  ChevronRight,
  RotateCcw,
  Loader2,
} from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/shared/components/ui/sheet'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

import { type FilterConfig, type FilterValue, type SavedFilter } from './table-types'
import {
  buildFilterSummary,
  countActiveConditions,
  conditionsFromTable,
  isSavedFilterActive,
} from './table-filter-helpers'
import {
  SelectFilterPanel,
  TextFilterPanel,
  NumberFilterPanel,
  DateFilterPanel,
  DateRangeFilterPanel,
} from './table-filter-panels'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TableFilterPopoverProps<TData = unknown> {
  table: Table<TData>
  filters: FilterConfig[]
  children: React.ReactNode
  savedFilters?: SavedFilter[]
  onSaveFilter?: (filter: SavedFilter) => void
  onUpdateFilter?: (filter: SavedFilter) => void
  onDeleteFilter?: (id: string) => void
  onStarFilter?: (id: string, starred: boolean) => void
}

export type TableFilterDrawerProps<TData = unknown> = TableFilterPopoverProps<TData>

type ActiveTab = 'saved' | 'columns'

// ─── Main Component ───────────────────────────────────────────────────────────

export function TableFilterPopover<TData>({
  table,
  filters,
  children,
  savedFilters = [],
  onSaveFilter,
  onUpdateFilter,
  onDeleteFilter,
  onStarFilter,
}: TableFilterPopoverProps<TData>) {
  // Sheet open state
  const [isOpen, setIsOpen] = React.useState(false)

  // Tab state
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('saved')

  // Active column filter being configured
  const [activeFilterId, setActiveFilterId] = React.useState<string>(filters?.[0]?.id || '')

  // Pending filter conditions (local state before applying)
  const [pendingConditions, setPendingConditions] = React.useState<Record<string, FilterValue>>({})

  // Editing a saved filter
  const [editingFilter, setEditingFilter] = React.useState<SavedFilter | null>(null)

  // Save filter popover state
  const [showSavePopover, setShowSavePopover] = React.useState(false)
  const [saveFilterName, setSaveFilterName] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  // Selected saved filter ID
  const [selectedSavedFilterId, setSelectedSavedFilterId] = React.useState<string | null>(null)

  // Initialize pending conditions when drawer opens
  React.useEffect(() => {
    if (isOpen) {
      const initialConditions = conditionsFromTable(table, filters)
      setPendingConditions(initialConditions)
      setActiveTab('saved')
      setEditingFilter(null)
      setShowSavePopover(false)
      setSaveFilterName('')
      if (filters.length > 0 && !filters.find((f) => f.id === activeFilterId)) {
        setActiveFilterId(filters[0].id)
      }
      const match = savedFilters.find((sf) => isSavedFilterActive(sf, initialConditions, filters))
      setSelectedSavedFilterId(match ? match.id : null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const activeFilterConfig = filters.find((f) => f.id === activeFilterId)

  // Count active applied filters on the table
  const activeTableFiltersCount = filters.reduce((acc, f) => {
    const val = table.getColumn(f.id)?.getFilterValue()
    if (!val) return acc
    if (Array.isArray(val)) return acc + (val.length > 0 ? 1 : 0)
    return acc + 1
  }, 0)

  // Count pending conditions
  const pendingCount = countActiveConditions(pendingConditions)

  // ── Handlers ──

  const updateCondition = (colId: string, value: FilterValue | undefined) => {
    setPendingConditions((prev) => {
      if (value === undefined) {
        const next = { ...prev }
        delete next[colId]
        return next
      }
      return { ...prev, [colId]: value }
    })
  }

  const handleApply = () => {
    filters.forEach((f) => {
      const col = table.getColumn(f.id)
      if (!col) return
      const val = pendingConditions[f.id]
      if (val === undefined) {
        col.setFilterValue(undefined)
      } else if (Array.isArray(val) && val.length === 0) {
        col.setFilterValue(undefined)
      } else {
        col.setFilterValue(val)
      }
    })
    setIsOpen(false)
    setEditingFilter(null)
  }

  const handleApplyOnly = () => {
    handleApply()
  }

  const handleApplyAndSave = async () => {
    if (!editingFilter || isSaving) return
    setIsSaving(true)
    try {
      const updated: SavedFilter = {
        ...editingFilter,
        conditions: { ...pendingConditions },
      }
      await onUpdateFilter?.(updated)
      handleApply()
    } catch (err: unknown) {
      console.error('Failed to update filter', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setPendingConditions({})
    filters.forEach((f) => table.getColumn(f.id)?.setFilterValue(undefined))
    setEditingFilter(null)
  }

  const handleSaveNew = async () => {
    if (!saveFilterName.trim() || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const newId = `filter-${Date.now()}`
      const newFilter: SavedFilter = {
        id: newId,
        name: saveFilterName.trim(),
        starred: false,
        conditions: { ...pendingConditions },
        createdAt: new Date().toISOString(),
      }
      await onSaveFilter?.(newFilter)
      setShowSavePopover(false)
      setSaveFilterName('')
      setSelectedSavedFilterId(newId)
      setActiveTab('saved')
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to save filter. Please try again.'
      setSaveError(errorMsg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditSavedFilter = (sf: SavedFilter) => {
    setEditingFilter(sf)
    setPendingConditions({ ...sf.conditions })
    setActiveTab('columns')
    const firstConditionId = Object.keys(sf.conditions)[0] ?? filters[0]?.id
    if (firstConditionId) setActiveFilterId(firstConditionId)
  }

  const handleSelectSavedFilter = (sf: SavedFilter) => {
    setSelectedSavedFilterId(sf.id)
    filters.forEach((f) => {
      const col = table.getColumn(f.id)
      if (!col) return
      const val = sf.conditions[f.id]
      col.setFilterValue(val ?? undefined)
    })
    setPendingConditions({ ...sf.conditions })
    setIsOpen(false)
  }

  // Sorted saved filters (starred first)
  const sortedSavedFilters = [...savedFilters].sort((a, b) => {
    if (a.starred && !b.starred) return -1
    if (!a.starred && b.starred) return 1
    return 0
  })

  const filterSummary = buildFilterSummary(filters, pendingConditions)

  if (!filters || filters.length === 0) {
    return <>{children}</>
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <div className="relative inline-flex cursor-pointer">
          {children}
          {activeTableFiltersCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground border-2 border-background shadow-sm">
              {activeTableFiltersCount}
            </span>
          )}
        </div>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full! max-w-195! p-0 flex flex-col gap-0 border-r shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="p-0 border-b shrink-0">
          <div className="flex items-center justify-between px-4 py-3 pr-12">
            <div className="flex items-center gap-2">
              <SheetTitle className="font-semibold text-[#14181D] text-base">Filters</SheetTitle>
              {activeTableFiltersCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1B2B48] text-[11px] font-bold text-white px-1">
                  {activeTableFiltersCount}
                </span>
              )}
              {activeTableFiltersCount > 0 && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium"
                  onClick={handleReset}
                >
                  <RotateCcw className="size-3" />
                  Reset All
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 pb-3">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
              <TabsList>
                <TabsTrigger value="saved">Saved Filters</TabsTrigger>
                <TabsTrigger value="columns">Columns</TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === 'columns' && pendingCount > 0 && (
              <Popover
                open={showSavePopover}
                onOpenChange={(open) => {
                  setShowSavePopover(open)
                  if (!open) setSaveError(null)
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[13px] text-[#1B2B48] font-semibold hover:opacity-80 transition-opacity"
                  >
                    <Plus className="size-3.5" />
                    Save Filters
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 shadow-xl" align="end" side="bottom">
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-semibold text-[#14181D]">Filter Name</p>
                    <Input
                      placeholder="e.g. Last 7 days – Login Actions"
                      value={saveFilterName}
                      onChange={(e) => {
                        setSaveFilterName(e.target.value)
                        if (saveError) setSaveError(null)
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveNew()}
                      className="h-9"
                      disabled={isSaving}
                      autoFocus
                    />
                    {saveError ? (
                      <p className="text-xs text-destructive font-medium">{saveError}</p>
                    ) : filterSummary ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Saves: {filterSummary}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSaving}
                        onClick={() => {
                          setShowSavePopover(false)
                          setSaveError(null)
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveNew}
                        disabled={!saveFilterName.trim() || isSaving}
                        className="bg-[#1B2B48] hover:bg-[#1B2B48]/90 min-w-16"
                      >
                        {isSaving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : 'Save'}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <SheetDescription className="sr-only">Filter table data by options</SheetDescription>
        </SheetHeader>

        {/* Editing Banner */}
        {editingFilter && activeTab === 'columns' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
            <Pencil className="size-3.5 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">
              Editing: {editingFilter.name}
            </span>
          </div>
        )}

        {/* Body */}
        {activeTab === 'saved' ? (
          /* Saved Filters Tab */
          <div className="flex-1 overflow-y-auto">
            {sortedSavedFilters.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center px-8">
                <div className="rounded-full bg-muted/30 p-4 mb-3">
                  <Star className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-[#14181D] mb-1">No saved filters yet</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Configure filters in the Columns tab and save them for quick access later.
                </p>
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Saved Filters
                </p>
                {sortedSavedFilters.map((sf) => {
                  const colNames = Object.keys(sf.conditions)
                    .map((id) => filters.find((f) => f.id === id)?.label)
                    .filter(Boolean)
                    .join(', ')
                  const isSelected = sf.id === selectedSavedFilterId

                  return (
                    <div
                      key={sf.id}
                      onClick={() => handleSelectSavedFilter(sf)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors',
                        isSelected
                          ? 'border-[#1B2B48] bg-[#D9E6F2]/30'
                          : 'border-border bg-background hover:bg-muted/20',
                      )}
                    >
                      {/* Radio select */}
                      <button
                        type="button"
                        aria-label={`Select ${sf.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectSavedFilter(sf)
                        }}
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                          isSelected
                            ? 'bg-[#1B2B48] border-[#1B2B48]'
                            : 'border-muted-foreground/40 bg-transparent hover:border-[#1B2B48]',
                        )}
                      >
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#14181D] truncate">{sf.name}</p>
                        {colNames && (
                          <p className="text-xs text-muted-foreground truncate">{colNames}</p>
                        )}
                      </div>

                      {/* Star */}
                      {sf.starred && (
                        <Star className="size-4 text-amber-400 fill-amber-400 shrink-0" />
                      )}

                      {/* 3-dot menu */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted/50 transition-colors shrink-0"
                            >
                              <MoreVertical className="size-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => handleEditSavedFilter(sf)}
                              className="gap-2"
                            >
                              <Pencil className="size-3.5" />
                              Configure Filters
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onStarFilter?.(sf.id, !sf.starred)}
                              className="gap-2"
                            >
                              <Star className="size-3.5" />
                              {sf.starred ? 'Unstar' : 'Star'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (selectedSavedFilterId === sf.id) {
                                  setSelectedSavedFilterId(null)
                                }
                                onDeleteFilter?.(sf.id)
                              }}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Columns Tab (Filter Builder) */
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left Sidebar */}
            <div className="w-62.5 border-r border-border/50 p-2 flex flex-col gap-0.5 overflow-y-auto shrink-0 bg-muted/10">
              {filters.map((filter) => {
                const isSelected = activeFilterId === filter.id
                const val = pendingConditions[filter.id]
                let count = 0
                if (val !== undefined && val !== null) {
                  if (filter.filterType === 'select' && Array.isArray(val)) {
                    count = val.length
                  } else if (Array.isArray(val)) {
                    count = val.some((v) => v !== null && v !== undefined) ? 1 : 0
                  } else if (typeof val === 'string') {
                    count = val.trim() ? 1 : 0
                  } else {
                    count = 1
                  }
                }

                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => {
                      setActiveFilterId(filter.id)
                    }}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left',
                      isSelected
                        ? 'bg-[#D9E6F2] text-[#14181D]'
                        : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                    )}
                  >
                    <span className="truncate">{filter.label}</span>
                    <div className="ml-2 flex items-center gap-1.5 shrink-0">
                      {count > 0 && (
                        <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#1B2B48] text-[10px] text-white font-medium">
                          {count}
                        </span>
                      )}
                      {isSelected && <ChevronRight className="size-3.5 shrink-0 text-[#1B2B48]" />}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Right Panel */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden min-w-0 bg-white!">
              {activeFilterConfig ? (
                (() => {
                  const currentVal = pendingConditions[activeFilterConfig.id]

                  if (
                    activeFilterConfig.filterType === 'select' ||
                    activeFilterConfig.filterType === 'singleSelect'
                  ) {
                    const isMulti =
                      activeFilterConfig.filterType === 'select' &&
                      activeFilterConfig.isMulti !== false

                    const currentSelected: string[] = Array.isArray(currentVal)
                      ? currentVal.filter((v): v is string => typeof v === 'string')
                      : typeof currentVal === 'string' && currentVal.trim()
                        ? [currentVal]
                        : []

                    return (
                      <SelectFilterPanel
                        label={activeFilterConfig.label}
                        options={activeFilterConfig.options}
                        selected={currentSelected}
                        isMulti={isMulti}
                        onToggle={(value) => {
                          if (isMulti) {
                            if (currentSelected.includes(value)) {
                              const next = currentSelected.filter((v) => v !== value)
                              updateCondition(
                                activeFilterConfig.id,
                                next.length > 0 ? next : undefined,
                              )
                            } else {
                              updateCondition(activeFilterConfig.id, [...currentSelected, value])
                            }
                          } else {
                            if (currentSelected.includes(value)) {
                              updateCondition(activeFilterConfig.id, undefined)
                            } else {
                              updateCondition(activeFilterConfig.id, value)
                            }
                          }
                        }}
                        onSelectAll={(values) => {
                          updateCondition(activeFilterConfig.id, values)
                        }}
                        onClearAll={() => {
                          updateCondition(activeFilterConfig.id, undefined)
                        }}
                      />
                    )
                  }

                  if (activeFilterConfig.filterType === 'text') {
                    return (
                      <TextFilterPanel
                        label={activeFilterConfig.label}
                        placeholder={activeFilterConfig.placeholder}
                        value={typeof currentVal === 'string' ? currentVal : ''}
                        onChange={(v) => updateCondition(activeFilterConfig.id, v || undefined)}
                      />
                    )
                  }

                  if (activeFilterConfig.filterType === 'number') {
                    const numVal: [number, number] | undefined =
                      Array.isArray(currentVal) && currentVal.length === 2
                        ? [currentVal[0] as number, currentVal[1] as number]
                        : undefined
                    return (
                      <NumberFilterPanel
                        label={activeFilterConfig.label}
                        value={numVal}
                        onChange={(v) => updateCondition(activeFilterConfig.id, v)}
                        min={activeFilterConfig.min}
                        max={activeFilterConfig.max}
                        step={activeFilterConfig.step}
                        prefix={activeFilterConfig.prefix}
                        suffix={activeFilterConfig.suffix}
                        presets={activeFilterConfig.presets}
                      />
                    )
                  }

                  if (activeFilterConfig.filterType === 'date') {
                    return (
                      <DateFilterPanel
                        label={activeFilterConfig.label}
                        value={currentVal instanceof Date ? currentVal : null}
                        onChange={(d) => updateCondition(activeFilterConfig.id, d ?? undefined)}
                      />
                    )
                  }

                  if (activeFilterConfig.filterType === 'dateRange') {
                    const rangeVal: [Date | null, Date | null] =
                      Array.isArray(currentVal) && currentVal.length === 2
                        ? [currentVal[0] as Date | null, currentVal[1] as Date | null]
                        : [null, null]
                    return (
                      <DateRangeFilterPanel
                        label={activeFilterConfig.label}
                        value={rangeVal}
                        onChange={(v) => {
                          if (!v[0] && !v[1]) {
                            updateCondition(activeFilterConfig.id, undefined)
                          } else {
                            updateCondition(activeFilterConfig.id, v)
                          }
                        }}
                      />
                    )
                  }

                  return null
                })()
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Select a filter to view options
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {activeTab !== 'saved' && (
          <div className="flex items-center justify-end px-4 py-3 border-t shrink-0 bg-background">
            {editingFilter ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditingFilter(null)}>
                  Cancel
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleApplyOnly}>
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#1B2B48] hover:bg-[#1B2B48]/90"
                    onClick={handleApplyAndSave}
                  >
                    Apply & Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-[#1B2B48] hover:bg-[#1B2B48]/90"
                  onClick={handleApply}
                >
                  Apply Filter
                </Button>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export const TableFilterDrawer = TableFilterPopover
