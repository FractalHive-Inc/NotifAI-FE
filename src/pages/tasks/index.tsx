import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import type { ColumnFiltersState, PaginationState, Updater } from '@tanstack/react-table'
import { DataTable } from '@/shared/components/data-table'
import type { FilterConfig } from '@/shared/components/data-table'
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from '@/shared/components/ui/empty'
import { taskColumns } from '@/features/tasks/components/task-columns'
import { documentTypeOptions } from '@/features/documents/contracts'
import { useApprovals } from '@/shared/hooks/useApprovals'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { approvalFiltersFromColumns } from '@/shared/lib/approval-filters'
import {
  APPROVAL_STATUS_FILTER_OPTIONS,
  SYNC_FAILED_FILTER,
  isUndelivered,
} from '@/types/approvals'

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
    filterType: 'select',
    // Multi-select: the API ORs the list it is given.
    isMulti: true,
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
      { label: 'Below 70%', value: [0, 69], condition: 'less_than' },
      { label: '70-90%', value: [70, 90], condition: 'between' },
      { label: 'Above 90%', value: [91, 100], condition: 'greater_than' },
    ],
  },
  {
    filterType: 'select',
    isMulti: true,
    id: 'status',
    label: 'Status',
    // The labels the Status column can show, not the statuses stored — that
    // list includes the derived "Pushed to Tally", which
    // `approvalFiltersFromColumns` expands into the query describing it.
    options: APPROVAL_STATUS_FILTER_OPTIONS,
  },
]

/** The Status filter is multi-select, but writes a bare value for one pick. */
function statusValues(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value]
}

export default function TasksPage() {
  const navigate = useNavigate()

  // The table drives these; the query reads them. Pagination is 0-based here
  // because that is what TanStack works in — the +1 for the API happens once,
  // at the call site below.
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })

  /**
   * `?status=` opens the inbox already filtered — that is how the dashboard's
   * count cards land here, on the rows they were counting.
   *
   * Read once, into the initial state, rather than kept as the source of truth:
   * the filter belongs to the reviewer from the first render on, and
   * re-deriving it from the URL would fight anyone who then clears it. A value
   * the Status filter does not offer is ignored rather than filtering the inbox
   * down to nothing. The array is what the multi-select popover writes and what
   * `approvalFiltersFromColumns` expects.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const status = searchParams.get('status')
    const known = APPROVAL_STATUS_FILTER_OPTIONS.some((option) => option.value === status)
    return status && known ? [{ id: 'status', value: [status] }] : []
  })
  const [search, setSearch] = useState('')
  // Debounced because this term is sent to the API; the box reports keystrokes.
  const debouncedSearch = useDebouncedValue(search)

  /**
   * The Status filter, split by what the API can answer.
   *
   * `SYNC_FAILED` is a label the Status column derives, not a status any row
   * stores, and unlike `PUSHED_TO_TALLY` the endpoint cannot expand it — it
   * takes `status` and `use_case` and knows nothing about delivery. So it is
   * lifted out here: what remains is sent, and the flag narrows the rows below.
   */
  const syncFailuresOnly = columnFilters.some(
    (filter) => filter.id === 'status' && statusValues(filter.value).includes(SYNC_FAILED_FILTER),
  )

  const apiColumnFilters = useMemo(
    () =>
      columnFilters
        .map((filter) =>
          filter.id === 'status'
            ? {
                ...filter,
                value: statusValues(filter.value).filter((value) => value !== SYNC_FAILED_FILTER),
              }
            : filter,
        )
        // A status filter left holding nothing is no filter, not one matching
        // nothing — dropped so the API is not sent an empty list.
        .filter((filter) => !(Array.isArray(filter.value) && filter.value.length === 0)),
    [columnFilters],
  )

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
    return { ...approvalFiltersFromColumns(apiColumnFilters), ...(term ? { search: term } : {}) }
  }, [apiColumnFilters, debouncedSearch])

  const { data, isLoading } = useApprovals(pagination.pageIndex + 1, pagination.pageSize, filters)

  /**
   * Page-scoped, and only when the sync filter is on: `isUndelivered` reads two
   * columns the endpoint cannot filter by, so this narrows the page the server
   * returned rather than the inbox. A sync failure on page three stays there
   * until page three is opened — the same scope the Tally screen's
   * `tally_status` filter has always had. Paging still comes from the server,
   * so the pager keeps counting unfiltered pages.
   */
  const approvals = useMemo(() => {
    const rows = data?.approvals ?? []
    return syncFailuresOnly ? rows.filter(isUndelivered) : rows
  }, [data, syncFailuresOnly])
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
        // The URL said which filter to open on; once the filters are edited it
        // no longer describes them, so it stops claiming to. `replace` keeps
        // the back button pointing at wherever the viewer came from.
        setSearchParams(
          (params) => {
            params.delete('status')
            return params
          },
          { replace: true },
        )
      },
    }),
    [totalPages, pagination, columnFilters, setSearchParams],
  )

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-display font-bold text-[#043463] ">Tasks</h1>
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
        emptyState={
          <EmptyState>
            <div className="rounded-full bg-fh-primary-50 p-4">
              <ClipboardCheck className="h-7 w-7 text-[#101f45]" />
            </div>
            <EmptyStateTitle>No tasks yet</EmptyStateTitle>
            <EmptyStateDescription>
              Documents show up here once they are ready for the review.
            </EmptyStateDescription>
          </EmptyState>
        }
      />
    </div>
  )
}
