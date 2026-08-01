import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import { useApproval } from '@/shared/hooks/useApprovals'
import HitlReviewPage from '@/features/hitl/components/HitlReviewPage'
import PprReviewPage from '@/features/ppr/components/PprReviewPage'

/**
 * Dispatches one task to the right review page.
 *
 * The route is `/tasks/:id` rather than `/tasks/hitl/:id` on purpose: the URL
 * identifies a task, and which page renders it is a property of the task, not of
 * the link. That keeps every existing bookmark and notification valid when a
 * second use case ships, and keeps the two feature folders independent — no
 * shared abstraction is invented until there is a second real page to abstract
 * from.
 */
export default function TaskDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: approval, isLoading } = useApproval(id)

  if (isLoading || !id) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-[60vh] w-full rounded-xl" />
          <Skeleton className="h-[60vh] w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!approval) {
    return <p className="p-4 text-sm text-muted-foreground">Task not found</p>
  }

  const useCase = approval.agent_request?.use_case

  if (useCase === 'HITL') return <HitlReviewPage approval={approval} />
  if (useCase === 'PPR') return <PprReviewPage approval={approval} />

  return (
    <div className="p-4">
      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Unsupported task type</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This task has a use case ({useCase ?? 'unknown'}) that this version of the platform
            cannot display.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
