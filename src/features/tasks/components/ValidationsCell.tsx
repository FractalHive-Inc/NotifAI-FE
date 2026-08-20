import { Check } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'
import type { ApprovalListItem } from '@/types/approvals'
import { summariseValidations, type ValidationIssue } from '../lib/validation-summary'

/**
 * The Validations column.
 *
 * Failures are named, not counted: "2 issues" tells a reviewer to open the task
 * to find out what is wrong, which is the work the column exists to save. So
 * every problem is spelled out — "Duplicate invoice", "Invalid Seller GSTIN" —
 * and the row is scannable without a click.
 *
 * Two colours only, against the review page's seven. The page must distinguish
 * a rule that said no from a validator that crashed, because the reviewer's
 * next action differs; the list only has to answer "does this need me?", and
 * seven shades in a table cell is noise. The nuance is one click away, and the
 * tooltip carries each check's real name and answer in the meantime.
 */

/** Beyond this, the cell is a wall of badges. The rest go in the tooltip. */
const MAX_SHOWN = 2

function issueClassName(tone: ValidationIssue['tone']): string {
  // Amber for "we do not know" — a check that could not run or answered in a
  // shape we cannot read is not a finding against the document, and colouring
  // it as one would send reviewers chasing failures that were never asserted.
  return tone === 'NOT_RUN' || tone === 'UNRECOGNISED'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-destructive/20 bg-destructive/10 text-destructive'
}

export function ValidationsCell({ approval }: { approval: ApprovalListItem }) {
  const summary = summariseValidations(approval)

  if (summary.kind === 'ABSENT') {
    return (
      <span className="text-muted-foreground" title="This task carries no automated validations">
        —
      </span>
    )
  }

  if (summary.kind === 'ALL_PASSED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2e7d32]">
        <Check className="h-4 w-4 shrink-0" />
        All passed
      </span>
    )
  }

  const shown = summary.issues.slice(0, MAX_SHOWN)
  const hidden = summary.issues.slice(MAX_SHOWN)

  return (
    <div className="flex flex-col items-start gap-1">
      {shown.map((issue) => (
        <Badge
          key={issue.id}
          variant="outline"
          className={cn('font-medium', issueClassName(issue.tone))}
          title={issue.title}
        >
          {issue.label}
        </Badge>
      ))}

      {hidden.length > 0 && (
        <span
          className="text-xs text-muted-foreground"
          title={hidden.map((issue) => issue.title).join('\n')}
        >
          +{hidden.length} more
        </span>
      )}
    </div>
  )
}
