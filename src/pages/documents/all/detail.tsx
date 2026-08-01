import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Button } from '@/shared/components/ui/button/button'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert/alert'
import { Separator } from '@/shared/components/ui/separator/separator'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import {
  useDocument,
  useDocumentProcessingStatus,
  useRetryProcessing,
} from '@/shared/hooks/useDocuments'
import { ProcessingStatus } from '@/types/documents'
import { formatFileSize } from '@/shared/lib/formatters'
import { API_URL } from '@/config/env'

function getStatusBadgeVariant(
  status: string,
): 'outline' | 'secondary' | 'success' | 'destructive' {
  if (status === ProcessingStatus.COMPLETED) return 'success'
  if (status === ProcessingStatus.FAILED) return 'destructive'
  if (status === ProcessingStatus.PROCESSING) return 'secondary'
  return 'outline'
}

function buildDownloadUrl(id: string) {
  if (!id) return ''
  const token = localStorage.getItem('token')
  if (!token) return ''
  return `${API_URL}/api/documents/${id}/download?token=${encodeURIComponent(token)}`
}

function getStatusLabel(status: string) {
  if (status === ProcessingStatus.PENDING) return 'Pending'
  if (status === ProcessingStatus.PROCESSING) return 'Processing'
  if (status === ProcessingStatus.COMPLETED) return 'Completed'
  return 'Failed'
}

export default function DocumentDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  const pdfUrl = useMemo(() => buildDownloadUrl(id), [id])

  const { data: documentData, isLoading: docLoading } = useDocument(id)
  const { data: processingData, isLoading: statusLoading } = useDocumentProcessingStatus(id)
  const retryMutation = useRetryProcessing()

  const handleBack = () => navigate('/documents/all')

  const handleRetry = async () => {
    try {
      await retryMutation.mutateAsync(id)
    } catch (err) {
      console.error('Failed to retry processing:', err)
    }
  }

  if (docLoading || statusLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-52" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[7fr_5fr]">
          <Skeleton className="h-[520px] w-full rounded-xl" />
          <Skeleton className="h-[520px] w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!documentData) {
    return (
      <div className="space-y-4">
        <Alert className="border-red-200 bg-red-50 text-red-700">
          <AlertDescription>Document not found</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to Documents
        </Button>
      </div>
    )
  }

  const { document } = documentData
  const processingJob = processingData?.job

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-xl font-semibold text-[#043463] sm:text-2xl">Document Details</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[7fr_5fr]">
        <Card className="rounded-xl border-[#e4e7ec] shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Document Preview</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (pdfUrl) window.open(pdfUrl, '_blank')
              }}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </CardHeader>
          <CardContent>
            <Separator className="mb-3" />
            {pdfUrl ? (
              <div className="h-[calc(100vh-300px)] w-full overflow-hidden rounded-md border border-border">
                <iframe src={pdfUrl} className="h-full w-full border-0" title="Document Preview" />
              </div>
            ) : (
              <div className="flex h-[calc(100vh-300px)] w-full items-center justify-center rounded-md border border-border">
                <p className="text-sm text-muted-foreground">No preview available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-[#e4e7ec] shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Document Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground">Filename</p>
              <p className="text-sm font-medium break-all">{document.filename}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <div className="mt-1">
                <Badge variant="outline">{document.document_type}</Badge>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">File Size</p>
              <p className="text-sm font-medium">{formatFileSize(document.file_size)}</p>
            </div>

            {document.po_number && (
              <div>
                <p className="text-xs text-muted-foreground">PO Number</p>
                <p className="text-sm font-medium">{document.po_number}</p>
              </div>
            )}

            {document.classification_confidence !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Classification Confidence</p>
                <p className="text-sm font-medium">{document.classification_confidence}%</p>
              </div>
            )}

            <Separator />

            {processingJob && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Processing Status</p>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(processingJob.status)}>
                      {getStatusLabel(processingJob.status)}
                    </Badge>
                  </div>
                </div>

                {processingJob.status === ProcessingStatus.FAILED && (
                  <Alert className="border-red-200 bg-red-50 text-red-700">
                    <AlertTitle>Processing failed</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>{processingJob.error_message || 'Processing failed'}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRetry}
                        disabled={retryMutation.isPending}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {processingJob.status === ProcessingStatus.PROCESSING && (
                  <Alert>
                    <AlertDescription>Document is being processed...</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
