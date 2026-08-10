import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Label } from '@/shared/components/ui/label/label'
import { Button } from '@/shared/components/ui/button/button'
import { Badge } from '@/shared/components/ui/badge/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table/table'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import { useApprovals } from '@/shared/hooks/useApprovals'
import { useAuth } from '@/shared/hooks/useAuth'
import { APPROVAL_STATUS_LABELS, formatConfidence, isUndelivered } from '@/types/approvals'
import type { ApprovalFilters, ApprovalListItem, ApprovalStatus } from '@/types/approvals'
import { formatDate } from '@/shared/lib/formatters'

function statusVariant(status: ApprovalStatus) {
  if (status === 'APPROVED') return 'success' as const
  if (status === 'REJECTED') return 'destructive' as const
  if (status === 'RECLASSIFY') return 'secondary' as const
  return 'outline' as const
}

function TallyStatusBadge({ approval }: { approval: ApprovalListItem }) {
  if (approval.use_case !== 'PPR' || approval.status !== 'APPROVED') return null

  if (approval.tally_status === 'SUCCESS') {
    return (
      <Badge variant="success" title="The approved document was posted to Tally">
        Pushed to Tally
      </Badge>
    )
  }

  if (approval.tally_status === 'FAILED') {
    return (
      <Badge variant="destructive" title={approval.tally_error ?? 'Tally push failed'}>
        Tally push failed
      </Badge>
    )
  }

  if (approval.tally_status === 'PENDING') {
    return (
      <Badge variant="outline" title="The approved document is waiting to be posted to Tally">
        Tally push pending
      </Badge>
    )
  }

  return null
}

const ALL = 'ALL'

export default function TasksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<ApprovalFilters>({})

  const { data, isLoading } = useApprovals(page + 1, pageSize, filters)
  const approvals = data?.approvals || []
  const totalRows = data?.pagination.total || 0
  const totalPages = data?.pagination.total_pages || 1

  const setStatus = (value: string) => {
    setFilters((current) => ({
      ...current,
      status: value === ALL ? undefined : (value as ApprovalStatus),
    }))
    setPage(0)
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#043463] sm:text-3xl">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Documents awaiting your review, assigned to {user?.email ?? 'you'}
        </p>
      </div>

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <CardTitle className="text-base">
              {totalRows} task{totalRows === 1 ? '' : 's'}
            </CardTitle>
            <div className="w-full max-w-[220px] space-y-1">
              <Label htmlFor="task-status">Status</Label>
              <Select value={filters.status ?? ALL} onValueChange={setStatus}>
                <SelectTrigger id="task-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {(Object.keys(APPROVAL_STATUS_LABELS) as ApprovalStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {APPROVAL_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
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
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : approvals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8efff]">
                          <Inbox className="h-5 w-5 text-[#043463]" />
                        </div>
                        <p className="text-sm font-medium text-[#0f172a]">No tasks assigned</p>
                        <p className="text-sm text-muted-foreground">
                          Documents needing review will appear here.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  approvals.map((approval) => (
                    <TableRow
                      key={approval.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/tasks/${approval.id}`)}
                    >
                      <TableCell className="font-medium">
                        {approval.use_case === 'HITL' ? 'Extraction Review' : 'Document Approval'}
                      </TableCell>
                      <TableCell>{approval.source ?? '—'}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {approval.job_id ?? '—'}
                      </TableCell>
                      <TableCell>{formatConfidence(approval.confidence_score)}</TableCell>
                      <TableCell>{formatDate(approval.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariant(approval.status)}>
                            {APPROVAL_STATUS_LABELS[approval.status]}
                          </Badge>
                          <TallyStatusBadge approval={approval} />
                          {approval.use_case !== 'PPR' && isUndelivered(approval) && (
                            <Badge
                              variant="destructive"
                              title="The decision was recorded but has not reached the agent yet"
                            >
                              Not delivered
                            </Badge>
                          )}
                        </div>
                      </TableCell>
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
