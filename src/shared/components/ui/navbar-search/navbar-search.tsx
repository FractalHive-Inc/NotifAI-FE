/* eslint-disable react-hooks/preserve-manual-memoization -- the tab-completion useMemo cannot be preserved by the React Compiler; vendored as-is. */
/* eslint-disable react-hooks/set-state-in-effect -- the search resets its highlighted index when the result list changes; this repo's ruleset is stricter than the registry's. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Briefcase,
  Building2,
  ChevronRight,
  Database,
  Loader,
  Package,
  Search as SearchIcon,
  User,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { cn } from '@/shared/lib/utils'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/shared/components/ui/input-group'
import { Kbd } from '@/shared/components/ui/kbd'
import { ScrollArea } from '@/shared/components/ui/scroll-area'

import {
  getPlaceholderSuggestions,
  getTagLabel,
  highlightText,
  mapSectionItem,
  type RenderSection,
  type SearchApiSection,
  type SearchListItem,
  SECTION_TITLES,
  type StaticNavItem,
  useIsMacPlatform,
} from './navbar-search-utils'

const LISTBOX_ID = 'navbar-search-listbox'

const DEFAULT_SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DEALS: Briefcase,
  CUSTOMERS: Building2,
  PEOPLE: User,
  MASTER: Database,
  PRODUCTS: Package,
}

export interface SearchResultRowProps {
  item: SearchListItem
  isActive: boolean
  searchTerm: string
  onClick: (item: SearchListItem) => void
  onMouseEnter: (index: number) => void
  customSectionIcons?: Record<string, React.ComponentType<{ className?: string }>>
}

function SearchResultRowBase({
  item,
  isActive,
  searchTerm,
  onClick,
  onMouseEnter,
  customSectionIcons,
}: SearchResultRowProps) {
  const Icon = item.icon || customSectionIcons?.[item.type] || DEFAULT_SECTION_ICONS[item.type]

  return (
    <div
      id={`search-item-${item.globalIndex}`}
      role="option"
      aria-selected={isActive}
      onClick={() => onClick(item)}
      onMouseEnter={() => onMouseEnter(item.globalIndex)}
      className={cn(
        'group flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 transition-all select-none',
        isActive
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-foreground/80 hover:bg-accent/50',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {Icon && (
          <Icon
            className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              'text-sm font-medium',
              isActive ? 'text-foreground' : 'text-foreground/90',
            )}
          >
            {highlightText(item.title, searchTerm)}
          </span>
          {item.subtitle && (
            <span className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
              {highlightText(item.subtitle, searchTerm)}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.status && (
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              item.status.toUpperCase() === 'SANCTIONED'
                ? 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/50 dark:text-purple-300'
                : 'border-muted bg-muted/50 text-muted-foreground',
            )}
          >
            {item.status}
          </span>
        )}

        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md border text-muted-foreground transition-colors',
            isActive
              ? 'border-border bg-background text-foreground'
              : 'border-transparent bg-transparent text-muted-foreground/50',
          )}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  )
}

function areRowPropsEqual(prev: SearchResultRowProps, next: SearchResultRowProps) {
  return (
    prev.item === next.item &&
    prev.isActive === next.isActive &&
    prev.searchTerm === next.searchTerm &&
    prev.onClick === next.onClick &&
    prev.onMouseEnter === next.onMouseEnter &&
    prev.customSectionIcons === next.customSectionIcons
  )
}

const MemoSearchResultRow = React.memo(SearchResultRowBase, areRowPropsEqual)

export interface NavbarSearchProps {
  /** Controlled open state of dropdown */
  open?: boolean
  /** Initial open state when uncontrolled */
  defaultOpen?: boolean
  /** Callback triggered on open state change */
  onOpenChange?: (open: boolean) => void

  /** Controlled search term */
  searchTerm?: string
  /** Initial search term when uncontrolled */
  defaultSearchTerm?: string
  /** Callback triggered when search query changes */
  onSearchTermChange?: (term: string) => void

  /** Controlled active tag filters */
  activeTags?: string[]
  /** Initial active tags when uncontrolled */
  defaultActiveTags?: string[]
  /** Callback triggered when active tags change */
  onActiveTagsChange?: (tags: string[]) => void

  /** List of available tag filter keys */
  availableTags?: string[]
  /** Navigation shortcuts shown when query is empty */
  staticNavItems?: StaticNavItem[]
  /** Search result sections (pre-formatted or raw API sections) */
  sections?: RenderSection[] | SearchApiSection[]
  /** Animated placeholder strings to cycle through */
  placeholders?: string[]
  /** Enable/disable animated placeholder cycling */
  enableAnimatedPlaceholders?: boolean

  /** Loading state flag */
  isLoading?: boolean
  /** Error state flag */
  isError?: boolean
  /** Loading state for infinite scrolling pagination */
  isFetchingMore?: boolean
  /** Flag indicating more search results are available */
  hasMoreResults?: boolean

  /** Primary keyboard shortcut key. Defaults to 'K' (Cmd+K / Ctrl+K) */
  shortcutKey?: string
  /** Modifier key label override. Auto-detected by default ('⌘' on Mac, 'Ctrl' on Windows/Linux) */
  modifierKey?: string
  /** Enable or disable global keyboard shortcut listener. Default true */
  enableShortcut?: boolean

  /** Callback fired when user typing or tags change */
  onSearch?: (query: string, activeTags: string[]) => void
  /** Callback fired when listbox reaches bottom */
  onLoadMore?: () => void
  /** Callback fired when an item is selected */
  onItemClick?: (item: SearchListItem) => void
  /** Callback fired when "+ N more" button is clicked */
  onHasMoreClick?: (section: RenderSection) => void

  /** Custom icon mapping for section types */
  customSectionIcons?: Record<string, React.ComponentType<{ className?: string }>>
  /** Width of the component container (e.g. '500px' or '100%') */
  width?: string | number
  /** Class name for the outer container */
  containerClassName?: string
  /** Custom static placeholder when input is unfocused */
  placeholder?: string
  /** Disable input field */
  disabled?: boolean
}

export function NavbarSearch({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  searchTerm: controlledSearchTerm,
  defaultSearchTerm = '',
  onSearchTermChange,
  activeTags: controlledActiveTags,
  defaultActiveTags = [],
  onActiveTagsChange,
  availableTags: customAvailableTags = ['Invoices', 'Purchase Orders'],
  staticNavItems = [],
  sections: customSections,
  placeholders: customPlaceholders,
  enableAnimatedPlaceholders = true,
  isLoading = false,
  isError = false,
  isFetchingMore = false,
  hasMoreResults = false,
  shortcutKey = 'K',
  modifierKey,
  enableShortcut = true,
  onSearch,
  onLoadMore,
  onItemClick,
  onHasMoreClick,
  customSectionIcons,
  width = '500px',
  containerClassName,
  placeholder = 'Search...',
  disabled = false,
}: NavbarSearchProps) {
  const isMac = useIsMacPlatform()
  const resolvedModifierKey = modifierKey ?? (isMac ? '⌘' : 'Ctrl')

  // State management (supporting controlled & uncontrolled modes)
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen

  const setIsOpen = useCallback(
    (next: boolean) => {
      setInternalOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  const [internalSearchTerm, setInternalSearchTerm] = useState(defaultSearchTerm)
  const searchTerm = controlledSearchTerm !== undefined ? controlledSearchTerm : internalSearchTerm

  const setSearchTerm = useCallback(
    (term: string) => {
      setInternalSearchTerm(term)
      onSearchTermChange?.(term)
    },
    [onSearchTermChange],
  )

  const [internalActiveTags, setInternalActiveTags] = useState<string[]>(defaultActiveTags)
  const activeTags = controlledActiveTags !== undefined ? controlledActiveTags : internalActiveTags

  const setActiveTags = useCallback(
    (tagsOrFn: string[] | ((prev: string[]) => string[])) => {
      const nextTags = typeof tagsOrFn === 'function' ? tagsOrFn(activeTags) : tagsOrFn
      setInternalActiveTags(nextTags)
      onActiveTagsChange?.(nextTags)
    },
    [activeTags, onActiveTagsChange],
  )

  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isInitialState = searchTerm === '' && activeTags.length === 0

  // Trigger external onSearch callback when query or active tags change
  useEffect(() => {
    onSearch?.(searchTerm, activeTags)
  }, [searchTerm, activeTags, onSearch])

  // Global Cmd/Ctrl + Shortcut listener
  useEffect(() => {
    if (!enableShortcut) return

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === shortcutKey.toLowerCase() && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(true)
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [enableShortcut, shortcutKey, setIsOpen])

  // Dismiss dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setIsOpen])

  // Toggle active tag pill
  const toggleTag = useCallback(
    (tag: string) => {
      setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
    },
    [setActiveTags],
  )

  // Compute render sections & flat list for keyboard navigation
  const { renderSections, flatItems } = useMemo(() => {
    let idx = 0
    const sectionsResult: RenderSection[] = []
    const flatResult: SearchListItem[] = []

    // If custom sections provided (either pre-formatted RenderSection[] or raw SearchApiSection[])
    if (customSections && customSections.length > 0) {
      customSections.forEach((sec: any) => {
        // Check if pre-formatted RenderSection
        if ('items' in sec && sec.items.length > 0 && 'globalIndex' in (sec.items[0] || {})) {
          const itemsWithIndex = sec.items.map((item: SearchListItem) => {
            const newItem = { ...item, globalIndex: idx++ }
            flatResult.push(newItem)
            return newItem
          })
          sectionsResult.push({ ...sec, items: itemsWithIndex })
        } else if ('items' in sec && sec.items.length > 0) {
          // Raw SearchApiSection
          const items: SearchListItem[] = sec.items.map((raw: any) => {
            const { title, subtitle, status } = mapSectionItem(sec.type, raw)
            const item: SearchListItem = {
              id: raw.id || String(idx),
              type: sec.type,
              title,
              subtitle,
              status,
              globalIndex: idx++,
              rawItem: raw,
            }
            flatResult.push(item)
            return item
          })
          sectionsResult.push({
            type: sec.type,
            title: SECTION_TITLES[sec.type] ?? sec.type,
            total: sec.total || items.length,
            hasMore: Boolean(sec.hasMore),
            items,
          })
        }
      })
      return { renderSections: sectionsResult, flatItems: flatResult }
    }

    // Default static navigation mode when empty
    if (isInitialState) {
      if (staticNavItems.length > 0) {
        const items: SearchListItem[] = staticNavItems.map((navItem) => {
          const item: SearchListItem = {
            id: navItem.url,
            type: 'STATIC',
            title: navItem.title,
            subtitle: navItem.url,
            icon: navItem.icon,
            globalIndex: idx++,
            rawItem: navItem,
          }
          flatResult.push(item)
          return item
        })
        sectionsResult.push({
          type: 'NAVIGATION',
          title: 'Navigation',
          total: items.length,
          hasMore: false,
          items,
        })
      }
    }

    return { renderSections: sectionsResult, flatItems: flatResult }
  }, [customSections, isInitialState, staticNavItems])

  // Reset active keyboard highlight when items change
  useEffect(() => {
    setActiveIndex(flatItems.length > 0 ? 0 : -1)
  }, [flatItems.length])

  // Auto-scroll highlighted row into view during keyboard navigation
  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(`search-item-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Infinite scroll event handler
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      if (target.scrollHeight - target.scrollTop - target.clientHeight < 25) {
        if (!isLoading && !isFetchingMore && hasMoreResults) {
          onLoadMore?.()
        }
      }
    },
    [isLoading, isFetchingMore, hasMoreResults, onLoadMore],
  )

  // Tab completion suggestion for tag matching
  const suggestion = useMemo(() => {
    const lower = searchTerm.trim().toLowerCase()
    if (lower.length < 2) return null

    for (const tag of customAvailableTags) {
      if (activeTags.includes(tag)) continue
      const label = getTagLabel(tag)
      const isMatch =
        tag.toLowerCase().startsWith(lower) ||
        label.toLowerCase().startsWith(lower) ||
        ((tag === 'people' || tag === 'rms') && ('rms'.startsWith(lower) || 'rm'.startsWith(lower)))
      if (isMatch) return { tag, label }
    }
    return null
  }, [searchTerm, customAvailableTags, activeTags])

  const handleItemSelect = useCallback(
    (item: SearchListItem) => {
      onItemClick?.(item)
      setIsOpen(false)
      setSearchTerm('')
      searchInputRef.current?.blur()
    },
    [onItemClick, setIsOpen, setSearchTerm],
  )

  // Keyboard navigation & control
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setIsOpen(true)
        }
        return
      }

      switch (e.key) {
        case 'Backspace':
          if (searchTerm === '' && activeTags.length > 0) {
            e.preventDefault()
            setActiveTags((prev) => prev.slice(0, -1))
          }
          break
        case 'Tab':
          if (suggestion) {
            e.preventDefault()
            toggleTag(suggestion.tag)
            setSearchTerm('')
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (flatItems.length > 0) {
            setActiveIndex((prev) => (prev + 1) % flatItems.length)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (flatItems.length > 0) {
            setActiveIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length)
          }
          break
        case 'Enter':
          e.preventDefault()
          if (activeIndex >= 0 && activeIndex < flatItems.length) {
            handleItemSelect(flatItems[activeIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          searchInputRef.current?.blur()
          break
        default:
          break
      }
    },
    [
      isOpen,
      searchTerm,
      activeTags,
      suggestion,
      toggleTag,
      flatItems,
      activeIndex,
      handleItemSelect,
      setIsOpen,
      setSearchTerm,
      setActiveTags,
    ],
  )

  // Animated placeholder text handling using existing placeholder suggestions
  const placeholderPhrases = useMemo(() => {
    return customPlaceholders || getPlaceholderSuggestions(activeTags)
  }, [customPlaceholders, activeTags])

  // Framer Motion typewriter character animation state
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!enableAnimatedPlaceholders || !isOpen || searchTerm !== '') {
      setDisplayedPlaceholder('')
      return
    }

    const currentPhrase = placeholderPhrases[placeholderIndex % placeholderPhrases.length]
    let timer: ReturnType<typeof setTimeout>

    if (!isDeleting) {
      if (displayedPlaceholder.length < currentPhrase.length) {
        timer = setTimeout(() => {
          setDisplayedPlaceholder(currentPhrase.slice(0, displayedPlaceholder.length + 1))
        }, 50)
      } else {
        timer = setTimeout(() => {
          setIsDeleting(true)
        }, 2000)
      }
    } else {
      if (displayedPlaceholder.length > 0) {
        timer = setTimeout(() => {
          setDisplayedPlaceholder(currentPhrase.slice(0, displayedPlaceholder.length - 1))
        }, 25)
      } else {
        setIsDeleting(false)
        setPlaceholderIndex((prev) => prev + 1)
      }
    }

    return () => clearTimeout(timer)
  }, [
    enableAnimatedPlaceholders,
    isOpen,
    searchTerm,
    displayedPlaceholder,
    isDeleting,
    placeholderIndex,
    placeholderPhrases,
  ])

  const activeDescendant = activeIndex >= 0 ? `search-item-${activeIndex}` : undefined

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full max-w-125 h-9', containerClassName)}
      style={width ? { width: typeof width === 'number' ? `${width}px` : width } : undefined}
    >
      <InputGroup className="bg-background relative flex w-full items-center gap-1.5 px-3">
        <div className="text-muted-foreground pointer-events-none flex shrink-0 items-center select-none">
          <SearchIcon className="h-4 w-4" />
        </div>

        {/* Selected tag filter pills */}
        {activeTags.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5">
            {activeTags.map((tag) => (
              <span
                key={tag}
                className="border-primary/30 bg-primary/10 text-primary flex items-center gap-1 rounded-full border py-0.5 pr-1.5 pl-2 text-[11px] font-medium select-none"
              >
                <span>{getTagLabel(tag)}</span>
              </span>
            ))}
          </div>
        )}

        <div className="relative flex min-w-0 flex-1 items-center">
          <InputGroupInput
            ref={searchInputRef}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={LISTBOX_ID}
            aria-activedescendant={activeDescendant}
            aria-autocomplete="list"
            autoComplete="off"
            disabled={disabled}
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={isOpen ? '' : placeholder}
            className="h-9 w-full min-w-15 flex-1 border-0 bg-transparent pl-0 shadow-none focus-visible:ring-0"
          />

          {/* Animated typewriter placeholder overlay */}
          <AnimatePresence mode="popLayout">
            {isOpen && searchTerm === '' && enableAnimatedPlaceholders && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none absolute truncate inset-0 top-0.5 flex items-center text-sm text-muted-foreground/60 select-none"
              >
                <span>{displayedPlaceholder}</span>
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="ml-0.5 inline-block h-4 w-0.5 bg-primary/70"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab completion ghost suggestion preview */}
          {suggestion && (
            <div className="pointer-events-none absolute inset-0 top-0.5 flex items-center text-sm text-muted-foreground/40 select-none">
              <span className="text-transparent">{searchTerm}</span>
              <span>{suggestion.label.slice(searchTerm.length)}</span>
              <span className="bg-muted text-muted-foreground border-border ml-2 rounded border px-1 py-0.5 text-[9px] leading-none font-bold uppercase">
                Tab
              </span>
            </div>
          )}
        </div>

        {enableShortcut && (
          <InputGroupAddon align="inline-end" className="shrink-0 gap-0">
            <Kbd>{resolvedModifierKey}</Kbd>
            <span className="text-muted-foreground text-xs font-medium">+</span>
            <Kbd>{shortcutKey}</Kbd>
          </InputGroupAddon>
        )}
      </InputGroup>

      {/* Results Listbox with Custom ScrollArea */}
      {isOpen && (
        <ScrollArea
          className="bg-popover text-popover-foreground border-border absolute top-0 right-0 left-0 z-50 mt-1.5 max-h-[420px] w-full rounded-lg border shadow-xl"
          viewportProps={{
            id: LISTBOX_ID,
            role: 'listbox',
            onScroll: handleScroll,
            className: 'max-h-[420px] w-full py-2 [&>div]:!block [&>div]:w-full',
          }}
        >
          {/* Tag Category Filter Bar */}
          {customAvailableTags.length > 0 && (
            <div className="border-border flex flex-wrap gap-1.5 border-b px-3 pb-2 pt-1">
              {customAvailableTags.map((tag) => {
                const isSelected = activeTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs transition-all select-none',
                      isSelected
                        ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                    )}
                  >
                    <span>{getTagLabel(tag)}</span>
                    {isSelected && <X className="h-3 w-3 stroke-[3px]" />}
                  </button>
                )
              })}
            </div>
          )}

          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 px-4 py-8 text-sm">
              <Loader className="h-4 w-4 animate-spin text-primary" />
              <span>Loading search results...</span>
            </div>
          ) : isError ? (
            <div className="px-4 py-8 text-center text-sm text-destructive font-medium">
              Something went wrong loading search results. Please try again.
            </div>
          ) : flatItems.length === 0 ? (
            <div className="text-muted-foreground px-4 py-8 text-center text-sm">
              {searchTerm ? (
                <>
                  No results found for{' '}
                  <span className="font-semibold text-foreground">"{searchTerm}"</span>
                </>
              ) : (
                'No search items found'
              )}
            </div>
          ) : (
            <>
              {renderSections.map((sec) => (
                <div key={sec.type} className="border-border/40 border-b px-1 py-1.5 last:border-0">
                  <div className="text-muted-foreground flex items-center justify-between px-3 py-1 text-[11px] font-bold tracking-wider uppercase select-none">
                    <span>{sec.title}</span>
                  </div>

                  <div className="mt-1 flex flex-col gap-0.5">
                    {sec.items.map((item) => (
                      <MemoSearchResultRow
                        key={item.id}
                        item={item}
                        isActive={activeIndex === item.globalIndex}
                        searchTerm={searchTerm}
                        onClick={handleItemSelect}
                        onMouseEnter={setActiveIndex}
                        customSectionIcons={customSectionIcons}
                      />
                    ))}

                    {sec.hasMore && (
                      <div className="pt-1 pr-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onHasMoreClick?.(sec)
                          }}
                          className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                        >
                          + {sec.total > sec.items.length ? sec.total - sec.items.length : ''} more
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isFetchingMore && (
                <div className="border-border text-muted-foreground flex items-center justify-center gap-2 border-t py-3 text-xs">
                  <Loader className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Loading more results...</span>
                </div>
              )}
            </>
          )}
        </ScrollArea>
      )}
    </div>
  )
}
