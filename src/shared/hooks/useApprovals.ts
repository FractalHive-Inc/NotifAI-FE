import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/shared/lib/api'
import type {
  Approval,
  ApprovalDetail,
  ApprovalFilters,
  ApprovalListResponse,
  DecisionInput,
  DocumentUrlResponse,
} from '@/types/approvals'

/** The reviewer's task inbox. Scoping to the caller happens server-side. */
export function useApprovals(page = 1, limit = 20, filters: ApprovalFilters = {}) {
  const queryParams = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (filters.status) queryParams.append('status', filters.status)
  if (filters.use_case) queryParams.append('use_case', filters.use_case)
  if (filters.source) queryParams.append('source', filters.source)

  return useQuery({
    queryKey: ['approvals', page, limit, filters],
    queryFn: async () => {
      const response = await api.get<{ data: ApprovalListResponse }>(
        `/api/approvals?${queryParams.toString()}`,
      )
      return response.data.data
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })
}

export function useApproval(id: string) {
  return useQuery({
    queryKey: ['approval', id],
    queryFn: async () => {
      const response = await api.get<{ data: { approval: ApprovalDetail } }>(`/api/approvals/${id}`)
      return response.data.data.approval
    },
    enabled: !!id,
  })
}

/**
 * The document preview URL.
 *
 * `retry: false` is deliberate: the provider returns 501 when the external
 * presigned-URL service is not configured, and retrying a definitive "not
 * available" three times just delays the placeholder by a few seconds.
 */
export function useApprovalDocumentUrl(id: string) {
  return useQuery({
    queryKey: ['approval-document-url', id],
    queryFn: async () => {
      const response = await api.get<{ data: DocumentUrlResponse }>(
        `/api/approvals/${id}/document-url`,
      )
      return response.data.data
    },
    enabled: !!id,
    retry: false,
    // Presigned URLs expire; don't hand a stale one to the iframe on remount.
    staleTime: 0,
  })
}

export function useSubmitDecision() {
  const qc = useQueryClient()

  return useMutation<Approval, Error, { id: string; input: DecisionInput }>({
    mutationFn: async ({ id, input }) => {
      const response = await api.post<{ data: { approval: Approval } }>(
        `/api/approvals/${id}/decision`,
        input,
      )
      return response.data.data.approval
    },
    onSuccess: (_result, variables) => {
      void qc.invalidateQueries({ queryKey: ['approval', variables.id] })
      void qc.invalidateQueries({ queryKey: ['approvals'] })
      void qc.invalidateQueries({ queryKey: ['po-folders'] })
    },
  })
}

export function useRetryDelivery() {
  const qc = useQueryClient()

  return useMutation<Approval, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const response = await api.post<{ data: { approval: Approval } }>(
        `/api/approvals/${id}/retry-callback`,
      )
      return response.data.data.approval
    },
    onSuccess: (_result, variables) => {
      void qc.invalidateQueries({ queryKey: ['approval', variables.id] })
      void qc.invalidateQueries({ queryKey: ['approvals'] })
      void qc.invalidateQueries({ queryKey: ['approval-tally-logs', variables.id] })
    },
  })
}
