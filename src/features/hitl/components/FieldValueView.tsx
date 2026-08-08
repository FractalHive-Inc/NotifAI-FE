import type { FieldValue } from '../lib/types'

/**
 * The one place a `FieldValue` becomes pixels.
 *
 * Governing rule: **show the raw string the agent produced.** Parsed values
 * exist for arithmetic, not for display — silently "correcting" a number on
 * screen would hide exactly the extraction error the reviewer is here to catch.
 * Anything derived (a formatted date, a currency hint) is a subtitle, never a
 * replacement.
 */
export default function FieldValueView({ value }: { value: FieldValue }) {
  if (!value.raw && value.kind !== 'raw') {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  switch (value.kind) {
    case 'money': {
      /*
       * The agent sends some totals as bare JSON numbers — `3867035.62` — which
       * a reviewer cannot check against a document at a glance without counting
       * digits. Grouped underneath, as a subtitle: the raw value stays the
       * primary reading, exactly as for a date.
       */
      const grouped =
        value.format.numeric && value.value !== null && Math.abs(value.value) >= 1000
          ? value.value.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : null

      return (
        <div>
          <span className="text-sm font-medium tabular-nums text-[#0f172a]">{value.raw}</span>
          {grouped && <p className="text-xs tabular-nums text-muted-foreground">{grouped}</p>}
          {value.value === null && value.raw && (
            <p className="text-xs text-amber-600">Could not be read as a number</p>
          )}
        </div>
      )
    }

    case 'date':
      return (
        <div>
          <span className="text-sm text-[#0f172a]">{value.raw}</span>
          {value.iso ? (
            <p className="text-xs text-muted-foreground">
              {new Date(`${value.iso}T00:00:00Z`).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </p>
          ) : (
            <p className="text-xs text-amber-600">Not a valid DD/MM/YYYY date</p>
          )}
        </div>
      )

    case 'list':
      return (
        <ul className="list-inside list-disc space-y-0.5">
          {value.items.map((item, index) => (
            <li key={index} className="text-sm text-[#0f172a]">
              {item}
            </li>
          ))}
        </ul>
      )

    case 'raw':
      return (
        <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs text-[#0f172a]">
          {JSON.stringify(value.json, null, 2)}
        </pre>
      )

    default:
      return <span className="text-sm whitespace-pre-wrap text-[#0f172a]">{value.raw}</span>
  }
}
