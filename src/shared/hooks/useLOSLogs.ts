import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/shared/lib/api'
import type {
  LOSLogStats,
  LOSPushLogDetail,
  LOSPushLogListResponse,
  LOSPushStatus,
} from '@/types/losLogs'

interface LOSLogFilters {
  page?: number
  limit?: number
  status?: LOSPushStatus
  date_from?: string
  date_to?: string
  invoice_number?: string
}

interface LOSLogsOptions {
  refetchInterval?: number
}

export function useLOSLogs(filters: LOSLogFilters = {}, options?: LOSLogsOptions) {
  const queryParams = new URLSearchParams()
  if (filters.page) queryParams.append('page', String(filters.page))
  if (filters.limit) queryParams.append('limit', String(filters.limit))
  if (filters.status) queryParams.append('status', filters.status)
  if (filters.date_from) queryParams.append('date_from', filters.date_from)
  if (filters.date_to) queryParams.append('date_to', filters.date_to)
  if (filters.invoice_number) queryParams.append('invoice_number', filters.invoice_number)

  return useQuery({
    queryKey: ['los-logs', filters],
    queryFn: async () => {
      const response = await api.get<{ data: LOSPushLogListResponse }>(
        `/api/los-logs?${queryParams.toString()}`,
      )
      return response.data.data
    },
    refetchInterval: options?.refetchInterval,
  })
}

export function useLOSLogDetail(id: string) {
  return useQuery({
    queryKey: ['los-log', id],
    queryFn: async () => {
      const response = await api.get<{ data: LOSPushLogDetail }>(`/api/los-logs/${id}`)
      return response.data.data
    },
    enabled: !!id,
  })
}

export function useLOSLogStats() {
  return useQuery({
    queryKey: ['los-log-stats'],
    queryFn: async () => {
      const response = await api.get<{ data: LOSPushLogListResponse }>('/api/los-logs?limit=1000')
      const logs = response.data.data.logs
      const total = logs.length
      const success_count = logs.filter((l) => l.status === 'SUCCESS').length
      const failed_count = logs.filter((l) => l.status === 'FAILED').length
      const success_rate = total > 0 ? (success_count / total) * 100 : 0
      return {
        total,
        success_count,
        failed_count,
        success_rate,
        avg_response_time: null,
      } as LOSLogStats
    },
  })
}

export function useRetryPush() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: async (discountingRequestId: string) => {
      const response = await api.post(
        `/api/discounting-requests/${discountingRequestId}/retry-push`,
      )
      return response.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['los-logs'] })
      qc.invalidateQueries({ queryKey: ['los-log-stats'] })
      qc.invalidateQueries({ queryKey: ['los-log'] })
    },
  })
}
