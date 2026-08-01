import { describeEdits } from '../lib/apply-edits'
import type { EditSet } from '../lib/apply-edits'

/**
 * What the reviewer is about to publish back to the agent.
 *
 * Shown before confirming, because the decision is one-way: once published, the
 * agent resumes on these values. Nobody should send corrections they cannot see.
 */
export default function EditDiffView({
  edits,
  lineItemsChanged,
}: {
  edits: EditSet
  lineItemsChanged: boolean
}) {
  const changes = describeEdits(edits).filter((change) => change.from !== change.to)

  if (changes.length === 0 && !lineItemsChanged) {
    return (
      <p className="text-sm text-muted-foreground">
        No fields were changed. The agent&rsquo;s extraction will be sent back as-is.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#0f172a]">
        {changes.length} field{changes.length === 1 ? '' : 's'} edited
        {lineItemsChanged && ', plus line items'}
      </p>

      <div className="max-h-64 space-y-2 overflow-auto">
        {changes.map((change) => (
          <div key={change.path} className="rounded-md border border-[#e4e7ec] p-2">
            <p className="text-xs font-medium text-muted-foreground">{change.path}</p>
            <div className="mt-1 space-y-0.5 text-sm">
              <p className="text-destructive line-through">{change.from || '(empty)'}</p>
              <p className="text-[#2e7d32]">{change.to || '(empty)'}</p>
            </div>
          </div>
        ))}

        {lineItemsChanged && (
          <div className="rounded-md border border-[#e4e7ec] p-2">
            <p className="text-xs font-medium text-muted-foreground">invoice line items</p>
            <p className="mt-1 text-sm text-[#0f172a]">Table values were edited</p>
          </div>
        )}
      </div>
    </div>
  )
}
