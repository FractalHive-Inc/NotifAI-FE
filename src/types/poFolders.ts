import type { ApprovalStatus, TallyPushStatus } from './approvals'

/**
 * Purchase order folders — every invoice filed against one PO.
 *
 * A folder is created by the backend the first time an approved invoice
 * references a PO number it has not seen. It is a grouping, not a location:
 * nothing moves in storage, and there are no "supporting documents" any more —
 * those belonged to the retired email pipeline, where a folder was a set of rows
 * in `nai.documents`. A folder now holds invoices and nothing else.
 */

export interface POFolder {
  id: string
  po_number: string
  created_at: string
  updated_at: string
  invoice_count: number
  /**
   * Null when the folder holds more than one currency — the backend refuses to
   * add those together, since the sum would look like money and not be any.
   */
  total_amount: number | null
  currency: string | null
  last_invoice_at: string | null
}

/**
 * An invoice as it appears inside its folder.
 *
 * Almost everything is nullable because it is projected from the agent's
 * extraction, which promises no field. `approval_id` is the link back to the
 * task the invoice was approved on, and the only navigation this list offers.
 */
export interface POFolderInvoice {
  id: string
  approval_id: string | null
  invoice_number: string | null
  vendor_name: string | null
  invoice_date: string | null
  invoice_total_amount: number | null
  invoice_currency: string | null
  /** From the approval, not the invoice — the approval is where status lives. */
  approval_status: ApprovalStatus | null
  tally_status: TallyPushStatus | null
  tally_voucher_id: string | null
  created_at: string
}

export interface POFolderDetail {
  po_folder: Pick<POFolder, 'id' | 'po_number' | 'created_at' | 'updated_at'>
  invoices: POFolderInvoice[]
}
