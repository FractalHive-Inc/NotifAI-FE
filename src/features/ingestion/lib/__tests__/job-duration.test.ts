import { describe, expect, it } from 'vitest'
import { formatDuration } from '@/shared/lib/formatters'
import type { ProcessingJob, ProcessingJobStatus } from '@/types/ingestion'
import { jobElapsedMs } from '@/types/ingestion'

const CREATED = '2026-08-08T10:00:00+00:00'

function job(status: ProcessingJobStatus, updatedAt: string): ProcessingJob {
  return { id: 'abc', status, created_at: CREATED, updated_at: updatedAt }
}

/** A fixed "now" so a running job's elapsed time is not the wall clock's. */
const now = new Date('2026-08-08T10:05:00+00:00').getTime()

describe('jobElapsedMs', () => {
  it.each<[ProcessingJobStatus]>([['completed'], ['failed']])(
    'measures a %s job to its last transition, not to now',
    (status) => {
      expect(jobElapsedMs(job(status, '2026-08-08T10:00:30+00:00'), now)).toBe(30_000)
    },
  )

  it.each<[ProcessingJobStatus]>([['received'], ['in_progress'], ['under_review']])(
    'measures a %s job to now',
    (status) => {
      expect(jobElapsedMs(job(status, '2026-08-08T10:00:30+00:00'), now)).toBe(300_000)
    },
  )

  /**
   * The case the whole helper exists for: nothing has touched the job, so
   * `updated_at` still equals `created_at`. Reading the two columns against each
   * other would report zero and hide a job that has been stuck for five minutes.
   */
  it('does not report an untouched job as instant', () => {
    expect(jobElapsedMs(job('received', CREATED), now)).toBe(300_000)
  })

  it('goes negative rather than clamping when the clocks disagree', () => {
    const earlier = new Date('2026-08-08T09:59:00+00:00').getTime()
    expect(jobElapsedMs(job('received', CREATED), earlier)).toBeLessThan(0)
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '<1s'],
    [999, '<1s'],
    [1_000, '1s'],
    [59_000, '59s'],
    [60_000, '1m 0s'],
    [90_000, '1m 30s'],
    [3_600_000, '1h 0m'],
    [5_400_000, '1h 30m'],
    [86_400_000, '1d 0h'],
    [90_000_000, '1d 1h'],
  ])('formats %ims as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected)
  })

  /** Skewed clocks produce these; a negative duration is not worth rendering. */
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('renders %s as a dash', (ms) => {
    expect(formatDuration(ms)).toBe('—')
  })
})
