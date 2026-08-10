import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Button } from '@/shared/components/ui/button/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Label } from '@/shared/components/ui/label/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select/select'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table/table'
import { formatDate } from '@/shared/lib/formatters'
import { useApprovals } from '@/shared/hooks/useApprovals'
import type { ApprovalListItem } from '@/types/approvals'

const ALL = 'ALL'
const NOT_PUSHED = 'NOT_PUSHED'

function tallyBadge(row: ApprovalListItem) {
  if (row.tally_status === 'SUCCESS') {
    return <Badge variant="success">Pushed to Tally</Badge>
  }

  if (row.tally_status === 'FAILED') {
    return <Badge variant="destructive">Tally push failed</Badge>
  }

  if (row.tally_status === 'PENDING') {
    return <Badge variant="outline">Tally push pending</Badge>
  }

  return <Badge variant="secondary">Not pushed</Badge>
}

function matchesTallyStatus(row: ApprovalListItem, status: string): boolean {
  if (status === ALL) return true
  if (status === NOT_PUSHED) return row.tally_status === null
  return row.tally_status === status
}

export default function TallyPushLogsPage() {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [tallyStatus, setTallyStatus] = useState<string>(ALL)

  const { data, isLoading } = useApprovals(page + 1, pageSize, { use_case: 'PPR' })
  const rows = (data?.approvals ?? []).filter((row) => matchesTallyStatus(row, tallyStatus))
  const totalRows = data?.pagination.total ?? 0
  const totalPages = data?.pagination.total_pages ?? 1

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#043463] sm:text-3xl">Tally Push Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PPR invoices and their posting status in Tally.
        </p>
      </div>

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <CardTitle className="text-base">
              {totalRows} PPR invoice{totalRows === 1 ? '' : 's'}
            </CardTitle>
            <div className="w-full max-w-[220px] space-y-1">
              <Label htmlFor="tally-status">Tally status</Label>
              <Select
                value={tallyStatus}
                onValueChange={(value) => {
                  setTallyStatus(value)
                  setPage(0)
                }}
              >
                <SelectTrigger id="tally-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  <SelectItem value="SUCCESS">Pushed to Tally</SelectItem>
                  <SelectItem value="FAILED">Tally push failed</SelectItem>
                  <SelectItem value="PENDING">Tally push pending</SelectItem>
                  <SelectItem value={NOT_PUSHED}>Not pushed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last Tried</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8efff]">
                          <FileText className="h-5 w-5 text-[#043463]" />
                        </div>
                        <p className="text-sm font-medium text-[#0f172a]">No Tally records found</p>
                        <p className="text-sm text-muted-foreground">
                          Approved PPR invoices will appear here with their Tally status.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <Button variant="link" className="h-auto p-0 text-[#043463]" asChild>
                          <Link to={`/tasks/${row.id}`}>Open task</Link>
                        </Button>
                      </TableCell>
                      <TableCell>{row.source ?? '—'}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {row.job_id ?? '—'}
                      </TableCell>
                      <TableCell>{tallyBadge(row)}</TableCell>
                      <TableCell>{row.tally_voucher_id ?? '—'}</TableCell>
                      <TableCell>{row.tally_attempts}</TableCell>
                      <TableCell>{row.tally_at ? formatDate(row.tally_at) : '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing page {page + 1} of {totalPages} ({totalRows} total)
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setPage(0)
                }}
              >
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[20, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
