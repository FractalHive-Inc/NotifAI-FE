import { Button } from '@/shared/components/ui/button/button'
import { Label } from '@/shared/components/ui/label/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select/select'
import { DOCUMENT_TYPE_OPTIONS } from '@/types/approvals'
import type { ApprovalAction, CorrectUseCase } from '@/types/approvals'

interface DecisionBarProps {
  /** What the agent classified this as. */
  originalUseCase: string
  selectedUseCase: CorrectUseCase
  onSelectUseCase: (value: CorrectUseCase) => void
  disabled: boolean
  onAct: (action: ApprovalAction) => void
}

/**
 * The extraction-review decision: confirm the classification, correct it, or
 * reject the document.
 *
 * Always visible at the foot of the page — the decision is the point of the
 * screen and must never require scrolling to find.
 *
 * There is no field editing here. The agent is paused mid-extraction, so
 * corrections made at this point would be overwritten by the extraction that
 * follows; they belong on the document approval page, where the values are
 * final. This bar is deliberately only about the document's *type*.
 *
 * Reclassify is enabled only once the dropdown differs from what the agent said,
 * because reclassifying to the same type would send the agent back to re-extract
 * exactly what it already produced.
 */
export default function DecisionBar({
  originalUseCase,
  selectedUseCase,
  onSelectUseCase,
  disabled,
  onAct,
}: DecisionBarProps) {
  const reclassified = selectedUseCase !== originalUseCase

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#e4e7ec] bg-background px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-[220px] space-y-1">
          <Label htmlFor="document-type">Document type</Label>
          <Select
            value={selectedUseCase}
            onValueChange={(value) => onSelectUseCase(value as CorrectUseCase)}
            disabled={disabled}
          >
            <SelectTrigger id="document-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="destructive" onClick={() => onAct('REJECT')} disabled={disabled}>
          Reject
        </Button>
        <Button
          variant="outline"
          onClick={() => onAct('RECLASSIFY')}
          disabled={disabled || !reclassified}
          title={reclassified ? undefined : 'Pick a different document type to reclassify'}
        >
          Reclassify
        </Button>
        <Button
          className="bg-[#101f45] text-white hover:bg-[#142958]"
          onClick={() => onAct('APPROVE')}
          disabled={disabled || reclassified}
          title={reclassified ? 'Document type changed — use Reclassify' : undefined}
        >
          Approve
        </Button>
      </div>
    </div>
  )
}
