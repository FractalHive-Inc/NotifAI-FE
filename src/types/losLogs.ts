export type LOSPushStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface LOSPushLog {
  id: string
  discounting_request_id: string
  request_payload: Record<string, unknown>
  response_payload: Record<string, unknown> | null
  status: LOSPushStatus
  error_message: string | null
  sent_at: string
  created_at: string
  invoice_number?: string
  invoice_total_amount?: number
}

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
}

export interface LOSPushLogDetail {
  log: LOSPushLog
  discounting_request: DiscountingRequest | null
}

export interface LOSPushLogListResponse {
  logs: LOSPushLog[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

export interface LOSLogStats {
  total: number
  success_count: number
  failed_count: number
  success_rate: number
  avg_response_time: number | null
}
