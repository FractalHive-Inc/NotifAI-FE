import { Link } from 'react-router-dom'
import type { ColumnDef } from '@/shared/components/ui/table'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { formatDate } from '@/shared/lib/formatters'
import type { ApprovalListItem } from '@/types/approvals'

/** `null` means the invoice was never handed to Tally at all. */
export const NOT_PUSHED = 'NOT_PUSHED'

function tallyBadge(row: ApprovalListItem) {
  if (row.tally_status === 'SUCCESS') {
    return <Badge variant="success">Pushed to Tally</Badge>
  }

  if (row.tally_status === 'FAILED') {
    return <Badge variant="error">Tally push failed</Badge>
  }

  if (row.tally_status === 'PENDING') {
    return <Badge variant="outline">Tally push pending</Badge>
  }

  return <Badge variant="secondary">Not pushed</Badge>
}

/**
 * Tally push log columns.
 *
 * Sorting is off for the same reason as the Tasks table: the rows are one
 * server page, so a client sort would reorder the visible twenty while looking
 * like it sorted the whole log.
 */
export const tallyLogColumns: ColumnDef<ApprovalListItem>[] = [
  {
    id: 'document_id',
    accessorKey: 'document_id',
    header: 'Invoice Id',
    enableSorting: false,
    cell: ({ row }) => (
      // A real link, not just a row click: these get middle-clicked and copied.
      // The table's row handler ignores clicks that land on an anchor.
      <Button variant="link" className="h-auto p-0 text-[#043463]" asChild>
        <Link to={`/tasks/${row.original.id}`}>{row.original.document_id ?? '—'}</Link>
      </Button>
    ),
  },
  {
    id: 'customer_name',
    accessorKey: 'customer_name',
    header: 'Customer Name',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="block max-w-65 truncate" title={row.original.customer_name ?? undefined}>
        {row.original.customer_name ?? '—'}
      </span>
    ),
  },
  {
    id: 'tally_voucher_id',
    accessorKey: 'tally_voucher_id',
    header: 'Voucher',
    enableSorting: false,
    cell: ({ row }) => row.original.tally_voucher_id ?? '—',
  },
  {
    id: 'created_at',
    accessorKey: 'created_at',
    header: 'Created at',
    enableSorting: false,
    cell: ({ row }) => formatDate(row.original.created_at),
  },
  {
    id: 'tally_status',
    accessorKey: 'tally_status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => tallyBadge(row.original),
    /**
     * Client-side, and deliberately so: the approvals API filters on `status`
     * and `use_case` but knows nothing about `tally_status`, so this can only
     * ever narrow the page already loaded. That is exactly what the page did
     * before — the filter is just visible now instead of hardcoded.
     */
    filterFn: (row, _id, value: string) => {
      if (!value) return true
      if (value === NOT_PUSHED) return row.original.tally_status === null
      return row.original.tally_status === value
    },
  },
]
