import { useMemo } from 'react'
import { Download, FileText, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useApprovalDocumentUrl } from '@/shared/hooks/useApprovals'
import { describeDocumentFailure } from '@/features/hitl/lib/document-preview-error'
import { API_URL } from '@/config/env'

/**
 * The document itself, beside the extracted data.
 *
 * The iframe points at our own backend, not at the blob's SAS URL. The backend
 * proxies the bytes so it can declare a real `Content-Type` (blobs come back as
 * `application/octet-stream`, which an iframe downloads instead of rendering)
 * and so the SAS URL — a 24-hour unauthenticated read token for a customer
 * document — never reaches the browser.
 *
 * Auth rides in the query string because an iframe cannot set an Authorization
 * header. This mirrors the existing `/api/documents/:id/download` pattern.
 */
export default function DocumentPreviewPane({ approvalId }: { approvalId: string }) {
  // Availability is probed through the URL endpoint rather than by watching the
  // iframe: an iframe reports no error we can read, so a missing document would
  // otherwise render as a silent blank pane.
  const { data, isLoading, isError, error, refetch, isFetching } =
    useApprovalDocumentUrl(approvalId)

  const src = useMemo(() => {
    if (!data) return ''
    const token = localStorage.getItem('token')
    if (!token) return ''
    return `${API_URL}/api/approvals/${approvalId}/document?token=${encodeURIComponent(token)}`
  }, [approvalId, data])

  // Why it failed decides what the placeholder says *and* whether retrying is
  // offered at all — see document-preview-error.ts.
  const failure = describeDocumentFailure(isError ? error : null)

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Document</span>
        {src && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="xs" asChild>
              <a href={`${src}&download=true`} download>
                <Download className="h-3 w-3" />
                Download
              </a>
            </Button>
            <Button variant="ghost" size="xs" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-full w-full rounded-md" />
      ) : src ? (
        <iframe
          src={src}
          className="h-full w-full rounded-md border border-[#e4e7ec] bg-white"
          title="Document preview"
          /*
           * Sandboxed only for converted documents, and that condition is load-
           * bearing in both directions.
           *
           * Word files are converted to HTML server-side and served from our own
           * origin, so the pane is showing markup derived from a file an
           * external party uploaded. An empty sandbox gives it an opaque origin
           * and no script, form, or navigation rights — it can only be looked
           * at. The backend sends a matching CSP; neither alone is enough.
           *
           * A PDF must not be sandboxed: Chrome's PDF viewer will not start in a
           * sandboxed frame and renders a broken-document placeholder instead.
           * Nothing is given up by omitting it — a PDF renders inside the
           * browser's own viewer, not as a document on our origin, and the
           * response carries `nosniff` with an explicit type so a mislabelled
           * blob cannot become HTML.
           */
          sandbox={data?.converted ? '' : undefined}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[#e4e7ec] p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8efff]">
            <FileText className="h-6 w-6 text-[#043463]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#0f172a]">{failure.title}</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">{failure.detail}</p>
            {/*
              Said on every failure, because it is the one thing that stays true
              whatever went wrong: the preview is a fidelity aid, and the review
              itself is unblocked without it.
            */}
            <p className="mt-2 max-w-xs text-xs text-muted-foreground">
              You can still review and correct the extracted fields below.
            </p>
          </div>
          {failure.retryable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
