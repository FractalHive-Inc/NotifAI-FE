import { useMemo, useState } from 'react'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import type { ColumnFiltersState, PaginationState, Updater } from '@tanstack/react-table'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { AdvancedDataTable } from '@/shared/components/ui/table'
import type { FilterConfig } from '@/shared/components/ui/table/table-types'
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from '@/shared/components/ui/empty'
import RequestDetailSheet from '@/features/ingestion/components/RequestDetailSheet'
import { createIngestionColumns } from '@/features/ingestion/components/ingestion-columns'
import { statusDotClass } from '@/features/ingestion/lib/status'
import { useIngestionRequestsByJob, useProcessingJobs } from '@/shared/hooks/useProcessingJobs'
import type { ProcessingJob, ProcessingJobStatus } from '@/types/ingestion'
import { PROCESSING_JOB_STATUSES, processingJobStatusLabel } from '@/types/ingestion'

const ALL = 'ALL'

/** `id` must match the Status column id or the filter popover has nothing to write into. */
const ingestionFilters: FilterConfig[] = [
  {
    filterType: 'singleSelect',
    id: 'status',
    label: 'Status',
    options: PROCESSING_JOB_STATUSES.map((jobStatus) => ({
      value: jobStatus,
      label: processingJobStatusLabel(jobStatus),
    })),
  },
]

export default function IngestionRequestsPage() {
  const [live, setLive] = useState(true)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [search, setSearch] = useState('')
  /**
   * Two pieces of state rather than one nullable job: the sheet animates out,
   * and clearing the job on close would empty the panel mid-slide. The job is
   * left set and only replaced when another row is opened.
   */
  const [openJob, setOpenJob] = useState<ProcessingJob | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data, isLoading, error, isFetching, refetch } = useProcessingJobs(live)
  const jobs = useMemo(() => data ?? [], [data])

  /**
   * Counted over every job rather than the filtered set. These are the reason
   * to open the page at all — "how much is failing" has to keep its answer when
   * someone filters down to a single status.
   */
  const counts = useMemo(() => {
    const tally = new Map<string, number>()
    for (const job of jobs) {
      tally.set(job.status, (tally.get(job.status) ?? 0) + 1)
    }
    return tally
  }, [jobs])

  const status = useMemo(() => {
    const value = columnFilters.find((filter) => filter.id === 'status')?.value
    return typeof value === 'string' && value ? (value as ProcessingJobStatus) : ALL
  }, [columnFilters])

  /**
   * Filtering and paging stay in the page rather than moving into the table.
   * The endpoint takes no query parameters and returns every job on every call,
   * so there is nothing to push to the server — but the per-row detail calls
   * below must only fire for the rows actually on screen, and that means the
   * page has to know which slice is visible. The table is handed one page and
   * told not to slice it again.
   */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return jobs.filter((job) => {
      if (status !== ALL && job.status !== status) return false
      return !term || job.id.toLowerCase().includes(term)
    })
  }, [jobs, status, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pagination.pageSize))
  // A filter that shrinks the list can strand the viewer past the last page.
  const safePage = Math.min(pagination.pageIndex, totalPages - 1)
  const visible = useMemo(
    () =>
      filtered.slice(
        safePage * pagination.pageSize,
        safePage * pagination.pageSize + pagination.pageSize,
      ),
    [filtered, safePage, pagination.pageSize],
  )

  /**
   * Three of the five columns live on the detail endpoint, so the rows on
   * screen — and only those — each need a call of their own. Restricted to the
   * visible page rather than every job: the list returns the lot, and fetching
   * all of it would be hundreds of requests for rows nobody is looking at.
   */
  const requestsByJob = useIngestionRequestsByJob(visible.map((job) => job.id))
  const columns = useMemo(() => createIngestionColumns(requestsByJob), [requestsByJob])

  const tableOptions = useMemo(
    () => ({
      manualPagination: true,
      manualFiltering: true,
      pageCount: totalPages,
      state: { pagination: { ...pagination, pageIndex: safePage }, columnFilters },
      onPaginationChange: (updater: Updater<PaginationState>) => {
        setPagination((previous) => (typeof updater === 'function' ? updater(previous) : updater))
      },
      onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => {
        setColumnFilters((previous) =>
          typeof updater === 'function' ? updater(previous) : updater,
        )
        setPagination((previous) => ({ ...previous, pageIndex: 0 }))
      },
    }),
    [totalPages, pagination, safePage, columnFilters],
  )

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#043463] sm:text-3xl">Incoming Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every document that has reached the ingestion service, and where it got to.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="live-updates" checked={live} onCheckedChange={setLive} />
            <Label htmlFor="live-updates" className="text-sm font-normal">
              Live
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Card className="rounded-xl border-[#e4e7ec] py-4 shadow-none">
          <CardContent className="px-4">
            <p className="text-2xl font-bold text-[#0f172a]">{isLoading ? '—' : jobs.length}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        {PROCESSING_JOB_STATUSES.map((jobStatus) => (
          <Card key={jobStatus} className="rounded-xl border-[#e4e7ec] py-4 shadow-none">
            <CardContent className="px-4">
              <p className="text-2xl font-bold text-[#0f172a]">
                {isLoading ? '—' : (counts.get(jobStatus) ?? 0)}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(jobStatus)}`} />
                {processingJobStatusLabel(jobStatus)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load incoming requests</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      <AdvancedDataTable
        tableName={`${filtered.length} request${filtered.length === 1 ? '' : 's'}`}
        columns={columns}
        data={visible}
        tableOptions={tableOptions}
        isTableLoading={isLoading}
        skeletonRowCount={6}
        filters={ingestionFilters}
        pageSizeOptions={[20, 50, 100]}
        storageKey="fh_table_ingestion_requests"
        searchPlaceholders={['Search by request ID']}
        onSearchChange={(value) => {
          setSearch(value)
          setPagination((previous) => ({ ...previous, pageIndex: 0 }))
        }}
        onRowClick={(job) => {
          setOpenJob(job)
          setSheetOpen(true)
        }}
        emptyState={
          <EmptyState>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fh-primary-50">
              <Inbox className="h-5 w-5 text-[#043463]" />
            </div>
            <EmptyStateTitle>
              {jobs.length === 0 ? 'No requests yet' : 'No matching requests'}
            </EmptyStateTitle>
            <EmptyStateDescription>
              {jobs.length === 0
                ? 'Documents sent to the ingestion service will appear here.'
                : 'Try a different status or search term.'}
            </EmptyStateDescription>
          </EmptyState>
        }
      />

      <RequestDetailSheet job={openJob} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
