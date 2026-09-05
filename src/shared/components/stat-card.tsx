import { Card, CardContent } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'

interface StatCardProps {
  label: string
  value: number
  isLoading: boolean
  /** A coloured dot before the label, for counts that belong to a status. */
  dotClass?: string
  /** Makes the card actionable; without it the card is inert. */
  onClick?: () => void
  /** Draws attention only when the number means something needs chasing. */
  alarming?: boolean
}

/**
 * One counted figure: the card the dashboard and Incoming Requests are both
 * built from, so a number cannot look like a different kind of thing depending
 * on which page it is read on.
 */
export function StatCard({ label, value, isLoading, dotClass, onClick, alarming }: StatCardProps) {
  return (
    <Card
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onClick,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            },
          }
        : {})}
      className={`rounded-xl py-4 shadow-none transition-colors ${
        alarming ? 'border-rose-200 bg-rose-50/40' : 'border-[#e4e7ec]'
      } ${onClick ? `cursor-pointer ${alarming ? 'hover:border-rose-300' : 'hover:border-[#c8d0db]'}` : ''}`}
    >
      <CardContent className="px-4">
        {/* A skeleton rather than a dash: a dash is a legible count ("none"),
            and showing it before the first response reads as an answer instead
            of as a page that has not loaded yet. */}
        {isLoading ? (
          <Skeleton className="my-1 h-6 w-10" />
        ) : (
          <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
        )}
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {dotClass && <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />}
          {label}
        </p>
      </CardContent>
    </Card>
  )
}
