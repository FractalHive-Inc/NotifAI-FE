/**
 * How a processing job's status looks, shared by the list and the detail sheet
 * so a job cannot be amber in one and grey in the other.
 */

/**
 * Only the two ends of the pipeline get a colour. `received` and `in_progress`
 * are the normal state of a healthy queue — colouring them makes a working
 * system look like it needs attention, and leaves nothing for `failed` to stand
 * out against. `under_review` is the exception: it is waiting on a person, which
 * is the one non-terminal state someone can act on.
 */
export function statusBadgeVariant(status: string) {
  if (status === 'completed') return 'success' as const
  if (status === 'failed') return 'destructive' as const
  if (status === 'under_review') return 'secondary' as const
  return 'outline' as const
}

/** Matching dot colour for the counts along the top of the page. */
export function statusDotClass(status: string): string {
  if (status === 'completed') return 'bg-emerald-500'
  if (status === 'failed') return 'bg-destructive'
  if (status === 'under_review') return 'bg-amber-500'
  if (status === 'in_progress') return 'bg-blue-500'
  return 'bg-slate-400'
}
