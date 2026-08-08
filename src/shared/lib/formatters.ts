import { format } from 'date-fns'

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'PPp')
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'PP')
}

/**
 * How long something took, at one unit of precision.
 *
 * Sub-second is reported as `<1s` rather than in milliseconds: the inputs are
 * two server timestamps, and the difference between 40ms and 400ms is not
 * something a reader can act on. A negative span means the clocks disagree, so
 * it is shown as `—` instead of a nonsense duration.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'

  const seconds = Math.floor(ms / 1000)
  if (seconds < 1) return '<1s'
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`

  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount)
}

/**
 * An amount in whatever currency it was actually invoiced in.
 *
 * `formatCurrency` above assumes INR, which is right for a platform figure and
 * wrong for a document: an invoice extracted from the agent carries its own
 * currency, and rendering a PHP total with a ₹ is not a formatting slip but a
 * false statement about what is owed.
 *
 * The code is passed through unrecognised rather than dropped. `Intl` throws on
 * anything that is not a valid ISO code, and the agent sends what the document
 * printed — so an unfamiliar code is shown beside the number instead of taking
 * the page down.
 */
export function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null || !Number.isFinite(amount)) return '—'

  if (currency) {
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount)
    } catch {
      return `${currency} ${new Intl.NumberFormat('en-IN').format(amount)}`
    }
  }

  return new Intl.NumberFormat('en-IN').format(amount)
}
