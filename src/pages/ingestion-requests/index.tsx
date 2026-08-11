import { useMemo, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert/alert'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Button } from '@/shared/components/ui/button/button'
import { Card, CardContent } from '@/shared/components/ui/card/card'
import { Label } from '@/shared/components/ui/label/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select/select'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import { Switch } from '@/shared/components/ui/switch/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table/table'
import RequestDetailSheet from '@/features/ingestion/components/RequestDetailSheet'
import { statusBadgeVariant, statusDotClass } from '@/features/ingestion/lib/status'
import { useIngestionRequestsByJob, useProcessingJobs } from '@/shared/hooks/useProcessingJobs'
import { formatDate, formatDuration } from '@/shared/lib/formatters'
import type { ProcessingJob, ProcessingJobStatus } from '@/types/ingestion'
import {
  PROCESSING_JOB_STATUSES,
  ingestionFilename,
  isTerminalStatus,
  jobElapsedMs,
  processingJobStatusLabel,
} from '@/types/ingestion'

const ALL = 'ALL'

const PAGE_SIZES = [20, 50, 100]

export default function IngestionRequestsPage() {
  const [live, setLive] = useState(true)
  // Setters intentionally unbound: the filter controls that drove them are
  // commented out below, so these hold their initial value for now.
  const [status] = useState<ProcessingJobStatus | typeof ALL>(ALL)
  const [search] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
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
   * Filtering and paging are both client-side: the endpoint takes no query
   * parameters and returns every job on every call, so there is nothing to push
   * to the server.
   */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return jobs.filter((job) => {
      if (status !== ALL && job.status !== status) return false
      return !term || job.id.toLowerCase().includes(term)
    })
  }, [jobs, status, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  // A filter that shrinks the list can strand the viewer past the last page.
  const safePage = Math.min(page, totalPages - 1)
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize)

  /**
   * Three of the five columns live on the detail endpoint, so the rows on
   * screen — and only those — each need a call of their own. Restricted to the
   * visible page rather than every job: the list returns the lot, and fetching
   * all of it would be hundreds of requests for rows nobody is looking at.
   */
  const requestsByJob = useIngestionRequestsByJob(visible.map((job) => job.id))

  const resetToFirstPage = () => setPage(0)

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

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        {/* <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <CardTitle className="text-base">
              {filtered.length} request{filtered.length === 1 ? '' : 's'}
            </CardTitle>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full max-w-[260px] space-y-1">
                <Label htmlFor="request-search">Search</Label>
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="request-search"
                    className="pl-8"
                    placeholder="Request ID"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </div>
              </div>
              <div className="w-full max-w-[200px] space-y-1">
                <Label htmlFor="request-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value as ProcessingJobStatus | typeof ALL)
                    resetToFirstPage()
                  }}
                >
                  <SelectTrigger id="request-status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    {PROCESSING_JOB_STATUSES.map((jobStatus) => (
                      <SelectItem key={jobStatus} value={jobStatus}>
                        {processingJobStatusLabel(jobStatus)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader> */}

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Received From</TableHead>
                  <TableHead>Received At</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8efff]">
                          <Inbox className="h-5 w-5 text-[#043463]" />
                        </div>
                        <p className="text-sm font-medium text-[#0f172a]">
                          {jobs.length === 0 ? 'No requests yet' : 'No matching requests'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {jobs.length === 0
                            ? 'Documents sent to the ingestion service will appear here.'
                            : 'Try a different status or search term.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((job) => {
                    const elapsed = jobElapsedMs(job)
                    const detail = requestsByJob.get(job.id)
                    const request = detail?.request ?? null
                    const detailLoading = detail?.isLoading ?? true
                    return (
                      <TableRow
                        key={job.id}
                        className="cursor-pointer"
                        onClick={() => {
                          setOpenJob(job)
                          setSheetOpen(true)
                        }}
                      >
                        <TableCell className="max-w-[320px] font-medium">
                          {detailLoading ? (
                            <Skeleton className="h-4 w-40" />
                          ) : request ? (
                            <span
                              className="block truncate"
                              title={ingestionFilename(request.filename)}
                            >
                              {ingestionFilename(request.filename)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {detailLoading ? (
                            <Skeleton className="h-4 w-24" />
                          ) : (
                            (request?.source_id ?? '—')
                          )}
                        </TableCell>
                        <TableCell>
                          {/* The job's own `created_at` is stamped a fraction of
                              a second after the request landed, so it stands in
                              while the detail call is in flight or has failed —
                              a cell that is briefly off by milliseconds beats a
                              column of dashes. */}
                          {formatDate(request?.received_at ?? job.created_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {/* A job still moving has no final duration — what is
                              shown is how long it has been going so far. */}
                          {isTerminalStatus(job.status)
                            ? formatDuration(elapsed)
                            : `${formatDuration(elapsed)}+`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(job.status)}>
                            {processingJobStatusLabel(job.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing page {safePage + 1} of {totalPages} ({filtered.length} total)
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  resetToFirstPage()
                }}
              >
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={safePage === 0}
                onClick={() => setPage(Math.max(0, safePage - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={safePage + 1 >= totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <RequestDetailSheet job={openJob} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
