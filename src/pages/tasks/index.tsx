import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnFiltersState, PaginationState, Updater } from '@tanstack/react-table'
import { DataTable } from '@/shared/components/data-table'
import type { FilterConfig } from '@/shared/components/data-table'
import { taskColumns } from '@/features/tasks/components/task-columns'
import { documentTypeOptions } from '@/features/documents/contracts'
import { useApprovals } from '@/shared/hooks/useApprovals'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { approvalFiltersFromColumns } from '@/shared/lib/approval-filters'
import { APPROVAL_STATUS_LABELS } from '@/types/approvals'
import type { ApprovalStatus } from '@/types/approvals'

/**
 * Every column the approvals API can actually filter on.
 *
 * `id` must match the column id in `taskColumns` — the popover writes into
 * TanStack's column-filter state, keyed by column id — *and* be a key
 * `approvalFiltersFromColumns` knows how to translate. A filter listed here but
 * missing from either side is a control that takes a value and changes nothing.
 *
 * `validations` is absent on purpose: it is derived from `action_conclusion`
 * client-side and has no server-side equivalent to filter by.
 */
const taskFilters: FilterConfig[] = [
  {
    filterType: 'text',
    id: 'document_id',
    label: 'Document Id',
    placeholder: 'e.g. INV-1024',
  },
  {
    filterType: 'text',
    id: 'customer_name',
    label: 'Customer Name',
    placeholder: 'Search by customer',
  },
  {
    filterType: 'singleSelect',
    id: 'document_type',
    label: 'Document Type',
    // Derived from the contract registry, so a new document type is filterable
    // the moment it is registered — no second list to keep in step.
    options: documentTypeOptions(),
  },
  {
    filterType: 'dateRange',
    id: 'created_at',
    label: 'Received',
  },
  {
    filterType: 'number',
    id: 'confidence_score',
    label: 'Confidence Score',
    min: 0,
    max: 100,
    step: 5,
    suffix: '%',
    presets: [
      { label: 'Below 70%', value: [0, 70], condition: 'less_than' },
      { label: '70-90%', value: [70, 90], condition: 'between' },
      { label: 'Above 90%', value: [90, 100], condition: 'greater_than' },
    ],
  },
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

  // The table drives these; the query reads them. Pagination is 0-based here
  // because that is what TanStack works in — the +1 for the API happens once,
  // at the call site below.
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [search, setSearch] = useState('')
  // Debounced because this term is sent to the API; the box reports keystrokes.
  const debouncedSearch = useDebouncedValue(search)

  /**
   * Column-filter state, translated into the shape the approvals API takes,
   * plus the toolbar's search term.
   *
   * Search goes to the server rather than filtering `approvals` here: this table
   * runs with `manualPagination`, so `approvals` is one page. Filtering it in the
   * browser would search twenty rows while appearing to search the inbox, and
   * quietly report "no results" for a document sitting on page three.
   */
  const filters = useMemo(() => {
    const term = debouncedSearch.trim()
    return { ...approvalFiltersFromColumns(columnFilters), ...(term ? { search: term } : {}) }
  }, [columnFilters, debouncedSearch])

  const { data, isLoading } = useApprovals(pagination.pageIndex + 1, pagination.pageSize, filters)
  const approvals = data?.approvals ?? []
  //const totalRows = data?.pagination.total ?? 0
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
        <p className="mt-1 text-sm text-muted-foreground">Documents awaiting your review</p>
      </div>

      <DataTable
        //tableName={`${totalRows} task${totalRows === 1 ? '' : 's'}`}
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
        onSearchChange={(value) => {
          setSearch(value)
          // A narrowed list is a different list: page 4 of the old one is
          // meaningless against it, and the API would return an empty page.
          setPagination((previous) => ({ ...previous, pageIndex: 0 }))
        }}
        onRowClick={(approval) =>
          navigate(`/tasks/${approval.id}`, { state: { documentId: approval.document_id } })
        }
      />
    </div>
  )
}
