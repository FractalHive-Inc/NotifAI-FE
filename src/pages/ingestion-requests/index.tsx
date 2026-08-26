import { useMemo, useState } from 'react'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import type { ColumnFiltersState, PaginationState, Updater } from '@tanstack/react-table'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Switch } from '@/shared/components/ui/switch'
import { DataTable } from '@/shared/components/data-table'
import type { FilterConfig, FilterOption } from '@/shared/components/data-table'
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from '@/shared/components/ui/empty'
import RequestDetailSheet from '@/features/ingestion/components/RequestDetailSheet'
import { createIngestionColumns } from '@/features/ingestion/components/ingestion-columns'
import { statusDotClass } from '@/features/ingestion/lib/status'
import { useIngestionRequestsByJob, useProcessingJobs } from '@/shared/hooks/useProcessingJobs'
import type { ProcessingJob, ProcessingJobStatus } from '@/types/ingestion'
import {
  PROCESSING_JOB_STATUSES,
  ingestionFilename,
  ingestionValue,
  jobElapsedMs,
  processingJobStatusLabel,
} from '@/types/ingestion'

/** Seconds, matching the units the duration panel is configured in below. */
const DURATION_MAX_SECONDS = 999_999_999

/**
 * `id` must match the column id or the filter popover has nothing to write into.
 *
 * All five columns are filterable. That is only honest because the page holds
 * detail for every job rather than the visible page — `filename` and
 * `source_id` come from that detail, and filtering the list on a field fetched
 * for twenty of N rows would quietly drop matches. `duration` is derived from
 * the job's own timestamps and `status` / `received_at` come straight off the
 * list. Ordered to match the columns.
 *
 * A function rather than a constant because the source options are not known
 * until the detail calls land: the service defines no set of senders, so the
 * only truthful list is the one the loaded rows actually used.
 */
function buildIngestionFilters(sourceOptions: FilterOption[]): FilterConfig[] {
  return [
    {
      filterType: 'select',
      id: 'source_id',
      label: 'Received From',
      isMulti: true,
      options: sourceOptions,
    },
    {
      filterType: 'dateRange',
      id: 'received_at',
      label: 'Received At',
    },
    {
      // Seconds rather than milliseconds: the column reads "43s", and a panel
      // asking for 43000 would not match what it is filtering.
      filterType: 'number',
      id: 'duration',
      label: 'Duration',
      min: 0,
      step: 1,
      suffix: 's',
      presets: [
        { label: 'Under 30s', value: [0, 30], condition: 'less_than' },
        { label: '30s – 2m', value: [30, 120], condition: 'between' },
        { label: 'Over 2m', value: [120, DURATION_MAX_SECONDS], condition: 'greater_than' },
      ],
    },
    {
      filterType: 'select',
      id: 'status',
      label: 'Status',
      options: PROCESSING_JOB_STATUSES.map((jobStatus) => ({
        value: jobStatus,
        label: processingJobStatusLabel(jobStatus),
      })),
    },
  ]
}

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

  /**
   * Multi-select, like `sources` below: the panel writes an array when more than
   * one status is checked and a bare string when only one is, so both shapes
   * have to be read back. An empty list means "every status".
   */
  const statuses = useMemo(() => {
    const value = columnFilters.find((filter) => filter.id === 'status')?.value
    const raw = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
    return raw.filter((entry): entry is ProcessingJobStatus => Boolean(entry))
  }, [columnFilters])

  /** Substring, matched against the decoded filename the column renders. */
  const filenameTerm = useMemo(() => {
    const value = columnFilters.find((filter) => filter.id === 'filename')?.value
    return typeof value === 'string' ? value.trim().toLowerCase() : ''
  }, [columnFilters])

  /**
   * The panel is multi-select, but writes a bare string when only one option is
   * picked, so both shapes have to be read back.
   */
  const sources = useMemo(() => {
    const value = columnFilters.find((filter) => filter.id === 'source_id')?.value
    if (Array.isArray(value)) return value.filter((entry): entry is string => Boolean(entry))
    return typeof value === 'string' && value ? [value] : []
  }, [columnFilters])

  /** [min, max] in seconds, inclusive at both ends. */
  const durationRange = useMemo(() => {
    const value = columnFilters.find((filter) => filter.id === 'duration')?.value
    if (!Array.isArray(value)) return null
    const [min, max] = value
    return {
      min: typeof min === 'number' ? min : 0,
      max: typeof max === 'number' ? max : Number.POSITIVE_INFINITY,
    }
  }, [columnFilters])

  /** [from, to]; either end may be null while the user is mid-selection. */
  const receivedRange = useMemo(() => {
    const value = columnFilters.find((filter) => filter.id === 'received_at')?.value
    if (!Array.isArray(value)) return null
    const [from, to] = value
    const start = from instanceof Date ? new Date(from) : null
    const end = to instanceof Date ? new Date(to) : null
    // Whole calendar days: a range picked as 1-3 Jan must include everything
    // that landed on the 3rd, not just its first instant.
    start?.setHours(0, 0, 0, 0)
    end?.setHours(23, 59, 59, 999)
    return start || end ? { start, end } : null
  }, [columnFilters])

  /**
   * Three of the five columns live on the detail endpoint, so each job needs a
   * call of its own — including jobs on no visible page. Document name and
   * source are searched below, and a term matched against only the twenty rows
   * on screen would report "no matches" for a document sitting on page two.
   *
   * That is one request per job, which this affords because the service holds
   * tens of jobs rather than thousands. If the list grows an order of magnitude,
   * this is the line to revisit — firing the fan-out only once a search term is
   * entered keeps the page load as cheap as it was. The calls are keyed per job
   * and never go stale, so the table's own paging costs nothing on top.
   */
  const jobIds = useMemo(() => jobs.map((job) => job.id), [jobs])
  const requestsByJob = useIngestionRequestsByJob(jobIds)

  /**
   * Every sender the loaded jobs came from, deduplicated.
   *
   * Sorted so the list does not reshuffle as detail calls land in whatever order
   * the network returns them.
   */
  const sourceOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>()
    for (const { request } of requestsByJob.values()) {
      const source = ingestionValue(request?.source_id)
      if (source) seen.add(source)
    }
    return [...seen].sort().map((source) => ({ value: source, label: source }))
  }, [requestsByJob])

  const filters = useMemo(() => buildIngestionFilters(sourceOptions), [sourceOptions])

  /**
   * Filtering and paging stay in the page rather than moving into the table.
   * The endpoint takes no query parameters and returns every job on every call,
   * so there is nothing to push to the server, and the search has to match
   * against detail the page holds rather than a field the service can filter on.
   * The table is handed one page and told not to slice it again.
   */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return jobs.filter((job) => {
      if (statuses.length > 0 && !statuses.includes(job.status)) return false
      if (receivedRange) {
        const receivedAt = new Date(job.created_at)
        if (Number.isNaN(receivedAt.getTime())) return false
        if (receivedRange.start && receivedAt < receivedRange.start) return false
        if (receivedRange.end && receivedAt > receivedRange.end) return false
      }
      if (durationRange) {
        const elapsedSeconds = Math.floor(jobElapsedMs(job) / 1000)
        if (elapsedSeconds < durationRange.min || elapsedSeconds > durationRange.max) return false
      }

      const request = requestsByJob.get(job.id)?.request
      const filename = ingestionFilename(ingestionValue(request?.filename) ?? '').toLowerCase()
      const source = ingestionValue(request?.source_id) ?? ''

      // A row whose detail has not landed yet has no filename or source to test,
      // so a filter on either excludes it rather than letting it through
      // unchecked — the alternative is rows that vanish once their call returns.
      if (filenameTerm && !filename.includes(filenameTerm)) return false
      if (sources.length > 0 && !sources.includes(source)) return false

      if (!term) return true

      // The two free-text columns, plus the job id — which appears in no column
      // but is what the detail sheet offers to copy.
      return (
        job.id.toLowerCase().includes(term) ||
        filename.includes(term) ||
        source.toLowerCase().includes(term)
      )
    })
  }, [jobs, statuses, search, receivedRange, requestsByJob, filenameTerm, sources, durationRange])

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
          <h1 className="text-display font-bold text-[#043463]">Incoming Requests</h1>
          <p className="mt-2 text-body-lg text-muted-foreground">
            Every document that has reached NotifAI
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
            {/* A skeleton rather than a dash: a dash is a legible number of jobs
                ("none"), and showing it before the first response reads as an
                answer instead of as a page that has not loaded yet. */}
            {isLoading ? (
              <Skeleton className="my-1 h-6 w-10" />
            ) : (
              <p className="text-2xl font-bold text-[#0f172a]">{jobs.length}</p>
            )}
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        {PROCESSING_JOB_STATUSES.map((jobStatus) => (
          <Card key={jobStatus} className="rounded-xl border-[#e4e7ec] py-4 shadow-none">
            <CardContent className="px-4">
              {isLoading ? (
                <Skeleton className="my-1 h-6 w-10" />
              ) : (
                <p className="text-2xl font-bold text-[#0f172a]">{counts.get(jobStatus) ?? 0}</p>
              )}
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

      <DataTable
        //tableName={`${filtered.length} request${filtered.length === 1 ? '' : 's'}`}
        columns={columns}
        data={visible}
        tableOptions={tableOptions}
        isTableLoading={isLoading}
        skeletonRowCount={6}
        filters={filters}
        pageSizeOptions={[20, 50, 100]}
        storageKey="fh_table_ingestion_requests"
        searchPlaceholders={['Search by document name', 'Search by source']}
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
