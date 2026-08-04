import type { FieldKind, FieldSpec, SectionSpec } from '@/features/hitl/lib/types'
import { flagVerdict } from './readers'
import type { DocumentContract } from './types'

/**
 * The purchase order contract.
 *
 * **Provisional.** No PO payload has been observed yet, so this declares what a
 * purchase order plausibly carries rather than what one demonstrably does. Two
 * properties make that safe rather than speculative:
 *
 *  - field specs are optimistic — an absent key renders nothing, and a section
 *    with no present fields is not shown, so over-declaring is invisible;
 *  - every key we did *not* anticipate still renders, in Additional Fields, so
 *    a wrong guess here degrades to an ungrouped field, never to a missing one.
 *
 * Replace the guesses with the real shape once a PO payload lands; until then
 * nothing here can hide data from a reviewer.
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

const PARTY_FIELDS: FieldSpec[] = [
  f('name', 'Name'),
  f('gst_tin', 'Tax ID', 'text', ['tax_id']),
  f('address', 'Address'),
]

const SECTIONS: SectionSpec[] = [
  {
    id: 'summary',
    title: 'Purchase Order Summary',
    from: null,
    fields: [
      f('purchase_order_number', 'PO Number', 'text', ['po_number', 'purchase_order']),
      f('date', 'PO Date', 'date', ['purchase_order_date']),
      f('delivery_date', 'Delivery Date', 'date'),
      f('currency', 'Currency'),
      f('amount', 'Total Amount', 'money'),
    ],
  },
  { id: 'buyer', title: 'Buyer', from: 'buyer_details', fields: PARTY_FIELDS },
  { id: 'seller', title: 'Supplier', from: 'seller_details', fields: PARTY_FIELDS },
  {
    id: 'payment',
    title: 'Payment',
    from: 'payment_details',
    fields: [f('payment_terms', 'Payment Terms'), f('bank_details', 'Bank Details')],
  },
  {
    id: 'trade',
    title: 'Trade & Shipping',
    from: 'extra_fields',
    fields: [
      f('incoterms', 'Incoterms'),
      f('country_of_origin', 'Country of Origin'),
      f('destination_country', 'Destination Country'),
      f('port_place_of_delivery', 'Port / Place of Delivery'),
      f('document_ref', 'Document Ref'),
    ],
  },
]

export const purchaseOrderContract: DocumentContract = {
  id: 'purchase_order',
  label: 'Purchase Order',
  sections: SECTIONS,
  lineItems: {
    patterns: [/^order_description$/i, /line_?items?/i, /^items$/i, /description/i, /particulars/i],
  },

  /*
   * Empty on purpose, and the reason the whole reconciliation card is
   * contract-driven. A purchase order carries no VAT-inclusive total to
   * reconcile against, so the invoice's two checks would render as a card of
   * grey "not verifiable" rows — noise that teaches reviewers to skip the panel
   * on the documents where it does mean something.
   */
  reconciliation: [],

  /*
   * The tax-ID checks are registered on the reasonable bet that they use the
   * same `{ flag, message, errorCode }` shape as on an invoice. The bet is free:
   * a reader that does not recognise its input returns null, and the result
   * falls back to "Needs review" rather than to a wrong verdict.
   */
  evaluations: {
    validate_seller_gstin: {
      label: 'Is Supplier Tax Id Valid',
      order: 1,
      relatedPath: 'seller_details.gst_tin',
      read: flagVerdict({ pass: 'Valid Tax Id', fail: 'Invalid Tax Id' }),
    },
    validate_buyer_gstin: {
      label: 'Is Buyer Tax Id Valid',
      order: 2,
      relatedPath: 'buyer_details.gst_tin',
      read: flagVerdict({ pass: 'Valid Tax Id', fail: 'Invalid Tax Id' }),
    },
  },

  gates: [],
}
