import { useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import type { ColumnFiltersState, PaginationState, Updater } from '@tanstack/react-table'
import { AdvancedDataTable } from '@/shared/components/ui/table'
import type { FilterConfig } from '@/shared/components/ui/table/table-types'
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from '@/shared/components/ui/empty'
import { NOT_PUSHED, tallyLogColumns } from '@/features/ppr/components/tally-log-columns'
import { useApprovals } from '@/shared/hooks/useApprovals'

/**
 * Tally status is filtered in the browser — see the note on the column's
 * `filterFn`. `id` must match the column id or the popover has nothing to
 * write into.
 */
const tallyFilters: FilterConfig[] = [
  {
    filterType: 'singleSelect',
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

  const { data, isLoading } = useApprovals(pagination.pageIndex + 1, pagination.pageSize, {
    use_case: 'PPR',
  })
  const rows = useMemo(() => data?.approvals ?? [], [data])
  const totalRows = data?.pagination.total ?? 0
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
      },
    }),
    [totalPages, pagination, columnFilters],
  )

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#043463] sm:text-3xl">Tally Push Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PPR invoices and their posting status in Tally.
        </p>
      </div>

      <AdvancedDataTable
        tableName={`${totalRows} PPR invoice${totalRows === 1 ? '' : 's'}`}
        columns={tallyLogColumns}
        data={rows}
        tableOptions={tableOptions}
        isTableLoading={isLoading}
        skeletonRowCount={6}
        filters={tallyFilters}
        pageSizeOptions={[20, 50, 100]}
        storageKey="fh_table_tally_push_logs"
        searchPlaceholders={['Search by invoice id', 'Search by customer']}
        emptyState={
          <EmptyState>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fh-primary-50">
              <FileText className="h-5 w-5 text-[#043463]" />
            </div>
            <EmptyStateTitle>No Tally records found</EmptyStateTitle>
            <EmptyStateDescription>
              Approved PPR invoices will appear here with their Tally status.
            </EmptyStateDescription>
          </EmptyState>
        }
      />
    </div>
  )
}
