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
import { BASE, INTENTIONAL, applyLocalRewrites, isRepoOwned } from './registry-shared.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const SHOW_DIFF = process.argv.includes('--diff')

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
    if (isRepoOwned(file.target)) continue

    const rel = file.target.replace(/^src\//, '')
    const abs = join(SRC, rel)
    if (!existsSync(abs)) continue // not installed in this app

    const upstream = applyLocalRewrites(file.content)

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

/**
 * A recorded reason for a file that no longer differs means upstream caught up.
 * Left in place it is not harmless: refresh-ui.mjs skips every recorded file, so
 * a stale entry quietly freezes a component that has no local patch at all.
 */
const obsolete = Object.keys(INTENTIONAL).filter(
  (rel) => clean.includes(rel) && !diverged.some(([d]) => d === rel)
)

if (obsolete.length) {
  console.log(`\n! ${obsolete.length} recorded divergence(s) that no longer diverge — upstream caught up:`)
  for (const rel of obsolete) console.log(`    ${rel}`)
  console.log('\n  Delete these from INTENTIONAL in scripts/registry-shared.mjs.')
}

if (stale.length) {
  console.log(`\n✗ ${stale.length} file(s) differ from the registry with no recorded reason:`)
  for (const rel of stale) console.log(`    ${relative('.', join('src', rel))}`)
  console.log('\n  Either refresh them, or add the reason to INTENTIONAL in this script.')
  process.exit(1)
}

console.log('\nNo unexplained drift.')
