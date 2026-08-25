/**
 * Facts about our relationship with the FractalHive registry, shared by
 * check-registry-drift.mjs and refresh-ui.mjs.
 *
 * Both scripts have to agree on what counts as a deliberate local change —
 * the refresh script refuses to clobber these, and the drift script reports
 * them separately from genuine staleness. Two copies of this list would drift
 * apart, and the copy that went stale would be the one guarding the files.
 */
export const BASE = 'https://ui.fractalhive.com/r'

/**
 * Divergences we mean to keep, keyed by path relative to src/.
 *
 * A local patch that is not listed here is a bug waiting to happen: the next
 * refresh eats it and nothing says so. Anything that can instead be composed in
 * `shared/components/data-table` belongs there and should never appear here.
 */
export const INTENTIONAL = {
  'shared/components/ui/table/table-types.ts':
    'onRowClick prop — no seam in the registry table; pending upstream',
  'shared/components/ui/table/table.tsx':
    'onRowClick prop — no seam in the registry table; pending upstream',
  'shared/components/ui/table/table-data-row.tsx':
    'onRowClick handler on the row — pending upstream',
  'shared/components/ui/calendar.tsx':
    'react-day-picker v10 renamed classNames.table -> month_grid; upstream still ships the v9 key',
  'shared/components/ui/sidebar.tsx': 'SidebarMenuSkeleton width: useState, not useMemo',
  'shared/components/ui/app-layout.tsx':
    'navbar made prop-driven: brand / user / onLogout / onProfile / notifications, and NavMainItem imported from the barrel that actually exports it',
  'shared/components/ui/app-sidebar/app-sidebar.tsx':
    'separator under the NotifAI header + a "Powered by FractalHive" / version strip inside the white panel; upstream only has a SidebarFooter slot outside it',
  'shared/components/ui/kbd.tsx': 'scoped eslint-disable set-state-in-effect',
  'shared/components/ui/navbar-search/navbar-search.tsx':
    'scoped eslint-disable set-state-in-effect + preserve-manual-memoization',
  'shared/components/ui/navbar-search/navbar-search-utils.tsx':
    'scoped eslint-disable set-state-in-effect',
  'shared/components/ui/table/table-filter-panels.tsx':
    'periodRef typed HTMLButtonElement (upstream casts an input ref onto a <button>); scoped eslint-disable set-state-in-effect on the two value-sync effects',
  'shared/components/ui/table/table-filter.tsx':
    'scoped eslint-disable set-state-in-effect on the drawer-open effect',
}

/** The rewrites every pulled file gets on the way into this repo. */
export const applyLocalRewrites = (source) =>
  source
    .replace(/@\/lib\/utils/g, '@/shared/lib/utils')
    .replace(/(['"])framer-motion\1/g, "'motion/react'")
    .replace(/@\/shared\/components\/ui\/([a-z0-9-]+)\/\1(['"])/g, '@/shared/components/ui/$1$2')

/** Files the registry ships that this repo owns and must never take from upstream. */
export const isRepoOwned = (target) => /lib\/utils|globals\.css/.test(target)

/** `@fractalhive/input`, a bare name, or a full URL -> the registry item name. */
export const toItemName = (dep) =>
  dep
    .replace(/^https?:\/\/.*\//, '')
    .replace(/\.json$/, '')
    .replace(/^@[^/]+\//, '')
