import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/shared/lib/api'
import type { Invoice, InvoiceListResponse } from '@/types/invoices'

interface InvoiceFilters {
  isApproved?: string
  hasDuplicate?: boolean
  poNumber?: string
  vendorName?: string
}

export function useInvoices(page = 1, limit = 20, filters: InvoiceFilters = {}) {
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (filters.isApproved) queryParams.append('is_approved', filters.isApproved)
  if (filters.hasDuplicate) queryParams.append('has_duplicate', 'true')
  if (filters.poNumber) queryParams.append('po_number', filters.poNumber)
  if (filters.vendorName) queryParams.append('vendor_name', filters.vendorName)

  return useQuery({
    queryKey: ['invoices', page, limit, filters],
    queryFn: async () => {
      const response = await api.get<{ data: InvoiceListResponse }>(
        `/api/invoices?${queryParams.toString()}`,
      )
      return response.data.data
    },
  })
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const response = await api.get<{
        data: {
          invoice: Invoice
          line_items: Invoice['line_items']
          document: { po_number?: string | null }
        }
      }>(`/api/invoices/${id}`)
      return {
        ...response.data.data.invoice,
        line_items: response.data.data.line_items || [],
        po_number: response.data.data.document?.po_number || response.data.data.invoice.po_number,
      }
    },
    enabled: !!id,
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Invoice> }) => {
      const response = await api.put<{ data: { invoice: Invoice } }>(`/api/invoices/${id}`, data)
      return response.data.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['invoice', variables.id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useUncategoriseInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/api/invoices/${id}/uncategorise`)
      return response.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}
