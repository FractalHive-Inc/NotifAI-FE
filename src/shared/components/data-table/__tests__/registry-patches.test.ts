import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { INTENTIONAL } from '../../../../../scripts/registry-shared.mjs'

/**
 * Tripwire for the failure this layer exists to prevent.
 *
 * A registry refresh overwrites vendored files wholesale. When that ate the
 * local onRowClick patch, the *record* of it survived in INTENTIONAL while the
 * code did not — so nothing failed, and row clicks were silently dead until
 * someone noticed the table had stopped navigating. check:registry cannot catch
 * this: a wiped file matches the registry exactly, which is what "clean" means.
 *
 * These assertions are deliberately about the patch, not the rendering. They go
 * red the moment a pull removes one.
 */
const UI = join(process.cwd(), 'src/shared/components/ui')
const read = (rel: string) => readFileSync(join(UI, rel), 'utf8')

describe('local patches in vendored registry files', () => {
  it('table exposes onRowClick down to the row', () => {
    expect(read('table/table-types.ts')).toContain('onRowClick?: (row: TData) => void')
    expect(read('table/table.tsx')).toContain('onRowClick={onRowClick}')
    expect(read('table/table-data-row.tsx')).toContain('onRowClick(row.original)')
  })

  it('calendar uses the react-day-picker v10 class key', () => {
    const calendar = read('calendar.tsx')
    expect(calendar).toContain('month_grid:')
    expect(calendar).not.toMatch(/^\s+table: /m)
  })

  it('the time picker period ref is typed for the button it is attached to', () => {
    expect(read('table/table-filter-panels.tsx')).toContain('React.useRef<HTMLButtonElement>(null)')
  })

  it('keeps the scoped set-state-in-effect disables lint needs', () => {
    // Wiped by the same refresh that ate onRowClick; without them `npm run lint`
    // fails on files nobody here is meant to be editing.
    expect(read('table/table-filter-panels.tsx')).toContain(
      'eslint-disable react-hooks/set-state-in-effect',
    )
    expect(read('table/table-filter.tsx')).toContain(
      'eslint-disable react-hooks/set-state-in-effect',
    )
  })

  it('the sidebar keeps its header separator and FractalHive footer', () => {
    const sidebar = read('app-sidebar/app-sidebar.tsx')
    expect(sidebar).toContain('SidebarBrandFooter')
    expect(sidebar).toContain('Powered by')
    expect(sidebar).toContain('APP_VERSION')
    // The separator sits between the NotifAI header button and the nav list;
    // upstream ships neither it nor a footer inside the white panel.
    expect(sidebar).toContain('<SidebarSeparator className="mx-0 mt-2 w-full" />')
  })

  it('every patch asserted above is recorded for the next refresh', () => {
    for (const rel of [
      'shared/components/ui/table/table-types.ts',
      'shared/components/ui/table/table.tsx',
      'shared/components/ui/table/table-data-row.tsx',
      'shared/components/ui/calendar.tsx',
      'shared/components/ui/table/table-filter-panels.tsx',
      'shared/components/ui/table/table-filter.tsx',
      'shared/components/ui/app-sidebar/app-sidebar.tsx',
    ]) {
      expect(INTENTIONAL, `${rel} must carry a reason`).toHaveProperty(rel)
    }
  })
})
