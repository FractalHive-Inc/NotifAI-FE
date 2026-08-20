/* eslint-disable react-hooks/set-state-in-effect -- the panel mirrors the committed filter value into local inputs; this repo's ruleset is stricter than the registry's. */
import * as React from 'react'
import { Search, CalendarIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/components/ui/input'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Calendar } from '@/shared/components/ui/calendar'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { formatDate, formatNumber } from './table-filter-helpers'
import type { NumberFilterCondition } from './table-types'

const CONDITION_LABELS: Record<NumberFilterCondition, string> = {
  between: 'Between',
  greater_than: 'Greater than',
  less_than: 'Less than',
  equals: 'Equals',
}

const CONDITION_OPTIONS: NumberFilterCondition[] = [
  'between',
  'greater_than',
  'less_than',
  'equals',
]

// ─── Select Filter Panel ──────────────────────────────────────────────────────

export interface SelectFilterPanelProps {
  label: string
  options: { label: string; value: string }[]
  selected: string[]
  isMulti?: boolean
  onToggle: (value: string) => void
  onSelectAll: (values: string[]) => void
  onClearAll: () => void
}

export function SelectFilterPanel({
  label,
  options,
  selected,
  isMulti = true,
  onToggle,
  onSelectAll,
  onClearAll,
}: SelectFilterPanelProps) {
  const [search, setSearch] = React.useState('')
  const displayed = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))

  const handleSelectAll = () => {
    if (search.trim()) {
      const displayedValues = displayed.map((o) => o.value)
      const combined = Array.from(new Set([...selected, ...displayedValues]))
      onSelectAll(combined)
    } else {
      onSelectAll(options.map((o) => o.value))
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Filter by {label}
        </p>
        <div className="flex items-center gap-2">
          {isMulti && (
            <>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-semibold text-[#1B2B48] hover:underline cursor-pointer transition-colors"
              >
                Select All
              </button>
              <span className="text-muted-foreground/30 text-xs">•</span>
            </>
          )}
          <button
            type="button"
            onClick={onClearAll}
            disabled={selected.length === 0}
            className="text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="relative mb-3 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${label}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 rounded-lg border-muted"
        />
      </div>
      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="pb-4">
          {displayed.length > 0 ? (
            displayed.map((opt, index) => {
              const checked = selected.includes(opt.value)
              const isPrevSelected = index > 0 && selected.includes(displayed[index - 1].value)
              const isNextSelected =
                index < displayed.length - 1 && selected.includes(displayed[index + 1].value)

              const roundedClasses = checked
                ? !isPrevSelected && !isNextSelected
                  ? 'rounded-lg'
                  : !isPrevSelected && isNextSelected
                    ? 'rounded-t-lg'
                    : isPrevSelected && isNextSelected
                      ? 'rounded-none'
                      : 'rounded-b-lg'
                : 'rounded-lg'

              const borderClasses =
                checked && isNextSelected
                  ? 'border-b-0'
                  : 'border-b border-border/40 last:border-b-0'

              return (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                    borderClasses,
                    roundedClasses,
                    checked ? 'bg-[#C9D8E5]' : 'hover:bg-[#EEF0F2]',
                  )}
                >
                  {isMulti ? (
                    <Checkbox checked={checked} onCheckedChange={() => onToggle(opt.value)} />
                  ) : (
                    <>
                      <input
                        type="radio"
                        name={`select-${label}`}
                        className="peer sr-only"
                        checked={checked}
                        onChange={() => onToggle(opt.value)}
                      />
                      <div
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                          checked ? 'bg-[#1B2B48] border-[#1B2B48]' : 'border-input bg-transparent',
                        )}
                      >
                        {checked && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </>
                  )}
                  <span
                    className={cn(
                      'text-sm',
                      checked ? 'text-foreground font-medium' : 'text-muted-foreground',
                    )}
                  >
                    {opt.label}
                  </span>
                </label>
              )
            })
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">No options found.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  )
}

// ─── Text Filter Panel ────────────────────────────────────────────────────────

export interface TextFilterPanelProps {
  label: string
  placeholder?: string
  value: string
  onChange: (val: string) => void
}

export function TextFilterPanel({ label, placeholder, value, onChange }: TextFilterPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Filter by {label}
      </p>
      <Input
        placeholder={placeholder ?? `Search ${label}...`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  )
}

// ─── Number Filter Panel ──────────────────────────────────────────────────────

export interface NumberFilterPanelProps {
  label: string
  value?: [number, number] | null
  onChange: (val: [number, number] | undefined) => void
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
  presets?: {
    label: string
    value: [number, number]
    condition?: NumberFilterCondition
  }[]
}

export function NumberFilterPanel({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  prefix,
  suffix,
  presets,
}: NumberFilterPanelProps) {
  const [localMin, setLocalMin] = React.useState(
    value && value[0] !== undefined ? String(value[0]) : '',
  )
  const [localMax, setLocalMax] = React.useState(
    value && value[1] !== undefined ? String(value[1]) : '',
  )

  const [condition, setCondition] = React.useState<NumberFilterCondition>('between')

  const getPresetCondition = React.useCallback(
    (p: {
      label: string
      value: [number, number]
      condition?: NumberFilterCondition
    }): NumberFilterCondition => {
      if (p.condition) return p.condition
      if (p.value[0] === p.value[1]) return 'equals'
      if (p.value[0] === min || p.value[0] === 0) return 'less_than'
      if (p.value[1] === max || p.value[1] >= 999999999) return 'greater_than'
      return 'between'
    },
    [min, max],
  )

  React.useEffect(() => {
    if (!value) {
      setLocalMin('')
      setLocalMax('')
      return
    }
    // Infer active condition from value if set
    if (value[0] === value[1] && value[0] !== undefined) {
      setCondition('equals')
      setLocalMin(String(value[0]))
      setLocalMax(String(value[0]))
    } else if (value[0] === min || value[0] === 0) {
      setCondition('less_than')
      setLocalMin('')
      setLocalMax(String(value[1]))
    } else if (value[1] === max || value[1] >= 999999999) {
      setCondition('greater_than')
      setLocalMin(String(value[0]))
      setLocalMax('')
    } else {
      setCondition('between')
      setLocalMin(value[0] !== undefined ? String(value[0]) : '')
      setLocalMax(value[1] !== undefined ? String(value[1]) : '')
    }
  }, [value, min, max])

  const handleConditionChange = (newCond: NumberFilterCondition) => {
    setCondition(newCond)
    if (newCond === 'less_than') {
      const maxVal = parseFloat(localMax) || parseFloat(localMin)
      if (!isNaN(maxVal)) {
        setLocalMin('')
        setLocalMax(String(maxVal))
        onChange([min, maxVal])
      }
    } else if (newCond === 'greater_than') {
      const minVal = parseFloat(localMin) || parseFloat(localMax)
      if (!isNaN(minVal)) {
        setLocalMin(String(minVal))
        setLocalMax('')
        onChange([minVal, max])
      }
    } else if (newCond === 'equals') {
      const eqVal = parseFloat(localMin) || parseFloat(localMax)
      if (!isNaN(eqVal)) {
        setLocalMin(String(eqVal))
        setLocalMax(String(eqVal))
        onChange([eqVal, eqVal])
      }
    } else if (newCond === 'between') {
      const nMin = parseFloat(localMin)
      const nMax = parseFloat(localMax)
      if (!isNaN(nMin) && !isNaN(nMax)) {
        onChange([nMin, nMax])
      }
    }
  }

  const handlePresetClick = (p: {
    label: string
    value: [number, number]
    condition?: NumberFilterCondition
  }) => {
    const targetCond = getPresetCondition(p)
    setCondition(targetCond)
    if (targetCond === 'less_than') {
      setLocalMin('')
      setLocalMax(String(p.value[1]))
      onChange([min, p.value[1]])
    } else if (targetCond === 'greater_than') {
      setLocalMin(String(p.value[0]))
      setLocalMax('')
      onChange([p.value[0], max])
    } else if (targetCond === 'equals') {
      setLocalMin(String(p.value[0]))
      setLocalMax(String(p.value[0]))
      onChange([p.value[0], p.value[0]])
    } else {
      setLocalMin(String(p.value[0]))
      setLocalMax(String(p.value[1]))
      onChange(p.value)
    }
  }

  const isPresetActive = (p: {
    label: string
    value: [number, number]
    condition?: NumberFilterCondition
  }) => {
    if (!value) return false
    const targetCond = getPresetCondition(p)
    if (condition !== targetCond) return false

    if (targetCond === 'less_than') {
      return value[1] === p.value[1]
    }
    if (targetCond === 'greater_than') {
      return value[0] === p.value[0]
    }
    if (targetCond === 'equals') {
      return value[0] === p.value[0] && value[1] === p.value[0]
    }
    return value[0] === p.value[0] && value[1] === p.value[1]
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Filter by {label}
        </p>
        {(localMin !== '' || localMax !== '') && (
          <button
            type="button"
            onClick={() => {
              setLocalMin('')
              setLocalMax('')
              onChange(undefined)
            }}
            className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground font-medium">Condition</span>
        <Select
          value={condition}
          onValueChange={(v) => handleConditionChange(v as NumberFilterCondition)}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_OPTIONS.map((optKey) => (
              <SelectItem key={optKey} value={optKey}>
                {CONDITION_LABELS[optKey]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {condition === 'between' ? (
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-xs text-muted-foreground font-medium">Min</span>
            <Input
              type="number"
              step={step}
              value={localMin}
              onChange={(e) => {
                setLocalMin(e.target.value)
                const n = parseFloat(e.target.value)
                if (!isNaN(n)) onChange([n, value?.[1] ?? max])
                else if (e.target.value === '' && !localMax) onChange(undefined)
              }}
              className="h-9"
              placeholder={formatNumber(min, prefix, suffix)}
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-xs text-muted-foreground font-medium">Max</span>
            <Input
              type="number"
              step={step}
              value={localMax}
              onChange={(e) => {
                setLocalMax(e.target.value)
                const n = parseFloat(e.target.value)
                if (!isNaN(n)) onChange([value?.[0] ?? min, n])
                else if (e.target.value === '' && !localMin) onChange(undefined)
              }}
              className="h-9"
              placeholder={formatNumber(max, prefix, suffix)}
            />
          </div>
        </div>
      ) : condition === 'greater_than' ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium">Value</span>
          <Input
            type="number"
            step={step}
            value={localMin}
            onChange={(e) => {
              setLocalMin(e.target.value)
              const n = parseFloat(e.target.value)
              if (!isNaN(n)) onChange([n, max ?? 999999999])
              else if (e.target.value === '') onChange(undefined)
            }}
            className="h-9"
            placeholder={formatNumber(min, prefix, suffix)}
          />
        </div>
      ) : condition === 'less_than' ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium">Value</span>
          <Input
            type="number"
            step={step}
            value={localMax}
            onChange={(e) => {
              setLocalMax(e.target.value)
              const n = parseFloat(e.target.value)
              if (!isNaN(n)) onChange([min ?? 0, n])
              else if (e.target.value === '') onChange(undefined)
            }}
            className="h-9"
            placeholder={formatNumber(max, prefix, suffix)}
          />
        </div>
      ) : (
        /* Equals */
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium">Value</span>
          <Input
            type="number"
            step={step}
            value={localMin}
            onChange={(e) => {
              setLocalMin(e.target.value)
              setLocalMax(e.target.value)
              const n = parseFloat(e.target.value)
              if (!isNaN(n)) onChange([n, n])
              else if (e.target.value === '') onChange(undefined)
            }}
            className="h-9"
            placeholder={formatNumber(min, prefix, suffix)}
          />
        </div>
      )}

      {presets && presets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">Presets</span>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePresetClick(p)}
                className={cn(
                  'px-2.5 py-1 bg-white rounded-md text-xs font-medium border transition-colors cursor-pointer',
                  isPresetActive(p)
                    ? 'bg-[#1B2B48] text-white border-[#1B2B48]'
                    : 'border-border text-muted-foreground hover:bg-muted/30',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Date Filter Panel ────────────────────────────────────────────────────────

export interface DateFilterPanelProps {
  label: string
  value: Date | null
  onChange: (date: Date | null) => void
}

export function DateFilterPanel({ label, value, onChange }: DateFilterPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Filter by {label}
      </p>
      <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/10 text-xs font-medium text-[#14181D]">
        <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
        <span>{value ? formatDate(value) : 'No date selected'}</span>
      </div>
      <div className="border rounded-lg p-1 bg-background flex justify-center ">
        <Calendar
          className="bg-white"
          mode="single"
          selected={value ?? undefined}
          onSelect={(d) => onChange(d ?? null)}
        />
      </div>
    </div>
  )
}

// ─── Date Range Filter Panel ──────────────────────────────────────────────────

export interface DateRangeFilterPanelProps {
  label: string
  value: [Date | null, Date | null]
  onChange: (range: [Date | null, Date | null]) => void
}

export function DateRangeFilterPanel({ label, value, onChange }: DateRangeFilterPanelProps) {
  const [from, to] = value
  const [quickActive, setQuickActive] = React.useState<string | null>(null)

  const quickRanges = [
    { label: 'Today', days: 0 },
    { label: 'Yesterday', days: 1 },
    { label: 'Last 7d', days: 7 },
    { label: 'Last 30d', days: 30 },
    { label: 'Last 90d', days: 90 },
    { label: 'Last 1yr', days: 365 },
  ]

  const applyQuick = (label: string, days: number) => {
    const end = new Date()
    const start = new Date()
    if (days === 0) {
      onChange([end, end])
    } else if (days === 1) {
      start.setDate(start.getDate() - 1)
      end.setDate(end.getDate() - 1)
      onChange([start, end])
    } else {
      start.setDate(start.getDate() - days)
      onChange([start, end])
    }
    setQuickActive(label)
  }

  const rangeText =
    from && to
      ? `${formatDate(from)} – ${formatDate(to)}`
      : from
        ? `From ${formatDate(from)}`
        : 'No date range selected'

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Filter by {label}
      </p>

      {/* Selected range display row */}
      <div className="flex items-center justify-between border rounded-lg px-3 py-2 bg-muted/10 text-xs font-medium text-[#14181D]">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
          <span>{rangeText}</span>
        </div>
        {(from || to) && (
          <button
            type="button"
            onClick={() => {
              onChange([null, null])
              setQuickActive(null)
            }}
            className="text-xs font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-1.5">
        {quickRanges.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => applyQuick(q.label, q.days)}
            className={cn(
              'px-2.5 py-1 bg-white rounded-md text-xs font-medium border transition-colors',
              quickActive === q.label
                ? 'bg-primary text-white border-primary'
                : 'border-border text-muted-foreground hover:bg-muted/30',
            )}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Inline Calendar */}
      <div className="border rounded-lg p-1 bg-background flex justify-center">
        <Calendar
          className="bg-white"
          mode="range"
          selected={from && to ? { from, to } : from ? { from } : undefined}
          onSelect={(range) => {
            setQuickActive(null)
            onChange([range?.from ?? null, range?.to ?? null])
          }}
          numberOfMonths={2}
        />
      </div>
    </div>
  )
}
