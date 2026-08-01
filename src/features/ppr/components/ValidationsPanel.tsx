import { AlertTriangle, Check, HelpCircle, MinusCircle } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { cn } from '@/shared/lib/utils'
import { EVALUATION_STATUS_LABELS } from '../lib/parse-action-conclusion'
import type {
  ActionConclusionVM,
  EvaluationStatus,
  EvaluationVM,
} from '../lib/parse-action-conclusion'

/**
 * The agent's business validations.
 *
 * Four states, not two, because they call for different actions from the
 * reviewer:
 *
 *  - **Passed** — the rule ran and was satisfied.
 *  - **Failed** — the rule ran and said no. A real finding; act on it.
 *  - **Could not run** — the tool threw. *Nothing is known.* Rejecting a
 *    document because a duplicate-check crashed would be wrong, and so would
 *    approving it as though the check had passed.
 *  - **Needs review** — the result arrived in a shape we cannot interpret. We
 *    say so rather than guessing, because guessing "passed" is how a genuine
 *    duplicate gets approved.
 */

const STATUS_STYLES: Record<
  EvaluationStatus,
  {
    icon: typeof Check
    className: string
    badge: 'success' | 'destructive' | 'secondary' | 'outline'
  }
> = {
  PASSED: { icon: Check, className: 'text-[#2e7d32]', badge: 'success' },
  FAILED: { icon: AlertTriangle, className: 'text-destructive', badge: 'destructive' },
  NOT_RUN: { icon: MinusCircle, className: 'text-muted-foreground', badge: 'outline' },
  UNRECOGNISED: { icon: HelpCircle, className: 'text-amber-600', badge: 'secondary' },
}

function EvaluationRow({ evaluation }: { evaluation: EvaluationVM }) {
  const style = STATUS_STYLES[evaluation.status]
  const Icon = style.icon

  return (
    <div className="flex items-start gap-2">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.className)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#0f172a]">{evaluation.label}</span>
          <Badge variant={style.badge}>{EVALUATION_STATUS_LABELS[evaluation.status]}</Badge>
        </div>

        {evaluation.results.map((result, index) => (
          <div key={index} className="mt-0.5">
            {result.message && (
              <p
                className={cn(
                  'text-xs',
                  result.status === 'FAILED' ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {result.message}
              </p>
            )}
            {result.status === 'NOT_RUN' && (
              <p className="text-xs text-muted-foreground">
                This check did not complete, so its outcome is unknown — verify manually.
              </p>
            )}
            {result.status === 'UNRECOGNISED' && (
              <p className="text-xs text-amber-600">
                The result could not be interpreted — check the Raw JSON tab.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ValidationsPanel({ conclusion }: { conclusion: ActionConclusionVM }) {
  if (conclusion.absent) {
    return (
      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-[#043463]">Validations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The agent reported no validation results for this document.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { counts } = conclusion
  const needsAttention = counts.FAILED + counts.NOT_RUN + counts.UNRECOGNISED

  const summary = [
    counts.FAILED > 0 && `${counts.FAILED} failed`,
    counts.NOT_RUN > 0 && `${counts.NOT_RUN} could not run`,
    counts.UNRECOGNISED > 0 && `${counts.UNRECOGNISED} need review`,
    counts.PASSED > 0 && `${counts.PASSED} passed`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Card
      className={cn(
        'rounded-xl shadow-none',
        counts.FAILED > 0 ? 'border-destructive/50' : 'border-[#e4e7ec]',
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-[#043463]">
            Validations ({conclusion.evaluations.length})
          </CardTitle>
          <span
            className={cn(
              'text-xs',
              needsAttention > 0 ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {summary}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {conclusion.evaluations.map((evaluation) => (
          <EvaluationRow key={evaluation.id} evaluation={evaluation} />
        ))}
      </CardContent>
    </Card>
  )
}
