import { Badge } from '@/shared/components/ui/badge'
import { APPROVAL_STATUS_LABELS, isUndelivered } from '@/types/approvals'
import type { ApprovalListItem } from '@/types/approvals'

type BadgeVariant = 'error' | 'success' | 'secondary' | 'pending' | 'outline'

interface StatusBadge {
  label: string
  variant: BadgeVariant
  title?: string
}

/**
 * The one thing the Status column says about a task.
 *
 * Deliberately a single badge rather than a status plus a delivery marker: an
 * approved document that reached Tally was showing "Approved" and "Pushed to
 * Tally" side by side, which reads as two competing statuses when it is really
 * one task that moved one step further. The furthest point the task reached
 * wins, so the badge always answers "where is this now?".
 *
 * Failures outrank the decision for the same reason they always did — a push
 * that did not land is the fact a reviewer is scanning for, not the approval
 * that preceded it.
 */
function statusBadge(approval: ApprovalListItem): StatusBadge {
  const label = APPROVAL_STATUS_LABELS[approval.status]

  // HITL: the decision was recorded but the agent has not heard it yet, which
  // leaves the document stuck mid-extraction — that is where the task is, not a
  // footnote beside the decision.
  if (isUndelivered(approval) && approval.use_case !== 'PPR') {
    return {
      label: 'Not delivered',
      variant: 'error',
      title: 'The decision was recorded but has not reached the agent yet',
    }
  }

  if (approval.status !== 'APPROVED') {
    if (approval.status === 'REJECTED') return { label, variant: 'error' }
    if (approval.status === 'RECLASSIFY') return { label, variant: 'secondary' }
    if (approval.status === 'PENDING') return { label, variant: 'pending' }
    return { label, variant: 'outline' }
  }

  if (approval.use_case === 'PPR') {
    if (approval.tally_status === 'SUCCESS') {
      return {
        label: 'Pushed to Tally',
        variant: 'success',
        title: 'The approved document was posted to Tally',
      }
    }

    if (approval.tally_status === 'FAILED') {
      return {
        label: 'Tally push failed',
        variant: 'error',
        title: approval.tally_error ?? 'Tally push failed',
      }
    }

    // PENDING, or NULL where nothing is owed to Tally: the decision is still
    // the latest thing that happened to the task.
    return { label, variant: 'success' }
  }

  return { label, variant: 'success' }
}

export function StatusCell({ approval }: { approval: ApprovalListItem }) {
  const { label, variant, title } = statusBadge(approval)

  return (
    <Badge variant={variant} title={title}>
      {label}
    </Badge>
  )
}
