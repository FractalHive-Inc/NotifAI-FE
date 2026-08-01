export interface InvoiceLineItem {
  line_number: number
  description: string
  quantity: number
  unit_price: number
  line_amount: number
  tax_amount: number | null
  line_total: number
}

export interface Invoice {
  id: string
  document_id: string
  po_folder_id: string | null
  vendor_name: string | null
  vendor_gst_tin: string | null
  vendor_address: string | null
  invoice_number: string
  invoice_date: string
  invoice_due_date: string
  invoice_currency: string
  invoice_subtotal: number
  total_tax_amount: number
  total_discount_amount: number | null
  shipping_charges: number | null
  other_charges: number | null
  invoice_total_amount: number
  payment_terms: string | null
  is_approved: boolean
  approved_at: string | null
  approved_by: string | null
  has_duplicate_warning: boolean
  po_number?: string
  line_items: InvoiceLineItem[]
}

export interface InvoiceListResponse {
  invoices: Invoice[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}
