import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnFiltersState, PaginationState, Updater } from '@tanstack/react-table'
import { AdvancedDataTable } from '@/shared/components/ui/table'
import type { FilterConfig } from '@/shared/components/ui/table/table-types'
import { taskColumns } from '@/features/tasks/components/task-columns'
import { useApprovals } from '@/shared/hooks/useApprovals'
import { useAuth } from '@/shared/hooks/useAuth'
import { APPROVAL_STATUS_LABELS } from '@/types/approvals'
import type { ApprovalFilters, ApprovalStatus } from '@/types/approvals'

/**
 * The filter popover writes into TanStack's column-filter state, keyed by
 * column id — so `id` here must match the id of the Status column in
 * `taskColumns`, or the popover has nothing to write to.
 */
const taskFilters: FilterConfig[] = [
  {
    filterType: 'singleSelect',
    id: 'status',
    label: 'Status',
    options: (Object.keys(APPROVAL_STATUS_LABELS) as ApprovalStatus[]).map((status) => ({
      value: status,
      label: APPROVAL_STATUS_LABELS[status],
    })),
  },
]

export default function TasksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // The table drives these; the query reads them. Pagination is 0-based here
  // because that is what TanStack works in — the +1 for the API happens once,
  // at the call site below.
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  /** Column-filter state, translated into the shape the approvals API takes. */
  const filters = useMemo<ApprovalFilters>(() => {
    const status = columnFilters.find((filter) => filter.id === 'status')?.value
    return typeof status === 'string' && status ? { status: status as ApprovalStatus } : {}
  }, [columnFilters])

  const { data, isLoading } = useApprovals(pagination.pageIndex + 1, pagination.pageSize, filters)
  const approvals = data?.approvals ?? []
  const totalRows = data?.pagination.total ?? 0
  const totalPages = data?.pagination.total_pages ?? 1

  /**
   * `manualPagination` + `manualFiltering` tell the table not to slice or filter
   * the rows it was handed: the server already did both, and `data` is one page.
   * Without them the table would paginate the twenty rows it can see, so page 2
   * would come back empty.
   *
   * `pageCount` is what the pager renders its page numbers from — with manual
   * pagination the table cannot infer it from `data.length`.
   */
  const tableOptions = useMemo(
    () => ({
      manualPagination: true,
      manualFiltering: true,
      pageCount: totalPages,
      state: { pagination, columnFilters },
      onPaginationChange: (updater: Updater<PaginationState>) => {
        setPagination((previous) => (typeof updater === 'function' ? updater(previous) : updater))
      },
      onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => {
        setColumnFilters((previous) =>
          typeof updater === 'function' ? updater(previous) : updater,
        )
        // A narrowed list is a different list: page 4 of the old one is
        // meaningless against it, and the API would return an empty page.
        setPagination((previous) => ({ ...previous, pageIndex: 0 }))
      },
    }),
    [totalPages, pagination, columnFilters],
  )

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#043463] sm:text-3xl">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Documents awaiting your review, assigned to {user?.email ?? 'you'}
        </p>
      </div>

      <AdvancedDataTable
        tableName={`${totalRows} task${totalRows === 1 ? '' : 's'}`}
        columns={taskColumns}
        data={approvals}
        tableOptions={tableOptions}
        isTableLoading={isLoading}
        skeletonRowCount={6}
        filters={taskFilters}
        pageSizeOptions={[20, 50, 100]}
        // Keyed explicitly rather than letting it fall back to `tableName`,
        // which changes with the task count and would scatter a reviewer's saved
        // column layout across a new localStorage key on every refetch.
        storageKey="fh_table_tasks"
        searchPlaceholders={['Search by document id', 'Search by customer']}
        onRowClick={(approval) => navigate(`/tasks/${approval.id}`)}
      />
    </div>
  )
}
