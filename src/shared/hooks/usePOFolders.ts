import { useQuery } from '@tanstack/react-query'
import api from '@/shared/lib/api'
import type { POFolder, POFolderDetail } from '@/types/poFolders'

export function usePOFolders() {
  return useQuery({
    queryKey: ['po-folders'],
    queryFn: async () => {
      const response = await api.get<{ data: { po_folders: POFolder[] } }>('/api/po-folders')
      return response.data.data.po_folders
    },
  })
}

export function usePOFolder(id: string) {
  return useQuery({
    queryKey: ['po-folder', id],
    queryFn: async () => {
      const response = await api.get<{ data: POFolderDetail }>(`/api/po-folders/${id}`)
      return response.data.data
    },
    enabled: !!id,
  })
}
