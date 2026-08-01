import { ChevronRight } from 'lucide-react'
import { titleCase } from '@/features/hitl/lib/primitives'

/**
 * How the agent arrived at this document type.
 *
 * Rendered because a reviewer judging whether a classification is right is
 * helped by seeing the route taken — "commercial › invoices › commercial
 * invoice" is a claim they can check, where the bare label is not.
 */
export default function ClassificationTrail({ path }: { path: unknown }) {
  if (!Array.isArray(path) || path.length === 0) return null

  const steps = path.filter((step): step is string => typeof step === 'string' && step.length > 0)
  if (steps.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      {steps.map((step, index) => (
        <span key={`${step}-${index}`} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3 w-3" />}
          <span className={index === steps.length - 1 ? 'font-medium text-[#043463]' : undefined}>
            {titleCase(step)}
          </span>
        </span>
      ))}
    </div>
  )
}
