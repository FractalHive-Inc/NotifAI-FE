import { AlertCircle, Check, Copy, Inbox } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert/alert'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Button } from '@/shared/components/ui/button/button'
import { Separator } from '@/shared/components/ui/separator/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet/sheet'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import { useIngestionRequests } from '@/shared/hooks/useProcessingJobs'
import { formatDate, formatDuration } from '@/shared/lib/formatters'
import type { ProcessingJob } from '@/types/ingestion'
import { isTerminalStatus, jobElapsedMs, processingJobStatusLabel } from '@/types/ingestion'
import { statusBadgeVariant } from '@/features/ingestion/lib/status'

/**
 * Ids here are 32-char hex with no internal structure, so there is nothing to
 * read in them — they exist to be pasted into a log search. Hence copy as the
 * primary affordance rather than selectable text.
 *
 * `navigator.clipboard` is missing outside a secure context, which is not
 * hypothetical: the dev server reached over the LAN is exactly that case. The
 * button reports failure rather than silently doing nothing.
 */
function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex items-start gap-1">
      <code className="min-w-0 flex-1 break-all font-mono text-xs text-[#0f172a]">{value}</code>
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="text-sm text-[#0f172a]">{children}</div>
    </div>
  )
}

interface RequestDetailSheetProps {
  /**
   * The row being shown. Deliberately outlives `open` — the caller leaves it set
   * after closing so the panel stays populated on its way out rather than
   * flashing empty for the length of the slide-out.
   */
  job: ProcessingJob | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Everything known about one incoming request.
 *
 * Split across two sources by necessity: the job's status and timing came with
 * the row already, while who sent it and under what thread needs a second call
 * keyed on the job id. Only the second half can be loading or failing, so the
 * top of the sheet stays populated throughout.
 */
export default function RequestDetailSheet({ job, open, onOpenChange }: RequestDetailSheetProps) {
  const { data: requests, isLoading, error } = useIngestionRequests(job?.id ?? null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {job && (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle>Incoming request</SheetTitle>
              <SheetDescription>Received {formatDate(job.created_at)}</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-6">
              <div className="flex items-center gap-2">
                <Badge variant={statusBadgeVariant(job.status)}>
                  {processingJobStatusLabel(job.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {isTerminalStatus(job.status) ? 'took' : 'running for'}{' '}
                  {formatDuration(jobElapsedMs(job))}
                </span>
              </div>

              <Field label="Processing job ID">
                <CopyableValue value={job.id} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Received at">{formatDate(job.created_at)}</Field>
                <Field label="Last updated">{formatDate(job.updated_at)}</Field>
              </div>

              <Separator />

              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Could not load the request details</AlertTitle>
                  <AlertDescription>{(error as Error).message}</AlertDescription>
                </Alert>
              ) : !requests || requests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8efff]">
                    <Inbox className="h-5 w-5 text-[#043463]" />
                  </div>
                  <p className="text-sm font-medium text-[#0f172a]">No request recorded</p>
                  <p className="text-sm text-muted-foreground">
                    The job exists but nothing was attached to it.
                  </p>
                </div>
              ) : (
                requests.map((request, index) => (
                  <div key={request.id} className="space-y-4">
                    {/* One job holds one request today. The heading only earns its
                        place once that stops being true. */}
                    {requests.length > 1 && (
                      <p className="text-sm font-medium text-[#0f172a]">Request {index + 1}</p>
                    )}
                    <Field label="Source">{request.source_id}</Field>
                    <Field label="Thread ID">
                      <CopyableValue value={request.thread_id} />
                    </Field>
                    <Field label="Request ID">
                      <CopyableValue value={request.id} />
                    </Field>
                    <Field label="Landed at">{formatDate(request.received_at)}</Field>
                    {index < requests.length - 1 && <Separator />}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
