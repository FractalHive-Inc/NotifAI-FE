/**
 * View-model types for the agent's `doc_insights`.
 *
 * The agent's payload is loose: every field is optional, types are unverified,
 * and key names are human-readable strings that drift. These types are the
 * boundary — everything past `parseDocInsights` is typed and total, so no UI
 * component has to guess or defend.
 */

export type WarningCode =
  | 'NOT_AN_OBJECT'
  | 'LINE_ITEMS_MISSING'
  | 'LINE_ITEMS_UNRECOGNISED'
  | 'RAGGED_LINE_ITEMS'
  | 'UNPARSEABLE_MONEY'
  | 'UNPARSEABLE_DATE'
  | 'RECONCILE_INCOMPUTABLE'
  | 'RECONCILE_MISMATCH'

export interface Warning {
  code: WarningCode
  message: string
  detail?: unknown
}

/**
 * How a money string was originally written, so an edit can be written back in
 * the same shape.
 *
 * Re-emitting `24118.8` where the agent sent `"PHP 24,118.80"` changes the
 * field's *type* in a payload the agent will read back — a silent contract
 * break. Capturing the format is what makes editing safe.
 */
export interface MoneyFormat {
  /** Currency written before the number, e.g. `PHP ` in `PHP 24,118.80`. */
  prefix: string
  /** Currency written after the number, e.g. ` USD` in `1,234.00 USD`. */
  suffix: string
  groupSeparator: '' | ',' | '.' | ' '
  decimalSeparator: '.' | ','
  decimals: number
  /** True when the source was a JSON number rather than a string. */
  numeric: boolean
  parenthesisedNegative: boolean
}

export interface MoneyValue {
  kind: 'money'
  /** Exactly what the agent sent, rendered verbatim. */
  raw: string
  /** Parsed for arithmetic only. Null when unparseable. */
  value: number | null
  currency: string | null
  format: MoneyFormat
}

export interface DateValue {
  kind: 'date'
  raw: string
  /** ISO yyyy-mm-dd, or null when the string is not a valid DD/MM/YYYY date. */
  iso: string | null
  /** The separator the agent used, preserved for write-back. */
  separator: string
}

export interface TextValue {
  kind: 'text'
  raw: string
}

export interface ListValue {
  kind: 'list'
  raw: string
  items: string[]
}

/** Anything with no better representation. Rendered as formatted JSON. */
export interface RawValue {
  kind: 'raw'
  raw: string
  json: unknown
}

export type FieldValue = MoneyValue | DateValue | TextValue | ListValue | RawValue

export type FieldKind = FieldValue['kind']

/** A path into the original `doc_insights`, used to write edits back. */
export type FieldPath = Array<string | number>

export interface FieldVM {
  /** Stable identity for React keys and edit bookkeeping. */
  id: string
  label: string
  value: FieldValue
  path: FieldPath
  /** False for values we cannot safely write back, e.g. nested raw JSON. */
  editable: boolean
}

export interface SectionVM {
  id: string
  title: string
  fields: FieldVM[]
}

export interface LineItemColumnVM {
  id: string
  label: string
  /** The original key in `invoice_description`, needed to write edits back. */
  sourceKey: string
  kind: FieldKind
}

export interface LineItemsVM {
  columns: LineItemColumnVM[]
  /** Row-major. A null cell means that column had no value at this index. */
  rows: Array<Array<FieldValue | null>>
  /** True when the source arrays had differing lengths. Blocks editing. */
  ragged: boolean
  /** Per-source-key lengths, for the misalignment warning. */
  lengths: Record<string, number>
  /** The key `invoice_description` was read from, for write-back. */
  sourceKey: string | null
}

/**
 * How one field is found and rendered. Declared per document type in
 * `features/documents/contracts`, never inferred.
 */
export interface FieldSpec {
  key: string
  label: string
  kind: FieldKind
  /**
   * Other keys the agent may use for the same field, tried in order after
   * `key`. This is how a rename lands without a breaking change: register the
   * new name as an alias, and both payloads render identically.
   */
  aliases?: string[]
}

export interface SectionSpec {
  id: string
  title: string
  /** `null` reads from the root of doc_insights; otherwise from that sub-object. */
  from: string | null
  fields: FieldSpec[]
}

/**
 * Where one operand may live. Candidates are tried in order and the first that
 * is *present* wins, which is how one spec covers a field the agent has renamed
 * — `total_amount` today, `amount` in an older payload — without declaring the
 * same arithmetic twice.
 */
export type OperandPaths = FieldPath[]

/**
 * An arithmetic check a document type asks for. The arithmetic lives in
 * `reconcile.ts`; only *where to read the operands* varies per document, so
 * that is all a contract declares.
 */
export type ReconcileSpec =
  | { id: 'lines_vs_subtotal'; label: string; subtotal: OperandPaths }
  | {
      id: 'subtotal_plus_tax_vs_total'
      label: string
      subtotal: OperandPaths
      /** The stated tax, preferred over deriving it from a rate. */
      taxAmount: OperandPaths
      /** Used only when no tax amount is stated. */
      taxRate: OperandPaths
      total: OperandPaths
    }
  | {
      id: 'tax_components_vs_tax_amount'
      label: string
      /** Every component that may be present, *summed* — not candidates. */
      components: FieldPath[]
      taxAmount: OperandPaths
    }

export interface ReconcileCheck {
  id: ReconcileSpec['id']
  label: string
  /** Minor units (cents). Null when an input was missing or unparseable. */
  expectedMinor: number | null
  actualMinor: number | null
  deltaMinor: number | null
  currency: string | null
  status: 'OK' | 'MISMATCH' | 'INCOMPUTABLE'
  /** Why it could not be computed. Shown so a grey row is never mysterious. */
  reason?: string
}

export interface DocInsightsVM {
  sections: SectionVM[]
  lineItems: LineItemsVM
  reconciliation: ReconcileCheck[]
  warnings: Warning[]
  /** Keys present in the input that no section claimed. Diagnostic only. */
  unknownKeys: string[]
  /** The untouched input, for the Raw JSON panel. */
  raw: unknown
}
