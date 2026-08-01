import { useQuery } from '@tanstack/react-query'
import api from '@/shared/lib/api'

export interface DashboardStats {
  total_emails: number
  total_documents: number
  total_invoices: number
  pending_reviews: number
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get<{ data: DashboardStats }>('/api/dashboard/stats')
      return response.data.data
    },
  })
}
