import type { EvaluationTone } from '@/features/documents/contracts/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Input } from '@/shared/components/ui/input/input'
import { Textarea } from '@/shared/components/ui/textarea/textarea'
import { cn } from '@/shared/lib/utils'
import FieldValueView from './FieldValueView'
import { pathKey } from '../lib/apply-edits'
import type { EditSet } from '../lib/apply-edits'
import type { FieldVM, SectionVM } from '../lib/types'

/** One validation problem, as it reads against the field it concerns. */
export interface FieldIssue {
  tone: EvaluationTone
  message: string
}

interface FieldSectionProps {
  section: SectionVM
  editing: boolean
  edits: EditSet
  onEdit: (field: FieldVM, raw: string) => void
  /**
   * Validation problems keyed by dotted doc_insights path, e.g.
   * `seller_details.gst_tin`. Shown against the field itself so a failed check
   * appears where the reviewer is already looking, not only in a list further
   * down the page.
   */
  fieldIssues?: Map<string, FieldIssue[]>
}

/**
 * Amber for "look at this", red for "this is wrong". The distinction is the
 * whole reason the marker carries a tone: a PO that is merely unknown to us
 * should not look like a tax ID that failed validation.
 */
const ISSUE_TEXT: Partial<Record<EvaluationTone, string>> = {
  BLOCKED: 'text-destructive font-medium',
  FAILED: 'text-destructive',
  WARNING: 'text-amber-700',
  UNRECOGNISED: 'text-amber-700',
}

function issueClass(tone: EvaluationTone): string {
  return ISSUE_TEXT[tone] ?? 'text-muted-foreground'
}

/** The border an input gets while its field has an unresolved problem. */
function borderClass(issues: FieldIssue[] | undefined): string | undefined {
  if (!issues || issues.length === 0) return undefined
  return issues.some((issue) => issue.tone === 'BLOCKED' || issue.tone === 'FAILED')
    ? 'border-destructive'
    : 'border-amber-500'
}

/** Dotted path for issue lookup; array indices are irrelevant to the mapping. */
function issueKey(field: FieldVM): string {
  return field.path.filter((segment) => typeof segment !== 'number').join('.')
}

/** Long free text gets a textarea; everything else a single-line input. */
function isLongText(field: FieldVM): boolean {
  return field.value.kind === 'text' && field.value.raw.length > 80
}

export default function FieldSection({
  section,
  editing,
  edits,
  onEdit,
  fieldIssues,
}: FieldSectionProps) {
  return (
    <Card className="rounded-xl border-[#e4e7ec] shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[#043463]">{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {section.fields.map((field) => {
          const edit = edits.fields.get(pathKey(field.path))
          const current = edit?.raw ?? field.value.raw
          const changed = edit !== undefined && edit.raw !== edit.previousRaw
          const issues = fieldIssues?.get(issueKey(field))

          return (
            <div
              key={field.id}
              className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:gap-3"
            >
              <span className="pt-1.5 text-xs font-medium text-muted-foreground">
                {field.label}
                {changed && <span className="ml-1 text-[#043463]">•</span>}
              </span>

              <div className="min-w-0">
                {editing && field.editable ? (
                  isLongText(field) ? (
                    <Textarea
                      value={current}
                      rows={3}
                      onChange={(event) => onEdit(field, event.target.value)}
                      className={cn(changed && 'border-[#043463]', borderClass(issues))}
                    />
                  ) : (
                    <Input
                      value={current}
                      onChange={(event) => onEdit(field, event.target.value)}
                      className={cn(changed && 'border-[#043463]', borderClass(issues))}
                    />
                  )
                ) : (
                  <FieldValueView value={field.value} />
                )}

                {issues?.map((issue) => (
                  <p key={issue.message} className={cn('mt-1 text-xs', issueClass(issue.tone))}>
                    {issue.message}
                  </p>
                ))}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
