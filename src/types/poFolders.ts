import type { ProcessingStatus } from './documents'

export interface POFolder {
  id: string
  po_number: string
  created_at: string
  updated_at: string
  invoice_count?: number
  supporting_doc_count?: number
}

export interface POFolderInvoice {
  id: string
  invoice_id: string
  filename: string
  processing_status: ProcessingStatus | null
  is_approved: boolean
}

export interface POFolderSupportingDoc {
  id: string
  filename: string
  file_size: number
  created_at: string
}

export interface POFolderDetail {
  po_folder: POFolder
  invoices: POFolderInvoice[]
  supporting_documents: POFolderSupportingDoc[]
}
