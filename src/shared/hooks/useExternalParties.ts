import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/shared/lib/api'
import type { ExternalParty, ExternalPartyInput } from '@/types/externalParties'

const PARTIES_QUERY = ['external-parties']

export function useExternalParties() {
  return useQuery({
    queryKey: PARTIES_QUERY,
    queryFn: async () => {
      const response = await api.get<{ data: { external_parties: ExternalParty[] } }>(
        '/api/external-parties',
      )
      return response.data.data.external_parties
    },
  })
}

export function useCreateExternalParty() {
  const qc = useQueryClient()
  return useMutation<ExternalParty, Error, ExternalPartyInput>({
    mutationFn: async (input) => {
      const response = await api.post<{ data: { external_party: ExternalParty } }>(
        '/api/external-parties',
        input,
      )
      return response.data.data.external_party
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PARTIES_QUERY })
    },
  })
}

export function useUpdateExternalParty() {
  const qc = useQueryClient()
  return useMutation<ExternalParty, Error, { id: string; input: ExternalPartyInput }>({
    mutationFn: async ({ id, input }) => {
      const response = await api.put<{ data: { external_party: ExternalParty } }>(
        `/api/external-parties/${id}`,
        input,
      )
      return response.data.data.external_party
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PARTIES_QUERY })
    },
  })
}

export function useDeleteExternalParty() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/api/external-parties/${id}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PARTIES_QUERY })
    },
  })
}
