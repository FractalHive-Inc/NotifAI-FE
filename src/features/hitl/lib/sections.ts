import { asRecord, inferKind, isRecord, stringify, titleCase, toFieldValue } from './primitives'
import type { FieldKind, FieldPath, FieldVM, SectionVM } from './types'

/**
 * Group `doc_insights` into sections a reviewer can scan.
 *
 * Two rules govern everything here:
 *
 *  1. Known keys go where they belong. Declared once, in `SECTION_SPECS`.
 *  2. **Every unknown key still gets rendered**, in an Additional Fields
 *     bucket. A key the reviewer never sees is data they are approving blind,
 *     which for an approval workflow is the worst failure mode available — and
 *     it is invisible unless you go looking. So the parser tracks what it
 *     consumed and sweeps up the rest.
 */

interface FieldSpec {
  key: string
  label: string
  kind: FieldKind
}

interface SectionSpec {
  id: string
  title: string
  /** `null` reads from the root of doc_insights; otherwise from that sub-object. */
  from: string | null
  fields: FieldSpec[]
}

const f = (key: string, label: string, kind: FieldKind = 'text'): FieldSpec => ({
  key,
  label,
  kind,
})

const PARTY_FIELDS: FieldSpec[] = [
  f('name', 'Name'),
  f('gst_tin', 'GST / TIN'),
  f('address', 'Address'),
]

export const SECTION_SPECS: SectionSpec[] = [
  {
    id: 'summary',
    title: 'Invoice Summary',
    from: null,
    fields: [
      f('invoice_number', 'Invoice Number'),
      f('date', 'Invoice Date', 'date'),
      f('due_date', 'Due Date', 'date'),
      f('currency', 'Currency'),
      f('amount', 'Total Amount', 'money'),
      f('purchase_order', 'Purchase Order'),
    ],
  },
  { id: 'buyer', title: 'Buyer', from: 'buyer_details', fields: PARTY_FIELDS },
  { id: 'seller', title: 'Seller', from: 'seller_details', fields: PARTY_FIELDS },
  {
    id: 'payment',
    title: 'Payment',
    from: 'payment_details',
    fields: [f('payment_terms', 'Payment Terms'), f('bank_details', 'Bank Details')],
  },
  {
    id: 'tax',
    title: 'Tax & Totals',
    from: 'extra_fields',
    fields: [f('subtotal_ex_tax', 'Subtotal (ex tax)', 'money'), f('vat_rate', 'VAT Rate')],
  },
  {
    id: 'trade',
    title: 'Trade & Shipping',
    from: 'extra_fields',
    fields: [
      f('purchase_order_number', 'PO Number'),
      f('purchase_order_date', 'PO Date', 'date'),
      f('incoterms', 'Incoterms'),
      f('country_of_origin', 'Country of Origin'),
      f('destination_country', 'Destination Country'),
      f('port_place_of_delivery', 'Port / Place of Delivery'),
      f('document_ref', 'Document Ref'),
    ],
  },
]

/** Keys handled elsewhere, so the unknown sweep must not claim them again. */
const HANDLED_ROOT_KEYS = new Set([
  'invoice_description',
  'buyer_details',
  'seller_details',
  'payment_details',
  'extra_fields',
])

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

export function buildSections(insights: Record<string, unknown>): {
  sections: SectionVM[]
  unknownKeys: string[]
} {
  const consumed = new Set<string>()
  const sections: SectionVM[] = []

  const payment = normalisePaymentDetails(insights.payment_details)

  for (const spec of SECTION_SPECS) {
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
      if (!(field.key in source)) continue

      const path =
        spec.from === 'payment_details'
          ? (payment.paths[field.key] ?? [...pathPrefix, field.key])
          : [...pathPrefix, field.key]

      fields.push(
        buildField(`${spec.id}.${field.key}`, field.label, source[field.key], field.kind, path),
      )

      consumed.add(spec.from === null ? field.key : `${spec.from}.${field.key}`)
    }

    if (fields.length > 0) {
      sections.push({ id: spec.id, title: spec.title, fields })
    }
  }

  // Sweep: anything at the root or inside extra_fields that no spec claimed.
  const leftovers: FieldVM[] = []
  const unknownKeys: string[] = []

  for (const [key, value] of Object.entries(insights)) {
    if (HANDLED_ROOT_KEYS.has(key) || consumed.has(key)) continue
    unknownKeys.push(key)
    leftovers.push(...expand(key, value, [key], `extra.${key}`))
  }

  const extraFields = asRecord(insights.extra_fields)
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      if (consumed.has(`extra_fields.${key}`)) continue
      unknownKeys.push(`extra_fields.${key}`)
      leftovers.push(...expand(key, value, ['extra_fields', key], `extra.extra_fields.${key}`))
    }
  }

  // Also sweep unclaimed keys inside the party sub-objects — an agent that adds
  // `buyer_details.contact_email` should not have it silently vanish.
  for (const parent of ['buyer_details', 'seller_details']) {
    const record = asRecord(insights[parent])
    if (!record) continue
    for (const [key, value] of Object.entries(record)) {
      if (consumed.has(`${parent}.${key}`)) continue
      unknownKeys.push(`${parent}.${key}`)
      leftovers.push(
        ...expand(`${titleCase(parent)} ${key}`, value, [parent, key], `extra.${parent}.${key}`),
      )
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
