import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/shared/lib/api'
import type {
  DiscountingRequestDetail,
  DiscountingRequestListResponse,
  DiscountingRequestStats,
} from '@/types/discountingRequests'

interface DiscountingRequestFilters {
  page?: number
  limit?: number
  has_receipt?: boolean
  date_from?: string
  date_to?: string
}

export function useDiscountingRequests(filters: DiscountingRequestFilters = {}) {
  const queryParams = new URLSearchParams()
  if (filters.page) queryParams.append('page', String(filters.page))
  if (filters.limit) queryParams.append('limit', String(filters.limit))
  if (filters.has_receipt !== undefined)
    queryParams.append('has_receipt', String(filters.has_receipt))
  if (filters.date_from) queryParams.append('date_from', filters.date_from)
  if (filters.date_to) queryParams.append('date_to', filters.date_to)

  return useQuery({
    queryKey: ['discounting-requests', filters],
    queryFn: async () => {
      const response = await api.get<{ data: DiscountingRequestListResponse }>(
        `/api/discounting-requests?${queryParams.toString()}`,
      )
      return response.data.data
    },
  })
}

export function useDiscountingRequestDetail(id: string) {
  return useQuery({
    queryKey: ['discounting-request', id],
    queryFn: async () => {
      const response = await api.get<{ data: DiscountingRequestDetail }>(
        `/api/discounting-requests/${id}`,
      )
      return response.data.data
    },
    enabled: !!id,
  })
}

export function usePushToLOS() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<{
        data: { los_receipt_id: string; status: string; push_log: unknown }
      }>(`/api/discounting-requests/${id}/push`)
      return response.data.data
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['discounting-request', id] })
      qc.invalidateQueries({ queryKey: ['discounting-requests'] })
      qc.invalidateQueries({ queryKey: ['discounting-request-stats'] })
      qc.invalidateQueries({ queryKey: ['los-logs'] })
    },
  })
}

export function useRetryPushDR() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<{
        data: { los_receipt_id: string; status: string; push_log: unknown }
      }>(`/api/discounting-requests/${id}/retry-push`)
      return response.data.data
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['discounting-request', id] })
      qc.invalidateQueries({ queryKey: ['discounting-requests'] })
      qc.invalidateQueries({ queryKey: ['discounting-request-stats'] })
      qc.invalidateQueries({ queryKey: ['los-logs'] })
    },
  })
}

export function useDiscountingRequestStats() {
  return useQuery({
    queryKey: ['discounting-request-stats'],
    queryFn: async () => {
      const response = await api.get<{ data: DiscountingRequestListResponse }>(
        '/api/discounting-requests?limit=1000',
      )
      const requests = response.data.data.discounting_requests
      const total = requests.length
      const pushed = requests.filter((r) => r.los_receipt_id).length
      const pending = requests.filter((r) => !r.los_receipt_id).length
      return {
        total,
        pushed,
        pending,
        failed: 0,
        success_rate: total > 0 ? (pushed / total) * 100 : 0,
      } as DiscountingRequestStats
    },
  })
}
