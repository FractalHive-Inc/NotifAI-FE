import { StatCard } from '@/shared/components/stat-card'
import { statusDotClass } from '@/features/ingestion/lib/status'
import type { ProcessingJob, ProcessingJobStatus } from '@/types/ingestion'
import { PROCESSING_JOB_STATUSES, processingJobStatusLabel } from '@/types/ingestion'

interface JobStatCardsProps {
  jobs: ProcessingJob[]
  isLoading: boolean
  /** Makes the cards actionable. `null` is the total; anything else is a status. */
  onSelect?: (status: ProcessingJobStatus | null) => void
}

/**
 * The ingestion counts — a total and one card per status — as the dashboard's
 * Requests row. They live there rather than above the table they describe: the
 * page someone opens to work through the list does not need the same figures
 * repeated over it.
 *
 * A fragment rather than a grid, so the dashboard sits these in the same row as
 * its own cards.
 */
export default function JobStatCards({ jobs, isLoading, onSelect }: JobStatCardsProps) {
  const counts = new Map<string, number>()
  for (const job of jobs) {
    counts.set(job.status, (counts.get(job.status) ?? 0) + 1)
  }

  return (
    <>
      <StatCard
        label="Total"
        value={jobs.length}
        isLoading={isLoading}
        onClick={onSelect && (() => onSelect(null))}
      />
      {PROCESSING_JOB_STATUSES.map((jobStatus) => (
        <StatCard
          key={jobStatus}
          label={processingJobStatusLabel(jobStatus)}
          value={counts.get(jobStatus) ?? 0}
          isLoading={isLoading}
          dotClass={statusDotClass(jobStatus)}
          onClick={onSelect && (() => onSelect(jobStatus))}
        />
      ))}
    </>
  )
}
