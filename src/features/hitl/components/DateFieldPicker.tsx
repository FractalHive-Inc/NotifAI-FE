import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Calendar } from '@/shared/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'

/**
 * ISO `YYYY-MM-DD` as a local-midnight Date.
 *
 * Deliberately not `new Date(iso)`, which parses a bare date as UTC and lands
 * on the previous day west of Greenwich — the calendar would then highlight a
 * day the field does not say.
 */
function fromIso(iso: string): Date | undefined {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return undefined

  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** The inverse, read in local terms for the same reason. */
function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

interface DateFieldPickerProps {
  /** ISO `YYYY-MM-DD`, or empty when the agent's value did not parse as a date. */
  value: string
  /** The raw text to show when `value` is empty — an unparseable date is still
      what the document says, and blanking it would lose it. */
  fallbackLabel: string
  onChange: (iso: string) => void
  className?: string
}

/**
 * The date editor for extracted fields.
 *
 * Replaces `<input type="date">`, whose picker is the browser's: a different
 * widget per browser, none of them matching the rest of this page, and on
 * Chrome an entry field that reads `MM/DD/YYYY` while every document here is
 * `DD/MM/YYYY`. The trigger shows the value in the document's own order.
 */
export default function DateFieldPicker({
  value,
  fallbackLabel,
  onChange,
  className,
}: DateFieldPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? fromIso(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-9 w-full justify-between px-3 font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">
            {selected ? selected.toLocaleDateString('en-GB') : fallbackLabel || 'Select a date'}
          </span>
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(date ? toIso(date) : '')
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
