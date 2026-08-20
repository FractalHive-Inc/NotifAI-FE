#!/usr/bin/env node
/**
 * Reports which vendored FractalHive registry files have diverged from the
 * registry, and which are simply out of date.
 *
 * It walks what is on disk rather than a hand-written list — a hardcoded list is
 * exactly how `table` was silently skipped in an earlier refresh. Formatting is
 * not drift: both sides are run through this repo's Prettier config before the
 * comparison, because every pulled file gets formatted on the way in.
 *
 *   node scripts/check-registry-drift.mjs          # summary
 *   node scripts/check-registry-drift.mjs --diff   # show the differing lines
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const BASE = 'https://ui.fractalhive.com/r'
const SHOW_DIFF = process.argv.includes('--diff')

/**
 * Divergences we mean to keep. Anything here is reported separately from
 * genuine staleness — the point of the script is that a refresh does not
 * silently eat them.
 */
const INTENTIONAL = {
  'shared/components/ui/table/table-types.ts': 'onRowClick + emptyState props',
  'shared/components/ui/table/table.tsx': 'onRowClick + emptyState props',
  'shared/components/ui/table/table-data-row.tsx': 'onRowClick handler',
  'shared/components/ui/calendar.tsx':
    'react-day-picker v10 renamed classNames.table -> month_grid; unused WeekNumber arg',
  'shared/components/ui/sidebar.tsx': 'SidebarMenuSkeleton width: useState, not useMemo',
  'shared/components/ui/loading-button.tsx': 'flat Button import',
  'shared/components/ui/animated-search-input.tsx':
    'framer-motion -> motion/react; we depend on `motion`, which carries it transitively',
  'shared/components/ui/table/table-toolbar.tsx': 'flat animated-search-input import',
  'shared/components/ui/table/table-filter.tsx': 'scoped eslint-disable set-state-in-effect',
  'shared/components/ui/app-layout.tsx':
    'navbar made prop-driven: brand / user / onLogout / onProfile / notifications, and NavMainItem imported from the barrel that actually exports it',
  'shared/components/ui/kbd.tsx': 'scoped eslint-disable set-state-in-effect',
  'shared/components/ui/navbar-search/navbar-search.tsx':
    'scoped eslint-disable set-state-in-effect + preserve-manual-memoization',
  'shared/components/ui/navbar-search/navbar-search-utils.tsx':
    'scoped eslint-disable set-state-in-effect',
  'shared/components/ui/table/table-filter-panels.tsx': 'scoped eslint-disable set-state-in-effect',
}

const format = async (source, filepath) => {
  const config = await prettier.resolveConfig(filepath)
  try {
    return await prettier.format(source, { ...config, filepath })
  } catch {
    return source // unparseable is still comparable verbatim
  }
}

const registry = await fetch(`${BASE}/registry.json`).then((r) => r.json())
const names = (registry.items ?? registry)
  .filter((item) => !/-v\d+$/.test(item.name) && item.type === 'registry:ui')
  .map((item) => item.name)

const stale = []
const diverged = []
const clean = []

for (const name of names) {
  let payload
  try {
    payload = await fetch(`${BASE}/${name}.json`).then((r) => r.json())
  } catch {
    continue
  }

  for (const file of payload.files ?? []) {
    if (file.content === undefined || !file.target) continue
    if (/lib\/utils|globals\.css/.test(file.target)) continue

    const rel = file.target.replace(/^src\//, '')
    const abs = join(SRC, rel)
    if (!existsSync(abs)) continue // not installed in this app

    // The rewrites every pulled file gets on the way in.
    const upstream = file.content
      .replace(/@\/lib\/utils/g, '@/shared/lib/utils')
      .replace(/(['"])framer-motion\1/g, "'motion/react'")
      .replace(/@\/shared\/components\/ui\/([a-z0-9-]+)\/\1(['"])/g, '@/shared/components/ui/$1$2')

    const [a, b] = await Promise.all([
      format(readFileSync(abs, 'utf8'), abs),
      format(upstream, abs),
    ])

    if (a === b) {
      clean.push(rel)
    } else if (INTENTIONAL[rel]) {
      diverged.push([rel, INTENTIONAL[rel]])
    } else {
      stale.push(rel)
      if (SHOW_DIFF) {
        const al = a.split('\n')
        const bl = b.split('\n')
        console.log(`\n--- ${rel}`)
        for (let i = 0; i < Math.max(al.length, bl.length); i++) {
          if (al[i] !== bl[i]) {
            if (bl[i] !== undefined) console.log(`  registry ${i + 1}: ${bl[i]}`)
            if (al[i] !== undefined) console.log(`  local    ${i + 1}: ${al[i]}`)
          }
        }
      }
    }
  }
}

console.log(`\n✓ ${clean.length} file(s) match the registry`)

if (diverged.length) {
  console.log(`\n● ${diverged.length} intentional divergence(s) — preserve these on refresh:`)
  for (const [rel, why] of diverged) console.log(`    ${rel}\n      ${why}`)
}

if (stale.length) {
  console.log(`\n✗ ${stale.length} file(s) differ from the registry with no recorded reason:`)
  for (const rel of stale) console.log(`    ${relative('.', join('src', rel))}`)
  console.log('\n  Either refresh them, or add the reason to INTENTIONAL in this script.')
  process.exit(1)
}

console.log('\nNo unexplained drift.')
