import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { pathKey } from '../lib/apply-edits'
import type { EditSet } from '../lib/apply-edits'
import type { SectionVM } from '../lib/types'

/**
 * Where each editable field sits, keyed the same way the edits are.
 *
 * The edit itself only carries a `doc_insights` path, which is the agent's
 * vocabulary and not the reviewer's: `seller_details.gst_tin` is the same field
 * the page calls "GST TIN" under "Seller Details", and only one of those two
 * names appears anywhere else on screen.
 */
function labelIndex(input: SectionVM[]): Map<string, { section: string; field: string }> {
  const index = new Map<string, { section: string; field: string }>()

  for (const section of input) {
    for (const field of section.fields) {
      index.set(pathKey(field.path), { section: section.title, field: field.label })
    }
  }

  return index
}

/**
 * What the reviewer is about to publish back to the agent.
 *
 * Shown before confirming, because the decision is one-way: once published, the
 * agent resumes on these values. Nobody should send corrections they cannot see.
 */
export default function EditDiffView({
  edits,
  lineItemsChanged,
  sections,
  onReset,
  onResetLineItems,
}: {
  edits: EditSet
  lineItemsChanged: boolean
  /**
   * The rendered sections, used only to name the edited fields. Omitted, each
   * row falls back to its dotted path — a field the contract does not describe
   * has no label to show, and dropping the row would hide a correction that is
   * still submitted.
   */
  sections?: SectionVM[]
  /**
   * Discard one field's correction, keyed as `pathKey(edit.path)`.
   *
   * Optional because the same list is rendered where discarding makes no sense:
   * in the confirm dialog the reviewer is reading what they are about to submit,
   * and a control that silently changes the payload mid-confirmation is a trap.
   * Omit both handlers and the list is read-only.
   */
  onReset?: (key: string) => void
  onResetLineItems?: () => void
}) {
  // Rebuilt only when the sections change, not on every keystroke: this list
  // re-renders with each edit, and the index is derived from the contract, which
  // does not move while a reviewer types.
  const labels = useMemo(() => labelIndex(sections ?? []), [sections])

  /*
   * Keyed off the map rather than `describeEdits`, which flattens the path to a
   * dotted string and so cannot address the entry it came from.
   */
  const changes = [...edits.fields.entries()]
    .map(([key, edit]) => ({
      key,
      label: labels.get(key),
      path: edit.path.join('.'),
      from: edit.previousRaw,
      to: edit.raw,
    }))
    .filter((change) => change.from !== change.to)

  if (changes.length === 0 && !lineItemsChanged) {
    return (
      <p className="text-sm text-muted-foreground">
        No fields were changed. The agent&rsquo;s extraction will be sent back as-is.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {/*
       * Assembled from the parts that actually apply. Printing the count
       * unconditionally read "0 fields edited, plus line items" whenever the
       * only correction was in the table.
       */}
      <p className="text-sm  text-[#0f172a]">
        {[
          changes.length > 0 && `${changes.length} field${changes.length === 1 ? '' : 's'} edited`,
          lineItemsChanged && 'line items edited',
        ]
          .filter(Boolean)
          .join(', ')}
      </p>

      <div className="max-h-64 space-y-2 overflow-auto">
        {changes.map((change) => (
          <div key={change.key} className="rounded-md border border-[#e4e7ec] p-2">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-body text-[#0f172a]">{change.label?.field}</p>
              {onReset && (
                <button
                  type="button"
                  onClick={() => onReset(change.key)}
                  className="shrink-0 text-muted-foreground hover:text-[#043463]"
                  title={`Restore ${change.from || '(empty)'}`}
                  aria-label={`Undo the correction to ${change.label?.field ?? change.path}`}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-1 space-y-0.5 text-sm">
              <p className="text-destructive line-through">{change.from || '(empty)'}</p>
              <p className="text-[#2e7d32]">{change.to || '(empty)'}</p>
            </div>
          </div>
        ))}

        {lineItemsChanged && (
          <div className="rounded-md border border-[#e4e7ec] p-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-[#0f172a]">Line items</p>
              {onResetLineItems && (
                <button
                  type="button"
                  onClick={onResetLineItems}
                  className="shrink-0 text-muted-foreground hover:text-[#043463]"
                  title="Restore the extracted table"
                  aria-label="Undo the line-item edits"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-[#0f172a]">Table values were edited</p>
          </div>
        )}
      </div>
    </div>
  )
}
