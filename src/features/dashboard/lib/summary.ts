import type { ApprovalListItem } from '@/types/approvals'
import { isUndelivered } from '@/types/approvals'
import type { ProcessingJob } from '@/types/ingestion'
import { jobElapsedMs } from '@/types/ingestion'

/**
 * The numbers behind the dashboard tiles.
 *
 * Kept pure and separate from the page because these are the claims the demo
 * makes out loud — "nothing is stuck", "one thing needs you" — and a wrong one
 * is worse than no tile at all. Everything here is derived client-side from
 * responses the app already fetches; nothing needs a new endpoint.
 */

/**
 * How long a job may sit unfinished before it counts as stuck.
 *
 * Classification and extraction run in seconds. Ten minutes is well past any
 * legitimate slow path, so a job over it is genuinely wedged rather than busy —
 * which is the only reading that makes the tile worth showing.
 */
export const STUCK_AFTER_MS = 10 * 60 * 1000

export interface JobSummary {
  total: number
  /** Still moving: received, in_progress, or under_review. */
  inFlight: number
  /** In flight and past {@link STUCK_AFTER_MS}. A subset of `inFlight`. */
  stuck: number
  failed: number
  completed: number
  underReview: number
  /** ISO timestamp of the newest job, or null when nothing has arrived. */
  lastReceivedAt: string | null
}

export function summariseJobs(jobs: ProcessingJob[], now: number = Date.now()): JobSummary {
  let inFlight = 0
  let stuck = 0
  let failed = 0
  let completed = 0
  let underReview = 0
  let newest: number | null = null
  let lastReceivedAt: string | null = null

  for (const job of jobs) {
    if (job.status === 'failed') failed += 1
    else if (job.status === 'completed') completed += 1
    else {
      inFlight += 1
      if (job.status === 'under_review') underReview += 1
      if (jobElapsedMs(job, now) > STUCK_AFTER_MS) stuck += 1
    }

    // Not assuming the service's ordering holds — a max is cheap and the tile
    // claiming "last seen 2 minutes ago" has to be right for the demo to land.
    const created = new Date(job.created_at).getTime()
    if (Number.isFinite(created) && (newest === null || created > newest)) {
      newest = created
      lastReceivedAt = job.created_at
    }
  }

  return { total: jobs.length, inFlight, stuck, failed, completed, underReview, lastReceivedAt }
}

export interface TaskSummary {
  pending: number
  decided: number
  /** Decisions that never reached the agent or Tally. See `isUndelivered`. */
  undelivered: number
}

/**
 * Counts over the task rows the inbox returned.
 *
 * Two things to know about what these can and cannot say. The endpoint is
 * scoped to the signed-in reviewer, so every number here is that person's work
 * and not the system's — the tiles have to be labelled accordingly. And it is
 * paged: `pending` is exact as long as the page covers them, which it does,
 * because the server sorts pending rows first.
 */
export function summariseTasks(approvals: ApprovalListItem[]): TaskSummary {
  let pending = 0
  let decided = 0
  let undelivered = 0

  for (const approval of approvals) {
    if (approval.status === 'PENDING') pending += 1
    else decided += 1
    if (isUndelivered(approval)) undelivered += 1
  }

  return { pending, decided, undelivered }
}

export interface PipelineStage {
  key: string
  label: string
  count: number
  /** Where the tile sends someone who wants to act on this stage. */
  href: string
  barClass: string
}

/**
 * The document's journey, left to right.
 *
 * The two halves come from different databases with no key joining them on
 * these endpoints, so this is two adjacent counts rather than one cohort
 * followed through. Labelled as stages rather than as a funnel for that reason:
 * a funnel implies the same documents flowing between the bars, and nothing
 * here establishes that.
 */
export function buildPipeline(jobs: JobSummary, tasks: TaskSummary): PipelineStage[] {
  return [
    {
      key: 'received',
      label: 'Received',
      count: jobs.total,
      href: '/ingestion-requests',
      barClass: 'bg-slate-400',
    },
    {
      key: 'processing',
      label: 'Processing',
      count: jobs.inFlight,
      href: '/ingestion-requests',
      barClass: 'bg-blue-500',
    },
    {
      key: 'review',
      label: 'Awaiting review',
      count: tasks.pending,
      href: '/tasks',
      barClass: 'bg-amber-500',
    },
    {
      key: 'decided',
      label: 'Decided',
      count: tasks.decided,
      href: '/tasks',
      barClass: 'bg-emerald-500',
    },
  ]
}

/** Coarse "time ago", enough for a liveness tile. */
export function timeAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'never'

  const elapsed = now - new Date(iso).getTime()
  if (!Number.isFinite(elapsed)) return 'never'
  // A future timestamp means the clocks disagree, not that something is pending.
  if (elapsed < 60_000) return 'just now'

  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return `${Math.floor(hours / 24)}d ago`
}
