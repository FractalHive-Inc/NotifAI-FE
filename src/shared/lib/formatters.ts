import { format } from 'date-fns'

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'PPp')
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'PP')
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
