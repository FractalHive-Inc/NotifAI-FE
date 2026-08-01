import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Input } from '@/shared/components/ui/input/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table/table'
import { cn } from '@/shared/lib/utils'
import type { LineItemsVM } from '../lib/types'

interface LineItemsTableProps {
  lineItems: LineItemsVM
  editing?: boolean
  /**
   * Row-major display text, mirroring `lineItems.columns` order. Only needed
   * when editing — read-only rendering comes from `lineItems` itself, so a
   * caller that cannot edit has no edit state to invent.
   */
  rows?: string[][]
  onChange?: (rowIndex: number, columnIndex: number, value: string) => void
}

export default function LineItemsTable({
  lineItems,
  editing = false,
  rows,
  onChange,
}: LineItemsTableProps) {
  const { columns, ragged, lengths } = lineItems

  if (columns.length === 0) {
    return (
      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-[#043463]">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No line items were extracted. Check the Raw JSON tab and the document itself.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border-[#e4e7ec] shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[#043463]">
          Line Items ({lineItems.rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/*
          The source arrays are positionally correlated, so unequal lengths mean
          the rows below may pair the wrong values together. We show every row of
          the longest column rather than truncating — hiding data from the person
          reviewing it would be worse — and say plainly that alignment is suspect.
        */}
        {ragged && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Columns are misaligned</AlertTitle>
            <AlertDescription>
              <p>
                The extracted columns have different lengths, so rows may not line up. Check each
                row against the document. Editing is disabled until this is fixed upstream.
              </p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {Object.entries(lengths).map(([key, length]) => (
                  <li key={key}>
                    {key}: {length} value{length === 1 ? '' : 's'}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={cn(column.kind === 'money' && 'text-right')}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.rows.map((cells, rowIndex) => (
                <TableRow key={rowIndex}>
                  <TableCell className="text-xs text-muted-foreground">{rowIndex + 1}</TableCell>
                  {columns.map((column, columnIndex) => {
                    const cell = cells[columnIndex] ?? null
                    const isMissing = cell === null

                    return (
                      <TableCell
                        key={column.id}
                        className={cn(
                          column.kind === 'money' && 'text-right tabular-nums',
                          isMissing && 'text-muted-foreground',
                        )}
                      >
                        {editing && !ragged ? (
                          <Input
                            value={rows?.[rowIndex]?.[columnIndex] ?? ''}
                            onChange={(event) =>
                              onChange?.(rowIndex, columnIndex, event.target.value)
                            }
                            className={cn('h-8', column.kind === 'money' && 'text-right')}
                          />
                        ) : isMissing ? (
                          <span title="Missing — the source columns are misaligned">—</span>
                        ) : (
                          cell.raw
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
