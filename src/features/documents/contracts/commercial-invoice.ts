import { stringify } from '@/features/hitl/lib/primitives'
import type { FieldKind, FieldSpec, SectionSpec } from '@/features/hitl/lib/types'
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

/**
 * The PO reference written on the invoice itself, as opposed to whether a
 * matching PO exists in our records. Empty, whitespace, and absent all mean the
 * same thing: the document names no purchase order.
 */
function poReference(insights: Record<string, unknown>): string {
  return stringify(insights.purchase_order ?? '').trim()
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
  relatedPath: 'purchase_order',
  when: ({ insights }: EvaluationContext) => poReference(insights) === '',
}

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
  reconciliation: [
    {
      id: 'lines_vs_subtotal',
      label: 'Line totals vs subtotal',
      subtotal: ['extra_fields', 'subtotal_ex_tax'],
    },
    {
      id: 'subtotal_plus_vat_vs_amount',
      label: 'Subtotal + VAT vs total',
      subtotal: ['extra_fields', 'subtotal_ex_tax'],
      vatRate: ['extra_fields', 'vat_rate'],
      amount: ['amount'],
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
      relatedPath: 'seller_details.gst_tin',
      read: flagVerdict({ pass: 'Valid Tax Id', fail: 'Invalid Tax Id' }),
    },

    validate_buyer_gstin: {
      label: 'Is Buyer Tax Id Valid',
      order: 3,
      relatedPath: 'buyer_details.gst_tin',
      read: flagVerdict({ pass: 'Valid Tax Id', fail: 'Invalid Tax Id' }),
    },

    is_amount_valid: {
      label: 'Is Amount Valid',
      order: 4,
      relatedPath: 'amount',
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
      relatedPath: 'purchase_order',
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
