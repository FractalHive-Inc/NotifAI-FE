#!/usr/bin/env node
/**
 * Pulls a component from the FractalHive registry, with its registry
 * dependencies, into this repo's flat `shared/components/ui/<name>.tsx` layout.
 *
 * This exists because hand-copying a single file is how `time-input` went
 * missing: `table-filter-panels` was refreshed from a registry version that
 * imports TimePickerInput, the dep list was never read, and the whole table
 * barrel stopped compiling. Resolving registryDependencies is the entire point.
 *
 *   node scripts/refresh-ui.mjs time-input          # component + its deps
 *   node scripts/refresh-ui.mjs table --force       # overwrite recorded patches too
 *   node scripts/refresh-ui.mjs time-input --dry-run
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath as toPath } from 'node:url'
import prettier from 'prettier'
import { BASE, INTENTIONAL, applyLocalRewrites, isRepoOwned, toItemName } from './registry-shared.mjs'

const ROOT = join(dirname(toPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const DRY = args.includes('--dry-run')
const names = args.filter((a) => !a.startsWith('--'))

if (names.length === 0) {
  console.error('usage: node scripts/refresh-ui.mjs <component> [...] [--force] [--dry-run]')
  process.exit(1)
}

const fetchItem = async (name) => {
  const res = await fetch(`${BASE}/${name}.json`)
  if (!res.ok) throw new Error(`registry has no "${name}" (${res.status})`)
  return res.json()
}

// Breadth-first over registryDependencies. A component is only as installed as
// its dependency closure — the half-installed case is the bug this prevents.
const seen = new Set()
const queue = [...names]
const items = []
while (queue.length) {
  const name = queue.shift()
  if (seen.has(name)) continue
  seen.add(name)
  const item = await fetchItem(name)
  items.push(item)
  for (const dep of item.registryDependencies ?? []) queue.push(toItemName(dep))
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const installed = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
])

const written = []
const skipped = []
const missingDeps = new Set()

for (const item of items) {
  for (const dep of item.dependencies ?? []) {
    if (!installed.has(dep.replace(/@[\^~]?[\d.].*$/, ''))) missingDeps.add(dep)
  }

  for (const file of item.files ?? []) {
    if (file.content === undefined || !file.target) continue
    if (isRepoOwned(file.target)) continue

    const rel = file.target.replace(/^src\//, '')
    const abs = join(SRC, rel)

    if (INTENTIONAL[rel] && existsSync(abs) && !FORCE) {
      skipped.push([rel, INTENTIONAL[rel]])
      continue
    }

    const source = applyLocalRewrites(file.content)
    const config = await prettier.resolveConfig(abs)
    let formatted
    try {
      formatted = await prettier.format(source, { ...config, filepath: abs })
    } catch {
      formatted = source
    }

    if (!DRY) {
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, formatted)
    }
    written.push(rel)
  }
}

console.log(`\nResolved ${items.length} item(s): ${items.map((i) => i.name).join(', ')}`)
console.log(`\n${DRY ? 'Would write' : 'Wrote'} ${written.length} file(s):`)
for (const rel of written) console.log(`    src/${rel}`)

if (skipped.length) {
  console.log(`\n● Kept ${skipped.length} file(s) with recorded local patches — NOT overwritten:`)
  for (const [rel, why] of skipped) console.log(`    src/${rel}\n      ${why}`)
  console.log('\n  Re-run with --force to take upstream, then reapply the patch by hand.')
}

if (missingDeps.size) {
  console.log(`\n✗ npm dependencies this component needs that are not in package.json:`)
  for (const dep of missingDeps) console.log(`    ${dep}`)
  console.log(`\n  npm install ${[...missingDeps].join(' ')}`)
}

console.log('\nNext: npm run check:registry && npx tsc --noEmit -p tsconfig.app.json && npm test')
