import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { StatCard } from '@/shared/components/stat-card'
import DocumentUploadCard from '@/features/ingestion/components/DocumentUploadCard'
import JobStatCards from '@/features/ingestion/components/JobStatCards'
// import PipelineStrip from '@/features/dashboard/components/PipelineStrip'
import {
  //buildPipeline,
  summariseTasks,
} from '@/features/dashboard/lib/summary'
import { useApprovals } from '@/shared/hooks/useApprovals'
import { ApprovalStatus, SYNC_FAILED_FILTER } from '@/types/approvals'
import { useAuth } from '@/shared/hooks/useAuth'
import { useProcessingJobs } from '@/shared/hooks/useProcessingJobs'

/**
 * One page, wide enough to cover every task the reviewer has.
 *
 * The server sorts pending rows first, so a single page this size counts every
 * outstanding task exactly, and the decided figure covers recent history rather
 * than all time. Fetching every task to make that number total would cost a lot
 * for a tile nobody acts on.
 */
const TASK_PAGE_SIZE = 200

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Live: this is the page someone leaves open during a demo.
  const { data: jobData, isLoading: jobsLoading, error: jobsError } = useProcessingJobs(true)
  const {
    data: taskData,
    isLoading: tasksLoading,
    error: tasksError,
  } = useApprovals(1, TASK_PAGE_SIZE)

  /*
   * Approved and rejected are counted by the server, not from the page above.
   *
   * `limit: 1` fetches a single row and reads `pagination.total` off it: the
   * count is over the whole inbox rather than over the rows this page happens
   * to hold, which is the difference between "47 approved" and "47 of the most
   * recent 200", and only one of those is what the card says.
   */
  const { data: approvedData, isLoading: approvedLoading } = useApprovals(1, 1, {
    status: [ApprovalStatus.APPROVED],
  })
  const { data: rejectedData, isLoading: rejectedLoading } = useApprovals(1, 1, {
    status: [ApprovalStatus.REJECTED],
  })

  const jobs = useMemo(() => jobData ?? [], [jobData])
  const tasks = useMemo(() => summariseTasks(taskData?.approvals ?? []), [taskData])
  //const pipeline = useMemo(() => buildPipeline(jobs, tasks), [jobs, tasks])

  /**
   * Which halves of the page cannot be trusted.
   *
   * A failed query leaves its summary at zero, and a zero here does not read as
   * "no data" — it reads as "nothing is happening", which is the opposite claim
   * and the one that would be made confidently in front of an audience. Naming
   * the unreachable side is the only honest way to show the rest.
   */
  const unreachable = [
    jobsError ? 'the ingestion service' : null,
    tasksError ? 'the task inbox' : null,
  ].filter(Boolean)

  /*
   * One `space-y` sets the gap between every block on the page, so the sections,
   * the alert and the upload card cannot drift apart from each other as any one
   * of them is edited.
   */
  return (
    <div className="w-full space-y-6">
      <h2 className="text-display font-bold text-[#043463]">Welcome, {user?.name || 'User'}</h2>

      {unreachable.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Some figures below are not live</AlertTitle>
          <AlertDescription>
            Could not reach {unreachable.join(' or ')}. Counts from{' '}
            {unreachable.length > 1 ? 'those systems' : 'that system'} are showing as zero rather
            than as they are.
          </AlertDescription>
        </Alert>
      )}

      {/* Two rows, headed, rather than one long one: the ingestion counts and the
          task figure are different systems, and a single row of seven cards
          invited reading a job status and a task count as the same kind of
          number. */}
      <section aria-labelledby="requests-heading">
        <h3 id="requests-heading" className="text-h2 font-semibold text-[#043463]">
          Requests
        </h3>
        <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <JobStatCards
            jobs={jobs}
            isLoading={jobsLoading}
            // A status card lands on the rows it counted, not on the whole list.
            onSelect={(status) =>
              navigate(status ? `/incoming-requests?status=${status}` : '/incoming-requests')
            }
          />
        </div>
      </section>

      <section aria-labelledby="tasks-heading">
        <h3 id="tasks-heading" className="text-h2 font-semibold text-[#043463]">
          Tasks
        </h3>
        <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Approved"
            value={approvedData?.pagination.total ?? 0}
            isLoading={approvedLoading}
            dotClass="bg-fh-success-700"
            onClick={() => navigate(`/tasks?status=${ApprovalStatus.APPROVED}`)}
          />
          <StatCard
            label="Rejected"
            value={rejectedData?.pagination.total ?? 0}
            isLoading={rejectedLoading}
            dotClass="bg-fh-error-700"
            onClick={() => navigate(`/tasks?status=${ApprovalStatus.REJECTED}`)}
          />
          {/* Decided here, not confirmed downstream — a Tally push or an agent
              callback that has not come back `SENT`. Counted over the rows this
              page holds rather than by the server, because `isUndelivered`
              reads two columns the endpoint cannot filter by; the inbox
              narrows the same way on arrival. */}
          <StatCard
            label="Sync Failures"
            value={tasks.undelivered}
            isLoading={tasksLoading}
            alarming={tasks.undelivered > 0}
            onClick={() => navigate(`/tasks?status=${SYNC_FAILED_FILTER}`)}
          />
        </div>
      </section>

      <DocumentUploadCard />

      {/* 
      <div className="mt-4">
        <PipelineStrip stages={pipeline} isLoading={isLoading} />
      </div> */}
    </div>
  )
}
