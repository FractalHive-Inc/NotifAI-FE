import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Info,
  MinusCircle,
} from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'
import type {
  ActionConclusionVM,
  EvaluationResultVM,
  EvaluationTone,
  EvaluationVM,
} from '../lib/parse-action-conclusion'

/**
 * The agent's business validations.
 *
 * Seven tones, not two, because they call for different actions from the
 * reviewer:
 *
 *  - **Blocking** — approval is impossible until this is resolved.
 *  - **Failed** — the rule ran and said no. A real finding; act on it.
 *  - **Warning** — the rule ran and reached a conclusion worth a second look,
 *    but not one that condemns the document.
 *  - **Needs review** — the result arrived in a shape we cannot interpret. We
 *    say so rather than guessing, because guessing "passed" is how a genuine
 *    duplicate gets approved.
 *  - **Could not run** — the tool threw. *Nothing is known.* Rejecting a
 *    document because a duplicate-check crashed would be wrong, and so would
 *    approving it as though the check had passed.
 *  - **Info** — context, no judgement implied.
 *  - **Passed** — the rule ran and was satisfied.
 *
 * The tone sets the colour and nothing else. Every row is in one list, in the
 * contract's order, whatever its outcome: a reviewer reads the same five checks
 * in the same five places on every invoice, and finds a problem by its colour
 * rather than by where the list decided to put it today.
 *
 * What each row *says* is the check's answer — "Invalid Tax Id", "New purchase
 * order", "No duplicate found" — never "Failed". These checks return business
 * verdicts, and "failed" is ambiguous between a bad tax ID and a broken
 * validator. The only rows that say "Failed" or "Could not run" are ones no
 * contract reader claimed, where that is precisely what happened.
 */

interface ToneStyle {
  icon: typeof Check
  iconClassName: string
  badgeVariant: 'success' | 'error' | 'secondary' | 'outline'
  badgeClassName?: string
  headlineClassName: string
}

const TONE_STYLES: Record<EvaluationTone, ToneStyle> = {
  BLOCKED: {
    icon: Ban,
    iconClassName: 'text-destructive',
    badgeVariant: 'error',
    badgeClassName: 'bg-destructive text-white',
    headlineClassName: 'font-medium text-destructive',
  },
  FAILED: {
    icon: AlertTriangle,
    iconClassName: 'text-destructive',
    badgeVariant: 'error',
    headlineClassName: 'text-destructive',
  },
  WARNING: {
    icon: AlertCircle,
    iconClassName: 'text-amber-600',
    badgeVariant: 'secondary',
    badgeClassName: 'bg-amber-50 text-amber-700',
    headlineClassName: 'text-amber-700',
  },
  UNRECOGNISED: {
    icon: HelpCircle,
    iconClassName: 'text-amber-600',
    badgeVariant: 'secondary',
    badgeClassName: 'bg-amber-50 text-amber-700',
    headlineClassName: 'text-amber-700',
  },
  NOT_RUN: {
    icon: MinusCircle,
    iconClassName: 'text-muted-foreground',
    badgeVariant: 'outline',
    headlineClassName: 'text-muted-foreground',
  },
  INFO: {
    icon: Info,
    iconClassName: 'text-[#043463]',
    badgeVariant: 'outline',
    headlineClassName: 'text-[#0f172a]',
  },
  PASSED: {
    icon: Check,
    iconClassName: 'text-[#2e7d32]',
    badgeVariant: 'success',
    headlineClassName: 'text-muted-foreground',
  },
}

/** True when `data` carries something worth a disclosure. */
function hasData(result: EvaluationResultVM): boolean {
  const { data } = result
  if (data === null || data === undefined) return false
  if (Array.isArray(data)) return data.length > 0
  if (typeof data === 'object') return Object.keys(data as object).length > 0
  return true
}

function ResultBody({ result, rowId }: { result: EvaluationResultVM; rowId: string }) {
  const [open, setOpen] = useState(false)
  const style = TONE_STYLES[result.tone]
  const showData = hasData(result)

  // The status is already on the badge. A row whose answer needs nothing added
  // — "Invalid Tax Id" — stays a single line rather than restating itself.
  if (!result.headline && !result.detail && !result.errorCode && !showData) return null

  return (
    <div className="mt-0.5">
      {result.headline && (
        <p className={cn('text-xs', style.headlineClassName)}>{result.headline}</p>
      )}

      {result.detail && <p className="mt-0.5 text-xs text-muted-foreground">{result.detail}</p>}

      {(result.errorCode || showData) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {result.errorCode && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {result.errorCode}
            </span>
          )}

          {showData && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`${rowId}-data`}
              onClick={() => setOpen((current) => !current)}
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Details
            </button>
          )}
        </div>
      )}

      {open && showData && (
        <pre
          id={`${rowId}-data`}
          className="mt-1 overflow-auto rounded bg-muted p-2 text-[10px] leading-relaxed"
        >
          {JSON.stringify(result.data, null, 2)}
        </pre>
      )}
    </div>
  )
}

function suppressDetails(evaluationId: string): boolean {
  return evaluationId === 'validate_seller_gstin' || evaluationId === 'validate_buyer_gstin'
}

function suppressIssueBody(tone: EvaluationTone): boolean {
  return tone === 'BLOCKED' || tone === 'FAILED' || tone === 'WARNING' || tone === 'UNRECOGNISED'
}

function EvaluationRow({ evaluation }: { evaluation: EvaluationVM }) {
  const style = TONE_STYLES[evaluation.tone]
  const Icon = style.icon
  const hideDetails = suppressDetails(evaluation.id) || suppressIssueBody(evaluation.tone)

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg px-2 py-1.5',
        evaluation.tone === 'BLOCKED' && 'bg-destructive/5',
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.iconClassName)} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[#0f172a]">{evaluation.label}</span>
          {/* The check's answer, not its execution state. */}
          <Badge variant={style.badgeVariant} className={style.badgeClassName}>
            {evaluation.status}
          </Badge>
        </div>

        {!hideDetails &&
          evaluation.results.map((result, index) => (
            <ResultBody key={index} result={result} rowId={`${evaluation.id}-${index}`} />
          ))}
      </div>
    </div>
  )
}

/**
 * The one line a reviewer should be able to act on without reading further.
 *
 * Counted by tone, so a check that could not run is never folded in with checks
 * that returned an answer — and never described as one.
 */
function verdict(counts: ActionConclusionVM['counts']): { text: string; blocking: boolean } {
  const issues = counts.FAILED

  const parts = [
    counts.BLOCKED > 0 && `${counts.BLOCKED} blocking`,
    issues > 0 && `${issues} ${issues === 1 ? 'issue' : 'issues'}`,
    counts.WARNING > 0 && `${counts.WARNING} to check`,
    counts.UNRECOGNISED > 0 && `${counts.UNRECOGNISED} need review`,
    counts.NOT_RUN > 0 && `${counts.NOT_RUN} could not run`,
  ].filter((part): part is string => typeof part === 'string')

  if (parts.length === 0) {
    return { text: counts.PASSED > 0 ? 'All checks passed' : 'Nothing to report', blocking: false }
  }

  return { text: parts.join(' · '), blocking: counts.BLOCKED > 0 || counts.FAILED > 0 }
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

  const summary = verdict(conclusion.counts)

  return (
    <Card
      className={cn(
        'rounded-xl shadow-none',
        conclusion.counts.BLOCKED > 0
          ? 'border-destructive'
          : conclusion.counts.FAILED > 0
            ? 'border-destructive/50'
            : 'border-[#e4e7ec]',
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-[#043463]">
            Validations ({conclusion.evaluations.length})
          </CardTitle>
          <span
            className={cn(
              'text-xs font-medium',
              summary.blocking ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {summary.text}
          </span>
        </div>
      </CardHeader>

      {/* One list, in the contract's order, whatever each check concluded. */}
      <CardContent className="space-y-1">
        {conclusion.evaluations.map((evaluation) => (
          <EvaluationRow key={evaluation.id} evaluation={evaluation} />
        ))}
      </CardContent>
    </Card>
  )
}
