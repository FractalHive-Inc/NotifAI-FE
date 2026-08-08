import { useQuery } from '@tanstack/react-query'
import {
  fetchIngestionRequests,
  fetchProcessingJobs,
} from '@/features/ingestion/lib/processing-jobs'

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
