import * as React from 'react'

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'

import { Button, buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import type { CalendarWeek, DayButton } from 'react-day-picker'

function getMonthBoundaries(
  disabled?: React.ComponentProps<typeof DayPicker>['disabled'],
  startMonth?: Date,
  endMonth?: Date,
  fromDate?: Date,
  toDate?: Date,
) {
  let computedStartMonth = startMonth ?? fromDate
  let computedEndMonth = endMonth ?? toDate

  if (disabled) {
    const matchers = Array.isArray(disabled) ? disabled : [disabled]
    for (const m of matchers) {
      if (m && typeof m === 'object') {
        if ('before' in m && m.before) {
          const beforeDate = m.before instanceof Date ? m.before : new Date(m.before)
          if (!isNaN(beforeDate.getTime())) {
            const beforeMonth = new Date(beforeDate.getFullYear(), beforeDate.getMonth(), 1)
            if (!computedStartMonth || beforeMonth > computedStartMonth) {
              computedStartMonth = beforeMonth
            }
          }
        }
        if ('after' in m && m.after) {
          const afterDate = m.after instanceof Date ? m.after : new Date(m.after)
          if (!isNaN(afterDate.getTime())) {
            const afterMonth = new Date(afterDate.getFullYear(), afterDate.getMonth(), 1)
            if (!computedEndMonth || afterMonth < computedEndMonth) {
              computedEndMonth = afterMonth
            }
          }
        }
      }
    }
  }

  return { startMonth: computedStartMonth, endMonth: computedEndMonth }
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'dropdown',
  buttonVariant = 'ghost',
  formatters,
  components,
  disabled,
  startMonth,
  endMonth,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant']
}) {
  const defaultClassNames = getDefaultClassNames()

  const { startMonth: computedStartMonth, endMonth: computedEndMonth } = getMonthBoundaries(
    disabled,
    startMonth,
    endMonth,
    (props as { fromDate?: Date }).fromDate,
    (props as { toDate?: Date }).toDate,
  )

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      disabled={disabled}
      startMonth={computedStartMonth}
      endMonth={computedEndMonth}
      className={cn(
        'bg-background group/calendar p-3 [--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent',
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date: Date) => date.toLocaleString('default', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn('relative flex flex-col gap-4 md:flex-row', defaultClassNames.months),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium',
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          'has-focus:border-ring border-input has-focus:ring-ring/50 relative rounded-md border shadow-xs has-focus:ring-[3px]',
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn('bg-popover absolute inset-0 opacity-0', defaultClassNames.dropdown),
        caption_label: cn(
          'font-medium select-none',
          captionLayout === 'label'
            ? 'text-sm'
            : '[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pr-1 pl-2 text-sm [&>svg]:size-3.5',
          defaultClassNames.caption_label,
        ),
        //table: 'w-full border-collapse',
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'text-muted-foreground flex-1 rounded-md text-[0.8rem] font-normal select-none',
          defaultClassNames.weekday,
        ),
        week: cn('mt-2 flex w-full', defaultClassNames.week),
        week_number_header: cn('w-(--cell-size) select-none', defaultClassNames.week_number_header),
        week_number: cn(
          'text-muted-foreground text-[0.8rem] select-none',
          defaultClassNames.week_number,
        ),
        day: cn(
          'group/day relative aspect-square h-full w-full p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-md',
          props.showWeekNumber
            ? '[&:nth-child(2)[data-selected=true]_button]:rounded-l-md'
            : '[&:first-child[data-selected=true]_button]:rounded-l-md',
          defaultClassNames.day,
        ),
        range_start: cn('bg-accent rounded-l-md ', defaultClassNames.range_start),
        range_middle: cn('rounded-none ', defaultClassNames.range_middle),
        range_end: cn('bg-accent rounded-r-md', defaultClassNames.range_end),
        today: cn(
          'bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none',
          defaultClassNames.today,
        ),
        outside: cn(
          'text-muted-foreground aria-selected:text-muted-foreground',
          defaultClassNames.outside,
        ),
        disabled: cn('text-muted-foreground opacity-50', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({
          className,
          rootRef,
          ...props
        }: React.HTMLAttributes<HTMLDivElement> & { rootRef?: React.Ref<HTMLDivElement> }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />
        },
        Chevron: ({
          className,
          orientation,
          ...props
        }: { className?: string; orientation?: string } & React.SVGAttributes<SVGSVGElement>) => {
          if (orientation === 'left') {
            return <ChevronLeftIcon className={cn('size-4', className)} {...props} />
          }

          if (orientation === 'right') {
            return <ChevronRightIcon className={cn('size-4', className)} {...props} />
          }

          return <ChevronDownIcon className={cn('size-4', className)} {...props} />
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({
          children,
          week: _week,
          ...props
        }: React.ThHTMLAttributes<HTMLTableCellElement> & {
          week: CalendarWeek
          children?: React.ReactNode
        }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'data-[selected-single=true]:bg-fh-primary-100 data-[selected-single=true]:text-primary data-[range-middle=true]:bg-fh-gray-100 data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-fh-primary-100 data-[range-start=true]:text-primary data-[range-end=true]:bg-fh-primary-100 data-[range-end=true]:text-primary group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-sm data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-sm data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70',
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
