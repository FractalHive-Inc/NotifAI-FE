import { useMutation } from '@tanstack/react-query'
import {
  uploadDocument,
  type UploadDocumentInput,
  type UploadDocumentResult,
} from '@/features/ingestion/lib/upload'

/**
 * Push a document to the ingestion service.
 *
 * No cache to invalidate: the upload lands in a different system, and what it
 * eventually produces reaches this app through its own pipeline rather than
 * through anything this query client holds.
 */
export function useDocumentUpload() {
  return useMutation<UploadDocumentResult, Error, UploadDocumentInput>({
    mutationFn: uploadDocument,
  })
}
