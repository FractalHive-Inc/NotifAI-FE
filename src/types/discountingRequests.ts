import type { Invoice } from './invoices'

export interface DiscountingRequest {
  id: string
  invoice_id: string
  request_payload: Record<string, unknown>
  los_receipt_id: string | null
  sent_to_los_at: string | null
  created_at: string
  updated_at: string
  invoice_number?: string
  invoice_total_amount?: number
  vendor_name?: string | null
  po_number?: string
}

export interface DiscountingRequestDetail {
  discounting_request: DiscountingRequest
  invoice: Invoice | null
}

export interface DiscountingRequestListResponse {
  discounting_requests: DiscountingRequest[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

export interface DiscountingRequestStats {
  total: number
  pushed: number
  pending: number
  failed: number
  success_rate: number
}
