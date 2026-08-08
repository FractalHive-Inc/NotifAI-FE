import { isRecord, stringify } from '@/features/hitl/lib/primitives'
import type { FieldKind, FieldPath, FieldSpec, SectionSpec } from '@/features/hitl/lib/types'
import { booleanVerdict, flagVerdict, readBoolean } from './readers'
import type { DecisionGate, DocumentContract, EvaluationContext } from './types'

/**
 * The commercial invoice contract.
 *
 * Field specs are optimistic: a field whose key is absent simply does not
 * render, and a section with no present fields is not shown at all. So
 * declaring a superset costs nothing, and an agent that starts sending a field
 * we already anticipated needs no change here.
 */

const f = (
  key: string,
  label: string,
  kind: FieldKind = 'text',
  aliases?: string[],
): FieldSpec => ({
  key,
  label,
  kind,
  aliases,
})

/**
 * `tax_id` is the name the agent's own type declares; `gst_tin` is what it
 * actually sends today. Registering both means the eventual rename is a no-op
 * rather than a field that silently drops into Additional Fields.
 */
const PARTY_FIELDS: FieldSpec[] = [
  f('name', 'Name'),
  f('gst_tin', 'Tax ID', 'text', ['tax_id']),
  f('address', 'Address'),
]

const SECTIONS: SectionSpec[] = [
  {
    id: 'summary',
    title: 'Invoice Summary',
    from: null,
    /*
     * The figures a reviewer checks against the document, in the order they
     * read: what it is, when it is due, what it answers, then what it costs.
     * Tax and total sit here and nowhere else — repeating them under a second
     * heading invites a reviewer to correct one copy and leave the other.
     */
    fields: [
      f('invoice_number', 'Invoice Number'),
      f('invoice_date', 'Invoice Date', 'date', ['date']),
      f('due_date', 'Due Date', 'date'),
      /*
       * The PO reference is an object now, carrying its own date. A dotted key
       * puts both under this heading, where a reviewer expects them, instead of
       * rendering the object as JSON. The bare alias keeps the older payload —
       * where `purchase_order` was the number itself — reading identically.
       */
      f('purchase_order.purchase_order_number', 'PO Number', 'text', ['purchase_order']),
      f('purchase_order.purchase_order_date', 'PO Date', 'date'),
      f('currency', 'Currency'),
      f('tax_amount', 'Tax Amount', 'money'),
      f('total_amount', 'Total Amount', 'money', ['amount']),
    ],
  },
  { id: 'buyer', title: 'Buyer', from: 'buyer_details', fields: PARTY_FIELDS },
  { id: 'seller', title: 'Seller', from: 'seller_details', fields: PARTY_FIELDS },
  {
    id: 'payment',
    title: 'Payment Details',
    from: 'payment_details',
    /*
     * Where the money is actually sent. It arrives as an array of single-key
     * objects — `[{bank_name}, {account_number}, {ifsc}]` — which the parser
     * merges; the older terms/bank-details pair stays declared beside the
     * account fields, since a document may carry either or both.
     */
    fields: [
      f('bank_name', 'Bank Name'),
      f('account_number', 'Account Number', 'text', ['account_no', 'bank_account_number']),
      f('ifsc', 'IFSC', 'text', ['ifsc_code']),
      f('swift', 'SWIFT', 'text', ['swift_code']),
      f('branch', 'Branch'),
      f('payment_terms', 'Payment Terms'),
      f('bank_details', 'Bank Details'),
    ],
  },
  {
    id: 'tax',
    title: 'Tax & Totals',
    from: 'extra_fields',
    fields: [
      f('subtotal', 'Subtotal (ex tax)', 'money', ['subtotal_ex_tax']),
      f('gst_rate', 'Tax Rate', 'text', ['vat_rate']),
      f('cgst', 'CGST', 'money'),
      f('sgst', 'SGST', 'money'),
      f('igst', 'IGST', 'money'),
    ],
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

/**
 * The PO reference written on the invoice itself, as opposed to whether a
 * matching PO exists in our records. Empty, whitespace, and absent all mean the
 * same thing: the document names no purchase order.
 *
 * Two shapes, because the agent changed one: `purchase_order` was the number
 * itself and is now an object carrying the number and its date. Reading the
 * object with `stringify` would yield a non-empty JSON string for *every*
 * invoice — including one whose number is `""` — which is precisely the case
 * this exists to catch, so the shape is discriminated rather than coerced.
 */
function poReference(insights: Record<string, unknown>): string {
  const value = insights.purchase_order

  if (isRecord(value)) return stringify(value.purchase_order_number ?? '').trim()

  return stringify(value ?? '').trim()
}

/**
 * An invoice with no PO reference cannot be approved.
 *
 * A gate rather than an evaluation outcome, because it must hold whether or not
 * the agent ran `is_purchase_order` — the fact is visible in `doc_insights`
 * alone, and an approval that slipped through because a check was missing would
 * be worse than one blocked by a check that never ran.
 */
const MISSING_PO_GATE: DecisionGate = {
  id: 'missing_po_reference',
  title: 'No purchase order referenced',
  reason:
    'This invoice does not reference a purchase order, so it cannot be approved. Reject it, or have the document corrected upstream.',
  relatedPath: ['purchase_order.purchase_order_number', 'purchase_order'],
  when: ({ insights }: EvaluationContext) => poReference(insights) === '',
}

/** Where the subtotal lives, current name first. */
const SUBTOTAL: FieldPath[] = [
  ['extra_fields', 'subtotal'],
  ['extra_fields', 'subtotal_ex_tax'],
]

/** The stated tax total, wherever the agent put it. */
const TAX_AMOUNT: FieldPath[] = [['tax_amount'], ['extra_fields', 'tax_amount']]

export const commercialInvoiceContract: DocumentContract = {
  id: 'commercial_invoice',
  label: 'Commercial Invoice',
  sections: SECTIONS,
  lineItems: {
    patterns: [
      /^invoice_description$/i,
      /line_?items?/i,
      /^items$/i,
      /description/i,
      /particulars/i,
    ],
  },
  /*
   * The invoice read bottom-up: the lines make the subtotal, the subtotal and
   * the tax make the total, and the tax splits into the components printed on
   * the document. Each row a reviewer could check by hand, checked for them.
   */
  reconciliation: [
    {
      id: 'lines_vs_subtotal',
      label: 'Line totals vs subtotal',
      subtotal: SUBTOTAL,
    },
    {
      id: 'subtotal_plus_tax_vs_total',
      label: 'Subtotal + tax vs total',
      subtotal: SUBTOTAL,
      taxAmount: TAX_AMOUNT,
      // Only consulted when no tax amount is stated — an older invoice carried
      // a VAT rate and no total tax line.
      taxRate: [
        ['extra_fields', 'gst_rate'],
        ['extra_fields', 'vat_rate'],
      ],
      total: [['total_amount'], ['amount']],
    },
    {
      id: 'tax_components_vs_tax_amount',
      label: 'Tax components vs tax amount',
      components: [
        ['extra_fields', 'cgst'],
        ['extra_fields', 'sgst'],
        ['extra_fields', 'igst'],
        ['extra_fields', 'cess'],
      ],
      taxAmount: TAX_AMOUNT,
    },
  ],

  evaluations: {
    is_duplicate: {
      label: 'Is Invoice Duplicated',
      order: 1,
      relatedPath: 'invoice_number',
      // Inverted: the check is named for the bad outcome, the payload reports
      // the good one. "Is Invoice Duplicated — Passed" reads backwards, so the
      // row states the answer instead.
      read: booleanVerdict({
        key: 'is_new',
        goodWhen: true,
        pass: 'No duplicate found',
        fail: 'Duplicate invoice',
        failHeadline: 'This invoice has already been processed',
        failDetail: 'Approving it again would pay the same invoice twice.',
      }),
    },

    validate_seller_gstin: {
      label: 'Is Seller Tax Id Valid',
      order: 2,
      // Both names the tax ID goes by, so the marker lands on whichever one
      // this payload used. The field renders from the same pair of aliases.
      relatedPath: ['seller_details.gst_tin', 'seller_details.tax_id'],
      read: flagVerdict({ pass: 'Valid Tax Id', fail: 'Invalid Tax Id' }),
    },

    validate_buyer_gstin: {
      label: 'Is Buyer Tax Id Valid',
      order: 3,
      relatedPath: ['buyer_details.gst_tin', 'buyer_details.tax_id'],
      read: flagVerdict({ pass: 'Valid Tax Id', fail: 'Invalid Tax Id' }),
    },

    is_amount_valid: {
      label: 'Is Amount Valid',
      order: 4,
      relatedPath: ['total_amount', 'amount'],
      read: booleanVerdict({
        key: 'is_amount_valid',
        goodWhen: true,
        pass: 'Valid Amount',
        fail: 'Invalid Amount',
        failDetail: 'Check the total against the line items and the document itself.',
      }),
    },

    is_purchase_order: {
      label: 'Purchase Order Status',
      order: 5,
      relatedPath: ['purchase_order.purchase_order_number', 'purchase_order'],
      /*
       * The only check that reads two sources, and the only one that is not a
       * verdict. Whether a PO is new or already on record is a fact about the
       * order, not a problem with the invoice — so it is stated and nothing is
       * asked of the reviewer.
       *
       * The exception is an invoice that references no PO at all. That is not a
       * status, it is a missing prerequisite, and it blocks approval.
       */
      read: (result, { insights }) => {
        if (poReference(insights) === '') {
          return {
            tone: 'BLOCKED',
            status: 'Not referenced',
            headline: 'This invoice does not reference a purchase order',
            detail: 'Approval is blocked until the document carries a PO reference.',
          }
        }

        const isNew = readBoolean(result, 'is_purchase_order_new')
        if (isNew === null) return null

        return isNew
          ? { tone: 'INFO', status: 'New purchase order' }
          : { tone: 'INFO', status: 'Existing purchase order' }
      },
    },
  },

  gates: [MISSING_PO_GATE],
}

/**
 * Names the agent has used for the seller's tax check before it was split in
 * two. Registered so an older payload still reads correctly instead of
 * dropping to "Needs review".
 */
for (const legacy of ['validate_gstin', 'validate_vendor_gstin']) {
  commercialInvoiceContract.evaluations[legacy] =
    commercialInvoiceContract.evaluations.validate_seller_gstin
}
