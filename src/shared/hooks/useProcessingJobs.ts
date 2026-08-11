import { useQueries, useQuery } from '@tanstack/react-query'
import {
  fetchIngestionRequests,
  fetchProcessingJobs,
} from '@/features/ingestion/lib/processing-jobs'
import type { IngestionRequest } from '@/types/ingestion'

/**
 * How often the list re-reads while "Live" is on.
 *
 * Jobs move through five statuses in the seconds after a document lands, so a
 * monitor that only updates on navigation is showing history. Ten seconds is
 * short enough to watch a job progress and long enough not to hammer a service
 * that returns every row on every call.
 */
const LIVE_REFETCH_MS = 10_000

/**
 * Every processing job the ingestion service holds.
 *
 * `staleTime: 0` overrides the app-wide five minutes: this is a monitor, and
 * coming back to the tab to a cached list from five minutes ago is exactly the
 * failure it exists to prevent. `refetchInterval` polls independently of that
 * while live.
 */
export function useProcessingJobs(live: boolean) {
  return useQuery({
    queryKey: ['processing-jobs'],
    queryFn: fetchProcessingJobs,
    staleTime: 0,
    refetchInterval: live ? LIVE_REFETCH_MS : false,
  })
}

/**
 * The incoming requests behind one job, fetched only once its row is opened.
 *
 * Not polled: what this returns is written when the request lands and never
 * changes afterwards, unlike the job's status.
 */
export function useIngestionRequests(processingJobId: string | null) {
  return useQuery({
    queryKey: ['ingestion-requests', processingJobId],
    queryFn: () => fetchIngestionRequests(processingJobId as string),
    enabled: Boolean(processingJobId),
  })
}

/** What one job's row needs from the detail endpoint, or why it has nothing. */
export interface JobRequestState {
  request: IngestionRequest | null
  isLoading: boolean
  isError: boolean
}

/**
 * The requests behind several jobs at once, one call per job.
 *
 * The list endpoint carries no filename or source, so the table has no way to
 * fill three of its five columns without asking per row. That is a request per
 * visible row, which is why these are keyed and cached exactly like the single
 * fetch above — opening a row's sheet reuses what the table already loaded, and
 * paging back to a page costs nothing.
 *
 * `staleTime: Infinity` rather than the hook above's default: what this returns
 * is written when the request lands and never changes, so re-reading it on the
 * list's ten-second poll would be N requests an interval for identical data.
 * The poll is for status, which comes from the list itself.
 */
export function useIngestionRequestsByJob(processingJobIds: string[]) {
  return useQueries({
    queries: processingJobIds.map((id) => ({
      queryKey: ['ingestion-requests', id],
      queryFn: () => fetchIngestionRequests(id),
      staleTime: Infinity,
    })),
    combine: (results): Map<string, JobRequestState> =>
      new Map(
        processingJobIds.map((id, index) => {
          const result = results[index]
          return [
            id,
            {
              // One job holds one request today; the endpoint returns an array
              // against a future where a retry can share a job. The table has
              // one row per job either way, so it shows the first.
              request: result.data?.[0] ?? null,
              isLoading: result.isPending,
              isError: result.isError,
            },
          ]
        }),
      ),
  })
}
