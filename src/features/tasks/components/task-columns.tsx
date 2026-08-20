import type { ColumnDef } from '@/shared/components/ui/table'
import { StatusCell } from '@/features/tasks/components/StatusCell'
import { ValidationsCell } from '@/features/tasks/components/ValidationsCell'
import { documentTypeLabel } from '@/features/tasks/lib/validation-summary'
import { formatConfidence } from '@/types/approvals'
import type { ApprovalListItem } from '@/types/approvals'
import { formatDate } from '@/shared/lib/formatters'

/**
 * The Tasks table, described as data rather than JSX.
 *
 * Every column carries an explicit `id`: the table persists column order and
 * pinning to localStorage under its `storageKey`, and an id derived from array
 * position would silently re-map a reviewer's saved layout the moment a column
 * is inserted.
 *
 * Sorting is off across the board on purpose. The list is paginated server-side
 * (`useApprovals` fetches one page at a time), so the table's built-in sort
 * would only reorder the twenty rows currently in memory while presenting
 * itself as a sort of the whole inbox. Turning it on means adding
 * `manualSorting` here and a sort parameter on the API.
 */
export const taskColumns: ColumnDef<ApprovalListItem>[] = [
  {
    id: 'document_id',
    accessorKey: 'document_id',
    header: 'Document Id',
    enableSorting: false,
    cell: ({ row }) => <span className="font-medium">{row.original.document_id ?? '—'}</span>,
  },
  {
    id: 'customer_name',
    accessorKey: 'customer_name',
    header: 'Customer Name',
    enableSorting: false,
    cell: ({ row }) => (
      <span
        className="block max-w-[220px] truncate"
        title={row.original.customer_name ?? undefined}
      >
        {row.original.customer_name ?? '—'}
      </span>
    ),
  },
  {
    id: 'document_type',
    accessorKey: 'document_type',
    header: 'Document Type',
    enableSorting: false,
    cell: ({ row }) => documentTypeLabel(row.original) ?? '—',
  },
  {
    id: 'created_at',
    accessorKey: 'created_at',
    header: 'Received',
    enableSorting: false,
    cell: ({ row }) => formatDate(row.original.created_at),
  },
  {
    id: 'confidence_score',
    accessorKey: 'confidence_score',
    header: 'Confidence Score',
    enableSorting: false,
    cell: ({ row }) => formatConfidence(row.original.confidence_score),
  },
  {
    id: 'validations',
    header: 'Validations',
    enableSorting: false,
    // Derived from several fields at once, so there is nothing to accessor —
    // the cell reads the whole row.
    cell: ({ row }) => <ValidationsCell approval={row.original} />,
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <StatusCell approval={row.original} />,
  },
]
