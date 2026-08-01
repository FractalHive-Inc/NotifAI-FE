import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/shared/lib/api'
import type { Document, DocumentListResponse, ProcessingStatus } from '@/types/documents'

interface DocumentFilters {
  documentType?: string
  poNumber?: string
  processingStatus?: string
}

export function useDocuments(page = 1, limit = 50, filters: DocumentFilters = {}) {
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (filters.documentType) queryParams.append('document_type', filters.documentType)
  if (filters.poNumber) queryParams.append('po_number', filters.poNumber)
  if (filters.processingStatus) queryParams.append('processing_status', filters.processingStatus)

  return useQuery({
    queryKey: ['documents', page, limit, filters],
    queryFn: async () => {
      const response = await api.get<{ data: DocumentListResponse }>(
        `/api/documents?${queryParams.toString()}`,
      )
      return response.data.data
    },
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const response = await api.get<{ data: { document: Document } }>(`/api/documents/${id}`)
      return response.data.data
    },
    enabled: !!id,
  })
}

export function useDocumentProcessingStatus(id: string) {
  return useQuery({
    queryKey: ['document-processing-status', id],
    queryFn: async () => {
      const response = await api.get<{
        data: { job: { status: ProcessingStatus; error_message: string | null } | null }
      }>(`/api/documents/${id}/processing-status`)
      return response.data.data
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data
      const status = data?.job?.status
      return status === 'PENDING' || status === 'PROCESSING' ? 5000 : false
    },
  })
}

export function useRetryProcessing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) => {
      const response = await api.post(`/api/documents/${documentId}/reprocess`)
      return response.data
    },
    onSuccess: (_, documentId) => {
      qc.invalidateQueries({ queryKey: ['document-processing-status', documentId] })
      qc.invalidateQueries({ queryKey: ['document', documentId] })
    },
  })
}
