/* eslint-disable react-hooks/set-state-in-effect -- the same highlight reset, in the shared helper; this repo's ruleset is stricter than the registry's. */
import React from 'react'

// ---------------------------------------------------------------------------
// Domain Types
// ---------------------------------------------------------------------------

export type SearchSectionType = 'DEALS' | 'CUSTOMERS' | 'PEOPLE' | 'MASTER' | 'PRODUCTS' | string
export type ListItemType = 'STATIC' | SearchSectionType

export interface StaticNavItem {
  url: string
  title: string
  icon?: React.ComponentType<{ className?: string }>
}

export interface DealSearchItem {
  id: string
  slug: string
  name: string
  customerName: string
  status?: string
}

export interface CustomerSearchItem {
  id: string
  name: string
  cif?: string
}

export interface PeopleSearchItem {
  id: string
  name: string
  email?: string
}

export interface MasterSearchItem {
  id: string
  entityType: string
  name: string
  code?: string | null
  parentName?: string | null
  description?: string | null
}

export interface ProductSearchItem {
  id: string
  name: string
  code?: string
  matchedVia?: string | null
  description?: string | null
}

export type SearchApiItem =
  | DealSearchItem
  | CustomerSearchItem
  | PeopleSearchItem
  | MasterSearchItem
  | ProductSearchItem
  | Record<string, any>

export interface SearchApiSection {
  type: SearchSectionType
  items: SearchApiItem[]
  total: number
  hasMore: boolean
}

export interface UniversalSearchResponse {
  sections?: SearchApiSection[]
  tags?: string[]
}

export interface SearchListItem {
  id: string
  type: ListItemType
  title: string
  subtitle?: string
  status?: string
  icon?: React.ComponentType<{ className?: string }>
  globalIndex: number
  rawItem: StaticNavItem | SearchApiItem
}

export type RenderItem = SearchListItem
export type FlatItem = SearchListItem

export interface RenderSection {
  type: 'NAVIGATION' | SearchSectionType
  title: string
  total: number
  hasMore: boolean
  items: SearchListItem[]
}

export const SECTION_TITLES: Record<string, string> = {
  DEALS: 'Deals',
  CUSTOMERS: 'Customers',
  PEOPLE: 'Relationship Manager',
  MASTER: 'Master Data',
  PRODUCTS: 'Products',
  NAVIGATION: 'Navigation',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps a raw API search result to display fields based on section type. */
export function mapSectionItem(
  type: SearchSectionType,
  item: SearchApiItem,
): { title: string; subtitle: string; status?: string } {
  if (!item) return { title: '', subtitle: '' }

  switch (type.toUpperCase()) {
    case 'DEALS': {
      const deal = item as DealSearchItem
      return {
        title: deal.slug || deal.name || '',
        subtitle: [deal.name, deal.customerName].filter(Boolean).join(' | '),
        status: deal.status,
      }
    }
    case 'CUSTOMERS': {
      const customer = item as CustomerSearchItem
      return { title: customer.name || '', subtitle: customer.cif || '' }
    }
    case 'PEOPLE': {
      const person = item as PeopleSearchItem
      return { title: person.name || '', subtitle: person.email || '' }
    }
    case 'MASTER': {
      const master = item as MasterSearchItem
      const formattedType = master.entityType
        ? master.entityType
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
        : 'Master'
      const parts = [formattedType]
      if (master.code) parts.push(master.code)
      if (master.parentName) parts.push(master.parentName)
      if (master.description) parts.push(master.description)
      return {
        title: master.name || '',
        subtitle: parts.join(' | '),
      }
    }
    case 'PRODUCTS': {
      const product = item as ProductSearchItem
      const parts = []
      if (product.code) parts.push(product.code)
      if (product.description) parts.push(product.description)
      if (product.matchedVia) parts.push(`Matched: ${product.matchedVia}`)
      return {
        title: product.name || '',
        subtitle: parts.join(' | ') || 'Product',
      }
    }
    default: {
      const raw = item as Record<string, any>
      return {
        title: raw.title || raw.name || '',
        subtitle: raw.subtitle || raw.description || raw.email || raw.code || '',
        status: raw.status,
      }
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export function highlightText(text: string, search: string): React.ReactNode {
  const trimmed = search.trim()
  if (!trimmed) return <>{text}</>

  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, index) => {
        regex.lastIndex = 0
        const isMatch = regex.test(part)
        return isMatch ? (
          <mark key={index} className="rounded-xs bg-primary/10 px-0.5 font-semibold text-primary">
            {part}
          </mark>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      })}
    </>
  )
}

export function getTagLabel(tag: string): string {
  const t = tag.toLowerCase()
  if (t === 'people' || t === 'rms') return 'RMs'
  if (t === 'deals' || t === 'deal') return 'Deals'
  if (t === 'customers' || t === 'customer') return 'Customers'
  if (t === 'master') return 'Master Data'
  if (t === 'products' || t === 'product') return 'Products'
  return tag.charAt(0).toUpperCase() + tag.slice(1)
}

const PLACEHOLDER_SUGGESTIONS: Record<string, string[]> = {
  default: [
    'Search deals, customers, RMs...',
    'Search deals with deal ID...',
    'Type to search anything...',
    'Type "de" for deals, "cu" for customers...',
  ],
  deals: [
    'Search deals with name...',
    'Search deals with deal ID...',
    'Search deals with RM name...',
  ],
  deal: [
    'Search deals with name...',
    'Search deals with deal ID...',
    'Search deals with RM name...',
  ],
  customers: [
    'Search customers with name...',
    'Search customers with CIF...',
    'Search customers with contact info...',
  ],
  customer: [
    'Search customers with name...',
    'Search customers with CIF...',
    'Search customers with contact info...',
  ],
  people: ['Search RMs with name...', 'Search RMs with email...'],
  rms: ['Search RMs with name...', 'Search RMs with email...'],
  master: ['Search currencies...', 'Search collateral fields...', 'Search fees...'],
  products: ['Search products with name...', 'Search products with code...'],
}

export function getPlaceholderSuggestions(activeTags: string[]): string[] {
  if (activeTags.length === 0) {
    return PLACEHOLDER_SUGGESTIONS.default
  }

  const suggestions: string[] = []
  activeTags.forEach((tag) => {
    const list = PLACEHOLDER_SUGGESTIONS[tag.toLowerCase()]
    if (list) suggestions.push(...list)
  })

  if (suggestions.length > 0) return suggestions

  const labels = activeTags.map((tag) => getTagLabel(tag).toLowerCase())
  return [`Search ${labels.join(', ')}...`]
}

/** Hook to detect if the client is running on macOS/iOS */
export function useIsMacPlatform(): boolean {
  const [isMac, setIsMac] = React.useState(true)

  React.useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent || ''
      const platform = (navigator as any).userAgentData?.platform || navigator.platform || ''
      const macPattern = /Mac|iPhone|iPod|iPad/i
      setIsMac(macPattern.test(platform) || macPattern.test(userAgent))
    }
  }, [])

  return isMac
}
