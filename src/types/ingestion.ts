/**
 * The ingestion service's processing jobs, mirroring what its two read
 * endpoints return verbatim (snake_case, hand-maintained).
 *
 * These come from a different service to the rest of `types/` — the ingestion
 * service on its own origin, not our backend — so nothing here is guaranteed to
 * move in lockstep with this app. That is why the status label lookup below
 * tolerates a value it has never heard of.
 *
 * Enums are the `type` + `const` pair rather than a TS `enum` — the app's
 * tsconfig sets `erasableSyntaxOnly`, so `enum` will not compile.
 */

export type ProcessingJobStatus =
  | 'received'
  | 'in_progress'
  | 'under_review'
  | 'completed'
  | 'failed'

export const ProcessingJobStatus = {
  RECEIVED: 'received' as const,
  IN_PROGRESS: 'in_progress' as const,
  UNDER_REVIEW: 'under_review' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
}

/**
 * Pipeline order, not alphabetical: the status filter and the counts along the
 * top both read as a funnel, so the order has to be the one a job moves through.
 */
export const PROCESSING_JOB_STATUSES: ProcessingJobStatus[] = [
  'received',
  'in_progress',
  'under_review',
  'completed',
  'failed',
]

export const PROCESSING_JOB_STATUS_LABELS: Record<ProcessingJobStatus, string> = {
  received: 'Received',
  in_progress: 'In progress',
  under_review: 'Under review',
  completed: 'Completed',
  failed: 'Failed',
}

/** One row of `GET /notifai/processing/jobs`, newest first. */
export interface ProcessingJob {
  id: string
  status: ProcessingJobStatus
  /** When the ingestion service accepted the request. ISO 8601, UTC. */
  created_at: string
  /** Last status transition. Equals `created_at` until something moves the job. */
  updated_at: string
}

/**
 * One element of `GET /notifai/processing/job/{id}`, which returns an array.
 *
 * In practice that array always holds exactly one element — the service creates
 * a fresh job per incoming request today — but the schema models a one-to-many
 * so retries can share a job later, and the service's own source carries a TODO
 * to that effect. Treated as a list here so that change is not a rewrite.
 */
export interface IngestionRequest {
  id: string
  /**
   * The document as it was sent. Percent-encoded by the sender — the service
   * stores the name verbatim — so it needs decoding before it is shown.
   */
  filename: string
  /** The agent's thread. Also the key for the blob/SAS-URL endpoint. */
  thread_id: string
  /** Who sent the document — e.g. `notifai_platform` for the upload page. */
  source_id: string
  /** Stamped by the service when the request landed, before any DB write. */
  received_at: string
  created_at: string
}

/**
 * The document's name as a person would read it.
 *
 * Senders percent-encode the name before handing it over, so what is stored is
 * `exceeded_%20gst_invoice.pdf` rather than the name on the file. A name that
 * contains a bare `%` is not valid encoding and makes `decodeURIComponent`
 * throw — in that case the stored value is already the readable one.
 */
export function ingestionFilename(filename: string): string {
  try {
    return decodeURIComponent(filename)
  } catch {
    return filename
  }
}

/** Falls back to the raw value so a status added server-side still renders. */
export function processingJobStatusLabel(status: string): string {
  return PROCESSING_JOB_STATUS_LABELS[status as ProcessingJobStatus] ?? status
}

/** A job that has stopped moving, so its duration is final rather than running. */
export function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'failed'
}

/**
 * How long the job has been in flight, in milliseconds.
 *
 * A finished job's span is fixed — created to its last transition. A job still
 * moving has no end yet, so the span runs to now. That distinction is the whole
 * point: `updated_at` only moves on a status change, so a job stuck in
 * `received` for three hours has `updated_at === created_at` and would otherwise
 * report as having taken no time at all — exactly the case worth spotting.
 *
 * The two timestamps come from different clocks (the server's, the browser's),
 * so a running job on a skewed machine can come out negative. `formatDuration`
 * renders that as `—` rather than inventing a number.
 */
export function jobElapsedMs(job: ProcessingJob, now: number = Date.now()): number {
  const started = new Date(job.created_at).getTime()
  const ended = isTerminalStatus(job.status) ? new Date(job.updated_at).getTime() : now
  return ended - started
}
