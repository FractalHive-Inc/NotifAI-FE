import type { ColumnDef } from '@/shared/components/ui/table'
import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { statusBadgeVariant } from '@/features/ingestion/lib/status'
import type { JobRequestState } from '@/shared/hooks/useProcessingJobs'
import { formatDate, formatDuration } from '@/shared/lib/formatters'
import type { ProcessingJob } from '@/types/ingestion'
import {
  ingestionFilename,
  isTerminalStatus,
  jobElapsedMs,
  processingJobStatusLabel,
} from '@/types/ingestion'

/**
 * Built as a factory rather than a constant because three of the five columns
 * render data that does not live on the job: it arrives from a per-row detail
 * call, keyed by job id. Closing over that map keeps the cells plain functions
 * and avoids augmenting TanStack's `TableMeta` just to smuggle it through.
 */
export function createIngestionColumns(
  requestsByJob: Map<string, JobRequestState>,
): ColumnDef<ProcessingJob>[] {
  return [
    {
      id: 'filename',
      header: 'Document Name',
      enableSorting: false,
      cell: ({ row }) => {
        const detail = requestsByJob.get(row.original.id)
        const request = detail?.request ?? null
        if (detail?.isLoading ?? true) return <Skeleton className="h-4 w-40" />
        if (!request) return <span className="text-muted-foreground">—</span>
        return (
          <span
            className="block max-w-80 truncate font-medium"
            title={ingestionFilename(request.filename)}
          >
            {ingestionFilename(request.filename)}
          </span>
        )
      },
    },
    {
      id: 'source_id',
      header: 'Received From',
      enableSorting: false,
      cell: ({ row }) => {
        const detail = requestsByJob.get(row.original.id)
        if (detail?.isLoading ?? true) return <Skeleton className="h-4 w-24" />
        return <span className="text-muted-foreground">{detail?.request?.source_id ?? '—'}</span>
      },
    },
    {
      id: 'received_at',
      header: 'Received At',
      enableSorting: false,
      cell: ({ row }) => {
        // The job's own `created_at` is stamped a fraction of a second after the
        // request landed, so it stands in while the detail call is in flight or
        // has failed — a cell that is briefly off by milliseconds beats a column
        // of dashes.
        const request = requestsByJob.get(row.original.id)?.request ?? null
        return formatDate(request?.received_at ?? row.original.created_at)
      },
    },
    {
      id: 'duration',
      header: 'Duration',
      enableSorting: false,
      cell: ({ row }) => {
        const elapsed = jobElapsedMs(row.original)
        // A job still moving has no final duration — what is shown is how long
        // it has been going so far.
        return (
          <span className="text-muted-foreground">
            {isTerminalStatus(row.original.status)
              ? formatDuration(elapsed)
              : `${formatDuration(elapsed)}+`}
          </span>
        )
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={statusBadgeVariant(row.original.status)}>
          {processingJobStatusLabel(row.original.status)}
        </Badge>
      ),
    },
  ]
}
