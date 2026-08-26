import { type ColumnDef } from '@tanstack/react-table'

/** Sentinel ID for the internally managed row-selection checkbox column. */
export const SELECTION_COLUMN_ID = '__row_select__'

/**
 * Resolve a stable, unique id for each column.
 * Fallback chain: explicit `id` → `accessorKey` → positional `column_N`.
 */
export function getColumnId<TData, TValue>(col: ColumnDef<TData, TValue>, index: number): string {
  if (col.id) return col.id
  const accessorKey = (col as { accessorKey?: string }).accessorKey
  if (accessorKey) return accessorKey
  return `column_${index}`
}
