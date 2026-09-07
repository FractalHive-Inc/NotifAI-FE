import { Badge } from '@/shared/components/ui/badge'
import type { ApprovalListItem } from '@/types/approvals'
import { summariseValidations, type ValidationIssue } from '../lib/validation-summary'

/**
 * The Validations column: how many checks need the reviewer, not which ones.
 *
 * Naming each failure made the cell as tall as the number of things wrong with
 * the document, and a table of ragged multi-line cells is harder to scan than
 * one column of counts — which is the job this column has in a list. The names
 * still travel with the row in the tooltip, and the review page is one click
 * away for the detail.
 *
 * Two colours only, against the review page's seven. The page must distinguish
 * a rule that said no from a validator that crashed, because the reviewer's
 * next action differs; the list only has to answer "does this need me?", and
 * seven shades in a table cell is noise.
 */

/**
 * Amber for "we do not know" — a check that could not run, or answered in a
 * shape we cannot read, is not a finding against the document, and colouring it
 * as one would send reviewers chasing failures that were never asserted. Only
 * when *every* issue is of that kind: one real failure alongside makes the row
 * a genuine failure.
 */
function isUnknownOnly(issues: ValidationIssue[]): boolean {
  return issues.every((issue) => issue.tone === 'NOT_RUN' || issue.tone === 'UNRECOGNISED')
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
      <Badge variant="success" className="font-medium" title="Every check ran and was satisfied">
        Validations Fulfilled
      </Badge>
    )
  }

  const count = summary.issues.length

  return (
    <Badge
      // The registry's own error and warning badges, the same ones the Status
      // column uses, rather than a tint mixed here: a failed check reads as the
      // same kind of red everywhere in the app.
      variant={isUnknownOnly(summary.issues) ? 'pending' : 'error'}
      className="font-medium"
      // The names are still one hover away, so counting loses nothing a
      // reviewer had before deciding whether to open the task.
      title={summary.issues.map((issue) => issue.title).join('\n')}
    >
      {count} {count === 1 ? 'Validation' : 'Validations'} Failed
    </Badge>
  )
}
