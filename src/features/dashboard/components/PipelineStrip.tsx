import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import type { PipelineStage } from '@/features/dashboard/lib/summary'

/**
 * A bar with nothing in it still has to occupy its share of the strip, or the
 * stage disappears and the pipeline looks like it has fewer steps than it does.
 */
const EMPTY_STAGE_WIDTH = '2%'

interface PipelineStripProps {
  stages: PipelineStage[]
  isLoading: boolean
}

/**
 * Where everything currently is, as one horizontal bar.
 *
 * Widths are relative to the largest stage rather than to a total. The stages
 * are not parts of a whole — a document counted under "Received" is also
 * counted under "Decided" once it gets there — so summing them and dividing
 * would draw a proportion that means nothing.
 */
export default function PipelineStrip({ stages, isLoading }: PipelineStripProps) {
  const navigate = useNavigate()
  const peak = Math.max(1, ...stages.map((stage) => stage.count))

  return (
    <Card className="rounded-xl border-[#e4e7ec] shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stages.map((stage) => (
              <div key={stage.key} className="space-y-2">
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stages.map((stage) => (
              <button
                key={stage.key}
                type="button"
                onClick={() => navigate(stage.href)}
                className="group space-y-2 rounded-lg p-2 text-left transition-colors hover:bg-muted/60"
              >
                <p className="text-2xl font-bold text-[#0f172a]">{stage.count}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#eef1f5]">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${stage.barClass}`}
                    style={{
                      width:
                        stage.count === 0 ? EMPTY_STAGE_WIDTH : `${(stage.count / peak) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{stage.label}</p>
              </button>
            ))}
          </div>
        )}

        {/*
          Said plainly rather than left for someone to assume. The first two
          stages come from the ingestion service and the last two from the task
          inbox, and no key on these endpoints links a document across the two —
          so these are current counts per stage, not one cohort followed through.
        */}
        <p className="mt-3 text-xs text-muted-foreground">
          Ingestion and review counts come from separate systems, so a document is not tracked
          across stages. Review figures are yours.
        </p>
      </CardContent>
    </Card>
  )
}
