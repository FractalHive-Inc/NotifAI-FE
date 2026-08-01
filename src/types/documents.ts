export type DocumentType = 'INVOICE' | 'SUPPORTING_DOCUMENT' | 'UNCLASSIFIED'

export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export const DocumentType = {
  INVOICE: 'INVOICE' as const,
  SUPPORTING_DOCUMENT: 'SUPPORTING_DOCUMENT' as const,
  UNCLASSIFIED: 'UNCLASSIFIED' as const,
}

export const ProcessingStatus = {
  PENDING: 'PENDING' as const,
  PROCESSING: 'PROCESSING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const,
}

export interface Document {
  id: string
  email_id: string
  filename: string
  blob_storage_path: string
  blob_container_name: string
  file_size: number
  document_type: DocumentType
  po_number: string | null
  classification_confidence: number | null
  processing_status?: ProcessingStatus
  created_at: string
  updated_at: string
  email_sender?: string | null
  email_subject?: string | null
  email_received_at?: string | null
}

export interface DocumentProcessingJob {
  id: string
  document_id: string
  status: ProcessingStatus
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface DocumentListResponse {
  documents: Document[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}
