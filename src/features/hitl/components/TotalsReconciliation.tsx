import { AlertTriangle, Check, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { formatIndianAmount } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import type { ReconcileCheck } from '../lib/types'

/**
 * Whether the invoice's arithmetic holds.
 *
 * This is the only automated signal on the page: confidence is not shown, and
 * the agent's own validations have not run yet at HITL time. Given so, it earns
 * prominence — it is the difference between a reviewer checking twenty fields
 * blind and knowing at a glance whether the numbers agree.
 *
 * A mismatch never blocks a decision. Flagging it and letting the human judge is
 * the entire point of human-in-the-loop.
 */

function formatMinor(minor: number | null, currency: string | null): string {
  if (minor === null) return '—'
  return formatIndianAmount(minor / 100, currency)
}

function StatusIcon({ status }: { status: ReconcileCheck['status'] }) {
  if (status === 'OK') return <Check className="h-4 w-4 text-[#2e7d32]" />
  if (status === 'MISMATCH') return <AlertTriangle className="h-4 w-4 text-destructive" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

export default function TotalsReconciliation({ checks }: { checks: ReconcileCheck[] }) {
  const anyMismatch = checks.some((check) => check.status === 'MISMATCH')

  return (
    <Card
      className={cn(
        'rounded-xl shadow-none',
        anyMismatch ? 'border-destructive/50' : 'border-[#e4e7ec]',
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[#043463]">
          Totals &amp; Reconciliation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {checks.map((check) => (
          <div key={check.id} className="flex items-start gap-2">
            <div className="pt-0.5">
              <StatusIcon status={check.status} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#0f172a]">{check.label}</p>

              {check.status === 'INCOMPUTABLE' ? (
                /*
                 * Grey, never red. A missing input is not a discrepancy, and
                 * showing it as one teaches reviewers to ignore the warning
                 * that eventually matters.
                 */
                <p className="text-xs text-muted-foreground">
                  Not verifiable — {check.reason ?? 'not enough data'}
                </p>
              ) : (
                <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs tabular-nums">
                  <span className="text-muted-foreground">
                    Expected {formatMinor(check.expectedMinor, check.currency)}
                  </span>
                  <span className="text-muted-foreground">
                    Found {formatMinor(check.actualMinor, check.currency)}
                  </span>
                  {check.status === 'MISMATCH' && (
                    <span className="font-medium text-destructive">
                      Off by {formatMinor(Math.abs(check.deltaMinor ?? 0), check.currency)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
