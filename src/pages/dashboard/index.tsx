import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Activity, Clock3, Inbox, Radio, SendHorizonal } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert/alert'
import { Card, CardContent } from '@/shared/components/ui/card/card'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import PipelineStrip from '@/features/dashboard/components/PipelineStrip'
import {
  buildPipeline,
  summariseJobs,
  summariseTasks,
  timeAgo,
} from '@/features/dashboard/lib/summary'
import { useApprovals } from '@/shared/hooks/useApprovals'
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

interface Tile {
  key: string
  label: string
  value: string
  hint: string
  icon: React.ReactNode
  iconWrapClass: string
  href: string
  /** Draws attention only when the number means something is wrong. */
  alarming?: boolean
}

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

  const jobs = useMemo(() => summariseJobs(jobData ?? []), [jobData])
  const tasks = useMemo(() => summariseTasks(taskData?.approvals ?? []), [taskData])
  const pipeline = useMemo(() => buildPipeline(jobs, tasks), [jobs, tasks])

  const isLoading = jobsLoading || tasksLoading

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

  const tiles: Tile[] = [
    {
      key: 'last-received',
      label: 'Last request',
      value: timeAgo(jobs.lastReceivedAt),
      hint: jobs.total === 0 ? 'Nothing ingested yet' : `${jobs.total} received in total`,
      icon: <Radio className="h-5 w-5 text-blue-600" />,
      iconWrapClass: 'bg-blue-50',
      href: '/incoming-requests',
    },
    {
      key: 'in-flight',
      label: 'In flight',
      value: String(jobs.inFlight),
      hint: 'Received, processing, or in review',
      icon: <Activity className="h-5 w-5 text-violet-600" />,
      iconWrapClass: 'bg-violet-50',
      href: '/incoming-requests',
    },
    {
      key: 'stuck',
      label: 'Stuck',
      value: String(jobs.stuck),
      hint: 'In flight for over 10 minutes',
      icon: <Clock3 className="h-5 w-5 text-amber-600" />,
      iconWrapClass: 'bg-amber-50',
      href: '/incoming-requests',
      alarming: jobs.stuck > 0,
    },
    {
      key: 'failed',
      label: 'Failed',
      value: String(jobs.failed),
      hint: 'Ingestion jobs that did not complete',
      icon: <AlertCircle className="h-5 w-5 text-rose-600" />,
      iconWrapClass: 'bg-rose-50',
      href: '/incoming-requests',
      alarming: jobs.failed > 0,
    },
    {
      key: 'pending',
      label: 'Pending your review',
      value: String(tasks.pending),
      hint: `Assigned to ${user?.email ?? 'you'}`,
      icon: <Inbox className="h-5 w-5 text-emerald-600" />,
      iconWrapClass: 'bg-emerald-50',
      href: '/tasks',
    },
    {
      key: 'undelivered',
      label: 'Undelivered decisions',
      value: String(tasks.undelivered),
      hint: 'Decided but not yet sent onward',
      icon: <SendHorizonal className="h-5 w-5 text-rose-600" />,
      iconWrapClass: 'bg-rose-50',
      href: '/tasks',
      alarming: tasks.undelivered > 0,
    },
  ]

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-[#043463] sm:text-3xl lg:text-4xl">
        Welcome, {user?.name || 'User'}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">
        Here&apos;s what the NotifAI pipeline is doing right now
      </p>

      {unreachable.length > 0 && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle />
          <AlertTitle>Some figures below are not live</AlertTitle>
          <AlertDescription>
            Could not reach {unreachable.join(' or ')}. Counts from{' '}
            {unreachable.length > 1 ? 'those systems' : 'that system'} are showing as zero rather
            than as they are.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <Card
            key={tile.key}
            role="button"
            tabIndex={0}
            onClick={() => navigate(tile.href)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                navigate(tile.href)
              }
            }}
            className={`cursor-pointer rounded-xl py-5 shadow-none transition-colors ${
              tile.alarming
                ? 'border-rose-200 bg-rose-50/40 hover:border-rose-300'
                : 'border-[#e4e7ec] hover:border-[#c8d0db]'
            }`}
          >
            <CardContent className="flex items-start gap-3">
              <div className={`rounded-lg p-2 ${tile.iconWrapClass}`}>{tile.icon}</div>
              <div className="min-w-0">
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="truncate text-2xl font-bold text-[#0f172a]">{tile.value}</p>
                )}
                <p className="text-sm font-medium text-[#0f172a]">{tile.label}</p>
                <p className="truncate text-xs text-muted-foreground">{tile.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4">
        <PipelineStrip stages={pipeline} isLoading={isLoading} />
      </div>
    </div>
  )
}
