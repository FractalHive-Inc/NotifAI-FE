import { useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import type { ColumnFiltersState, PaginationState, Updater } from '@tanstack/react-table'
import { DataTable } from '@/shared/components/data-table'
import type { FilterConfig } from '@/shared/components/data-table'
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from '@/shared/components/ui/empty'
import { NOT_PUSHED, tallyLogColumns } from '@/features/ppr/components/tally-log-columns'
import { useApprovals } from '@/shared/hooks/useApprovals'
import { approvalFiltersFromColumns } from '@/shared/lib/approval-filters'

/**
 * Two scopes in one popover, and the difference is worth knowing.
 *
 * `document_id`, `customer_name` and `created_at` are sent to the API, so they
 * narrow *every* PPR invoice. `tally_status` and `tally_voucher_id` exist only
 * on rows already fetched — the endpoint takes `status` and `use_case` but knows
 * nothing about Tally — so the table narrows the current page in the browser,
 * which is what this screen has always done.
 *
 * `id` must match the column id in `tallyLogColumns` or the popover has nothing
 * to write into.
 */
const tallyFilters: FilterConfig[] = [
  {
    filterType: 'dateRange',
    id: 'created_at',
    label: 'Created',
  },
  {
    filterType: 'select',
    id: 'tally_status',
    label: 'Tally status',
    options: [
      { value: 'SUCCESS', label: 'Pushed to Tally' },
      { value: 'FAILED', label: 'Tally push failed' },
      { value: 'PENDING', label: 'Tally push pending' },
      { value: NOT_PUSHED, label: 'Not pushed' },
    ],
  },
]

export default function TallyPushLogsPage() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // `use_case` is what makes this the PPR screen rather than the task inbox, so
  // it is fixed here and not something the popover can clear.
  const filters = useMemo(
    () => ({ ...approvalFiltersFromColumns(columnFilters), use_case: 'PPR' as const }),
    [columnFilters],
  )

  const { data, isLoading } = useApprovals(pagination.pageIndex + 1, pagination.pageSize, filters)
  const rows = useMemo(() => data?.approvals ?? [], [data])

  /**
   * Search is page-scoped, and deliberately so: the endpoint takes `status` and
   * `use_case` and nothing resembling a search term, so there is nothing to push
   * to the server. It narrows the rows already fetched — the same scope the
   * `tally_status` filter has always had. A term that matches nothing on this
   * page may still match on another.
   */
  const [search, setSearch] = useState('')
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      (row) =>
        (row.document_id ?? '').toLowerCase().includes(term) ||
        (row.customer_name ?? '').toLowerCase().includes(term),
    )
  }, [rows, search])
  //const totalRows = data?.pagination.total ?? 0
  const totalPages = data?.pagination.total_pages ?? 1

  /**
   * Pagination is manual because the server pages; filtering is *not*, because
   * `tally_status` exists only on the rows already fetched. The table therefore
   * narrows the current page in the browser, which is what this screen has
   * always done.
   */
  const tableOptions = useMemo(
    () => ({
      manualPagination: true,
      pageCount: totalPages,
      state: { pagination, columnFilters },
      onPaginationChange: (updater: Updater<PaginationState>) => {
        setPagination((previous) => (typeof updater === 'function' ? updater(previous) : updater))
      },
      onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => {
        setColumnFilters((previous) =>
          typeof updater === 'function' ? updater(previous) : updater,
        )
        // The server-backed filters return a different result set; page 4 of the
        // old one does not exist in it.
        setPagination((previous) => ({ ...previous, pageIndex: 0 }))
      },
    }),
    [totalPages, pagination, columnFilters],
  )

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-display font-bold text-[#043463] ">Tally Push Logs</h1>
        <p className="mt-2 text-body-lg text-muted-foreground">
          Invoices and their posting status to Tally.
        </p>
      </div>

      <DataTable
        //tableName={`${totalRows} PPR invoice${totalRows === 1 ? '' : 's'}`}
        columns={tallyLogColumns}
        data={visibleRows}
        tableOptions={tableOptions}
        isTableLoading={isLoading}
        skeletonRowCount={6}
        filters={tallyFilters}
        pageSizeOptions={[20, 50, 100]}
        storageKey="fh_table_tally_push_logs"
        searchPlaceholders={['Search by invoice id', 'Search by customer']}
        onSearchChange={setSearch}
        emptyState={
          <EmptyState>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fh-primary-50">
              <FileText className="h-5 w-5 text-[#043463]" />
            </div>
            <EmptyStateTitle>No Tally records found</EmptyStateTitle>
            <EmptyStateDescription>
              Approved invoices will appear here with their Tally status.
            </EmptyStateDescription>
          </EmptyState>
        }
      />
    </div>
  )
}
