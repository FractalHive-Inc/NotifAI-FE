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
  // Driven off the key rather than a hand-written line per field, so adding a
  // filter to ApprovalFilters is one edit, not two. Zero is a meaningful bound
  // for the confidence range, so only null/undefined/'' are dropped.
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    // Multi-select filters are lists, sent comma-separated — the shape the API's
    // query schema parses. An empty one means nothing was ticked, which is no
    // filter rather than a filter matching nothing.
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      queryParams.append(key, value.join(','))
      continue
    }
    queryParams.append(key, String(value))
  }

  return useQuery({
    queryKey: ['approvals', page, limit, filters],
    queryFn: async () => {
      const response = await api.get<{ data: ApprovalListResponse }>(
        `/api/approvals?${queryParams.toString()}`,
      )
      return response.data.data
    },
    // The task inbox is operational data: when a reviewer returns to the page,
    // showing a cached list from minutes ago is misleading. Override the
    // app-wide five-minute freshness so mount/navigation always rechecks.
    staleTime: 0,
    refetchOnMount: 'always',
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
