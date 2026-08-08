import { describe, expect, it } from 'vitest'
import { STUCK_AFTER_MS, buildPipeline, summariseJobs, summariseTasks, timeAgo } from '../summary'
import type { ApprovalListItem, ApprovalStatus, CallbackStatus, UseCase } from '@/types/approvals'
import type { ProcessingJob, ProcessingJobStatus } from '@/types/ingestion'

const NOW = new Date('2026-08-08T12:00:00Z').getTime()

function at(minutesAgo: number): string {
  return new Date(NOW - minutesAgo * 60_000).toISOString()
}

function job(status: ProcessingJobStatus, createdMinutesAgo: number): ProcessingJob {
  return {
    id: `job-${status}-${createdMinutesAgo}`,
    status,
    created_at: at(createdMinutesAgo),
    // Terminal jobs are measured to this; in-flight ones are measured to now.
    updated_at: at(createdMinutesAgo),
  }
}

function task(
  status: ApprovalStatus,
  extra: Partial<Pick<ApprovalListItem, 'use_case' | 'callback_status' | 'tally_status'>> = {},
): ApprovalListItem {
  return {
    id: `task-${Math.random()}`,
    status,
    use_case: (extra.use_case ?? 'HITL') as UseCase,
    callback_status: (extra.callback_status ?? null) as CallbackStatus | null,
    tally_status: extra.tally_status ?? null,
  } as ApprovalListItem
}

describe('summariseJobs', () => {
  it('counts an empty system without inventing a last-seen time', () => {
    expect(summariseJobs([], NOW)).toEqual({
      total: 0,
      inFlight: 0,
      stuck: 0,
      failed: 0,
      completed: 0,
      underReview: 0,
      lastReceivedAt: null,
    })
  })

  it('separates in-flight work from terminal work', () => {
    const summary = summariseJobs(
      [
        job('received', 1),
        job('in_progress', 1),
        job('under_review', 1),
        job('completed', 1),
        job('failed', 1),
      ],
      NOW,
    )

    expect(summary.total).toBe(5)
    expect(summary.inFlight).toBe(3)
    expect(summary.underReview).toBe(1)
    expect(summary.completed).toBe(1)
    expect(summary.failed).toBe(1)
  })

  /**
   * The tile's whole purpose. An old job is only stuck while it is still moving
   * — a job that finished an hour ago is history, not a problem.
   */
  it('counts only in-flight jobs as stuck, and only past the threshold', () => {
    const overBy = STUCK_AFTER_MS / 60_000 + 1
    const summary = summariseJobs(
      [
        job('in_progress', overBy),
        job('received', overBy),
        job('in_progress', 1),
        job('completed', overBy),
        job('failed', overBy),
      ],
      NOW,
    )

    expect(summary.stuck).toBe(2)
    expect(summary.inFlight).toBe(3)
  })

  it('reports the newest arrival regardless of the order it was given', () => {
    const summary = summariseJobs(
      [job('completed', 90), job('received', 5), job('failed', 30)],
      NOW,
    )

    expect(summary.lastReceivedAt).toBe(at(5))
  })
})

describe('summariseTasks', () => {
  it('splits pending from decided', () => {
    const summary = summariseTasks([
      task('PENDING'),
      task('PENDING'),
      task('APPROVED', { callback_status: 'SENT' }),
      task('REJECTED', { callback_status: 'SENT' }),
    ])

    expect(summary).toEqual({ pending: 2, decided: 2, undelivered: 0 })
  })

  it('counts a decision that never reached its downstream', () => {
    const summary = summariseTasks([
      task('APPROVED', { use_case: 'HITL', callback_status: 'FAILED' }),
      task('APPROVED', { use_case: 'PPR', tally_status: 'PENDING' }),
      task('APPROVED', { use_case: 'PPR', tally_status: 'SUCCESS' }),
    ])

    expect(summary.undelivered).toBe(2)
  })

  /** Nothing is owed until a decision exists, so pending is never undelivered. */
  it('never counts a pending task as undelivered', () => {
    expect(summariseTasks([task('PENDING', { callback_status: 'PENDING' })]).undelivered).toBe(0)
  })
})

describe('buildPipeline', () => {
  it('reads ingestion totals then task totals, left to right', () => {
    const stages = buildPipeline(
      {
        total: 10,
        inFlight: 3,
        stuck: 1,
        failed: 2,
        completed: 5,
        underReview: 1,
        lastReceivedAt: at(1),
      },
      { pending: 4, decided: 6, undelivered: 1 },
    )

    expect(stages.map((stage) => [stage.label, stage.count])).toEqual([
      ['Received', 10],
      ['Processing', 3],
      ['Awaiting review', 4],
      ['Decided', 6],
    ])
    expect(stages.every((stage) => stage.href.startsWith('/'))).toBe(true)
  })
})

describe('timeAgo', () => {
  it.each([
    [null, 'never'],
    [at(0), 'just now'],
    [at(0.5), 'just now'],
    [at(5), '5m ago'],
    [at(59), '59m ago'],
    [at(60), '1h ago'],
    [at(60 * 25), '1d ago'],
  ])('renders %s as %s', (iso, expected) => {
    expect(timeAgo(iso, NOW)).toBe(expected)
  })

  /** A clock ahead of the server reads as "just now", not a negative age. */
  it('does not report a future timestamp as elapsed time', () => {
    expect(timeAgo(at(-10), NOW)).toBe('just now')
  })
})
