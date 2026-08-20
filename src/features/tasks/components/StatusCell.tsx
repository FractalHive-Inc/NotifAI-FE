import { Badge } from '@/shared/components/ui/badge'
import { APPROVAL_STATUS_LABELS, isUndelivered } from '@/types/approvals'
import type { ApprovalListItem, ApprovalStatus } from '@/types/approvals'

/**
 * Approved is plain rather than green.
 *
 * Green now means one thing in this table — the Validations tick — and a second
 * green badge two columns over competes with it for the same glance. Status is
 * a fact about where the task got to, not a verdict on the document, so only
 * rejection keeps a colour: it is the one status a reviewer scans for.
 */
function statusVariant(status: ApprovalStatus) {
  if (status === 'REJECTED') return 'error' as const
  if (status === 'RECLASSIFY') return 'secondary' as const
  return 'outline' as const
}

function TallyStatusBadge({ approval }: { approval: ApprovalListItem }) {
  if (approval.use_case !== 'PPR' || approval.status !== 'APPROVED') return null

  if (approval.tally_status === 'SUCCESS') {
    // Plain for the same reason Approved is: it shares the Status column, and a
    // success that needs nothing from the reviewer should not out-shout the
    // failures beside it.
    return (
      <Badge variant="outline" title="The approved document was posted to Tally">
        Pushed to Tally
      </Badge>
    )
  }

  if (approval.tally_status === 'FAILED') {
    return (
      <Badge variant="error" title={approval.tally_error ?? 'Tally push failed'}>
        Tally push failed
      </Badge>
    )
  }

  if (approval.tally_status === 'PENDING') {
    return (
      <Badge variant="outline" title="The approved document is waiting to be posted to Tally">
        Tally push pending
      </Badge>
    )
  }

  return null
}

export function StatusCell({ approval }: { approval: ApprovalListItem }) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant={statusVariant(approval.status)}>
        {APPROVAL_STATUS_LABELS[approval.status]}
      </Badge>
      <TallyStatusBadge approval={approval} />
      {approval.use_case !== 'PPR' && isUndelivered(approval) && (
        <Badge variant="error" title="The decision was recorded but has not reached the agent yet">
          Not delivered
        </Badge>
      )}
    </div>
  )
}
