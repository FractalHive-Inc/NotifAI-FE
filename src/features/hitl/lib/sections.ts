import { asRecord, inferKind, isRecord, stringify, titleCase, toFieldValue } from './primitives'
import type { FieldKind, FieldPath, FieldSpec, FieldVM, SectionSpec, SectionVM } from './types'

/**
 * Group `doc_insights` into sections a reviewer can scan.
 *
 * Three rules govern everything here:
 *
 *  1. Known keys go where the document's contract says. The specs live in
 *     `features/documents/contracts`, one file per document type; this module
 *     is the engine that applies them and knows nothing about invoices.
 *  2. Specs are optimistic. A field whose key is absent renders nothing, and a
 *     section with no present fields is not shown, so a contract may declare a
 *     superset of what any one document carries.
 *  3. **Every unknown key still gets rendered**, in an Additional Fields
 *     bucket. A key the reviewer never sees is data they are approving blind,
 *     which for an approval workflow is the worst failure mode available — and
 *     it is invisible unless you go looking. So the parser tracks what it
 *     consumed and sweeps up the rest, at the root, inside `extra_fields`, and
 *     inside every sub-object a contract mentioned.
 */

/** Where a spec's value was actually found — the key may be an alias. */
interface Resolved {
  /** Segments from the section's source down to the value. */
  segments: string[]
  value: unknown
}

/**
 * Read one key, which may be dotted — `purchase_order.purchase_order_number`.
 *
 * Dotted keys are how a sub-object's fields appear under the heading they
 * belong to. The agent moved the PO reference into an object carrying both the
 * number and its date; both belong in the invoice summary a reviewer reads, not
 * in a card of their own, and neither is readable as the JSON blob a plain
 * `purchase_order` field renders.
 */
function read(source: Record<string, unknown>, key: string, kind: FieldKind): Resolved | null {
  const segments = key.split('.')
  let cursor: unknown = source

  for (const segment of segments) {
    const record = asRecord(cursor)
    if (!record || !(segment in record)) return null
    cursor = record[segment]
  }

  /*
   * A container is never rendered as a scalar. `{"purchase_order_number": ...}`
   * under a text field shows the reviewer raw JSON; declining it here sends the
   * object to Additional Fields instead, where every key inside it is expanded
   * and labelled. Nothing is hidden either way — this only decides which of the
   * two readable forms it takes.
   */
  const container = isRecord(cursor) || (Array.isArray(cursor) && kind !== 'list')
  if (container && kind !== 'raw') return null

  return { segments, value: cursor }
}

/**
 * Find a field by its key, then by each alias in turn.
 *
 * Aliases are what make an agent-side rename a non-event: register the new name
 * alongside the old and both payloads render identically, with no window in
 * which the field disappears into Additional Fields.
 */
function resolve(source: Record<string, unknown>, spec: FieldSpec): Resolved | null {
  const direct = read(source, spec.key, spec.kind)
  if (direct) return direct

  for (const alias of spec.aliases ?? []) {
    const found = read(source, alias, spec.kind)
    if (found) return found
  }

  return null
}

/**
 * `payment_details` is an array of *single-key objects* —
 * `[{payment_terms}, {bank_details}]` — rather than one object. Merge it so the
 * section spec can read it like any other sub-object.
 */
function normalisePaymentDetails(value: unknown): {
  record: Record<string, unknown>
  /** Where each merged key came from, so edits write back to the right index. */
  paths: Record<string, FieldPath>
} {
  const record: Record<string, unknown> = {}
  const paths: Record<string, FieldPath> = {}

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const asObject = asRecord(entry)
      if (!asObject) return
      for (const [key, inner] of Object.entries(asObject)) {
        record[key] = inner
        paths[key] = ['payment_details', index, key]
      }
    })
    return { record, paths }
  }

  const direct = asRecord(value)
  if (direct) {
    for (const [key, inner] of Object.entries(direct)) {
      record[key] = inner
      paths[key] = ['payment_details', key]
    }
  }

  return { record, paths }
}

function buildField(
  id: string,
  label: string,
  value: unknown,
  kind: FieldKind,
  path: FieldPath,
): FieldVM {
  const fieldValue = toFieldValue(value, kind)
  return {
    id,
    label,
    value: fieldValue,
    path,
    // Nested structures have no single input that could represent them, so they
    // render read-only rather than offering an edit that could not round-trip.
    editable: fieldValue.kind !== 'raw',
  }
}

/** Identity for the consumed set: `key` at the root, `parent.key` below it. */
function consumedKey(from: string | null, key: string): string {
  return from === null ? key : `${from}.${key}`
}

export function buildSections(
  insights: Record<string, unknown>,
  specs: SectionSpec[],
  /** Root keys claimed elsewhere — today, the resolved line-items key. */
  consumedRootKeys: string[] = [],
): {
  sections: SectionVM[]
  unknownKeys: string[]
} {
  const consumed = new Set<string>()
  const sections: SectionVM[] = []

  /**
   * Root objects a field spec reached into with a dotted key. They are swept
   * like any container a section names, so a sibling key no spec claimed — a PO
   * amount appearing next to the PO number — still reaches the reviewer.
   */
  const nestedParents = new Set<string>()

  const payment = normalisePaymentDetails(insights.payment_details)

  for (const spec of specs) {
    let source: Record<string, unknown> | null
    let pathPrefix: FieldPath

    if (spec.from === null) {
      source = insights
      pathPrefix = []
    } else if (spec.from === 'payment_details') {
      source = payment.record
      pathPrefix = ['payment_details']
    } else {
      source = asRecord(insights[spec.from])
      pathPrefix = [spec.from]
    }

    if (!source) continue

    const fields: FieldVM[] = []

    for (const field of spec.fields) {
      const found = resolve(source, field)
      if (!found) continue

      const [head] = found.segments

      const path =
        spec.from === 'payment_details' && found.segments.length === 1
          ? (payment.paths[head] ?? [...pathPrefix, head])
          : [...pathPrefix, ...found.segments]

      fields.push(buildField(`${spec.id}.${field.key}`, field.label, found.value, field.kind, path))

      // `parent.child` either way, so a dotted key at the root and a section
      // reading that same sub-object mark the value consumed identically.
      consumed.add(consumedKey(spec.from, found.segments.join('.')))

      if (spec.from === null && found.segments.length > 1) nestedParents.add(head)
    }

    if (fields.length > 0) {
      sections.push({ id: spec.id, title: spec.title, fields })
    }
  }

  // Every sub-object a contract mentioned is a container whose *unclaimed* keys
  // must still surface — an agent that adds `buyer_details.contact_email`
  // should not have it silently vanish.
  const parents = [
    ...new Set([
      ...specs.map((spec) => spec.from).filter((from) => from !== null),
      ...nestedParents,
    ]),
  ]

  // Containers handled by a spec, plus whatever the caller already claimed, are
  // not swept again at the root.
  const handledRootKeys = new Set<string>([...parents, ...consumedRootKeys])

  const leftovers: FieldVM[] = []
  const unknownKeys: string[] = []

  for (const [key, value] of Object.entries(insights)) {
    if (handledRootKeys.has(key) || consumed.has(key)) continue
    unknownKeys.push(key)
    leftovers.push(...expand(key, value, [key], `extra.${key}`))
  }

  for (const parent of parents) {
    // `payment_details` was flattened above, so sweep the merged view and use
    // the recorded paths — otherwise an unclaimed key would be written back to
    // the wrong index.
    const record =
      parent === 'payment_details' ? payment.record : (asRecord(insights[parent]) ?? null)
    if (!record) continue

    for (const [key, value] of Object.entries(record)) {
      if (consumed.has(consumedKey(parent, key))) continue

      const path =
        parent === 'payment_details' ? (payment.paths[key] ?? [parent, key]) : [parent, key]

      unknownKeys.push(`${parent}.${key}`)

      // `extra_fields` is a grab-bag, so its keys read fine on their own.
      // Everything else needs its container named, or "Name" appears twice with
      // no way to tell the buyer's from the seller's.
      const label = parent === 'extra_fields' ? key : `${titleCase(parent)} ${key}`

      leftovers.push(...expand(label, value, path, `extra.${parent}.${key}`))
    }
  }

  if (leftovers.length > 0) {
    sections.push({ id: 'additional', title: 'Additional Fields', fields: leftovers })
  }

  return { sections, unknownKeys }
}

/**
 * Render an unspecified value. Objects flatten one level into `Parent · Child`
 * labels; anything deeper becomes a raw JSON block rather than `[object Object]`.
 */
function expand(key: string, value: unknown, path: FieldPath, id: string): FieldVM[] {
  if (isRecord(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) return []

    const nested = entries.map(([childKey, childValue]) =>
      isRecord(childValue) || Array.isArray(childValue)
        ? buildField(
            `${id}.${childKey}`,
            `${titleCase(key)} · ${titleCase(childKey)}`,
            childValue,
            'raw',
            [...path, childKey],
          )
        : buildField(
            `${id}.${childKey}`,
            `${titleCase(key)} · ${titleCase(childKey)}`,
            childValue,
            inferKind(childValue),
            [...path, childKey],
          ),
    )

    return nested
  }

  if (Array.isArray(value)) {
    const scalars = value.every((item) => !isRecord(item) && !Array.isArray(item))
    return [
      buildField(
        id,
        titleCase(key),
        scalars ? value.map(stringify) : value,
        scalars ? 'list' : 'raw',
        path,
      ),
    ]
  }

  return [buildField(id, titleCase(key), value, inferKind(value), path)]
}
