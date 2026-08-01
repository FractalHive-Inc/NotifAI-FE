import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Input } from '@/shared/components/ui/input/input'
import { Textarea } from '@/shared/components/ui/textarea/textarea'
import { cn } from '@/shared/lib/utils'
import FieldValueView from './FieldValueView'
import { pathKey } from '../lib/apply-edits'
import type { EditSet } from '../lib/apply-edits'
import type { FieldVM, SectionVM } from '../lib/types'

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
  fieldIssues?: Map<string, string[]>
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
                      className={cn(changed && 'border-[#043463]', issues && 'border-destructive')}
                    />
                  ) : (
                    <Input
                      value={current}
                      onChange={(event) => onEdit(field, event.target.value)}
                      className={cn(changed && 'border-[#043463]', issues && 'border-destructive')}
                    />
                  )
                ) : (
                  <FieldValueView value={field.value} />
                )}

                {issues?.map((issue) => (
                  <p key={issue} className="mt-1 text-xs text-destructive">
                    {issue}
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
