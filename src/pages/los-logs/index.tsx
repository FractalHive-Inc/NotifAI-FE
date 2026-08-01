import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileClock,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Label } from '@/shared/components/ui/label/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select/select'
import { Input } from '@/shared/components/ui/input/input'
import { Switch } from '@/shared/components/ui/switch/switch'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Button } from '@/shared/components/ui/button/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table/table'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip/tooltip'
import RetryDialog from '@/components/los-logs/RetryDialog'
import { useLOSLogs, useLOSLogStats, useRetryPush } from '@/shared/hooks/useLOSLogs'
import type { LOSPushLog, LOSPushStatus } from '@/types/losLogs'
import { formatDate } from '@/shared/lib/formatters'

function getStatusChip(status: LOSPushStatus) {
  switch (status) {
    case 'PENDING':
      return (
        <Badge variant="outline" className="gap-1">
          <Clock3 className="h-3.5 w-3.5" />
          Pending
        </Badge>
      )
    case 'SUCCESS':
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Success
        </Badge>
      )
    case 'FAILED':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3.5 w-3.5" />
          Failed
        </Badge>
      )
  }
}

export default function LOSLogsPage() {
  const navigate = useNavigate()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selectedLog, setSelectedLog] = useState<LOSPushLog | null>(null)
  const [retryDialogOpen, setRetryDialogOpen] = useState(false)

  const filters: { status?: LOSPushStatus; date_from?: string; date_to?: string } = {}
  if (statusFilter) filters.status = statusFilter as LOSPushStatus
  if (dateFrom) filters.date_from = dateFrom.toISOString().split('T')[0]
  if (dateTo) filters.date_to = dateTo.toISOString().split('T')[0]

  const { data, isLoading } = useLOSLogs(
    {
      page: page + 1,
      limit: pageSize,
      ...filters,
      invoice_number: invoiceSearch || undefined,
    },
    { refetchInterval: autoRefresh ? 10000 : undefined },
  )

  const { data: stats, isLoading: statsLoading } = useLOSLogStats()
  const retryMutation = useRetryPush()

  const logs = data?.logs || []
  const totalRows = data?.pagination.total || 0
  const totalPages = data?.pagination.total_pages || 1

  const handleRetry = async () => {
    if (!selectedLog) return
    try {
      await retryMutation.mutateAsync(selectedLog.discounting_request_id)
      toast.success('Retry initiated successfully')
      setRetryDialogOpen(false)
      setSelectedLog(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to retry push')
    }
  }

  const handleExport = () => {
    const csv = [
      ['Log ID', 'Status', 'Date', 'Invoice Number', 'Error'].join(','),
      ...logs.map((log) =>
        [
          log.id,
          log.status,
          log.sent_at,
          log.invoice_number || 'N/A',
          log.error_message || '',
        ].join(','),
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `los-logs-${new Date().toISOString()}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#043463] sm:text-3xl">LOS Push Logs</h1>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: 'Total Pushes',
            value: stats?.total || 0,
            icon: <FileClock className="h-4 w-4" />,
          },
          {
            title: 'Success Rate',
            value: `${(stats?.success_rate || 0).toFixed(1)}%`,
            icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
          },
          {
            title: 'Failed',
            value: stats?.failed_count || 0,
            icon: <XCircle className="h-4 w-4 text-red-600" />,
          },
          {
            title: 'Success',
            value: stats?.success_count || 0,
            icon: <CheckCircle2 className="h-4 w-4 text-sky-600" />,
          },
        ].map((item) => (
          <Card key={item.title} className="rounded-xl border-[#e4e7ec] py-4 shadow-none">
            <CardContent className="flex items-center gap-2">
              {item.icon}
              <div>
                <p className="text-xs text-muted-foreground">{item.title}</p>
                {statsLoading ? (
                  <Skeleton className="mt-1 h-6 w-12" />
                ) : (
                  <p className="text-xl font-semibold">{item.value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Filters</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('')
                setInvoiceSearch('')
                setDateFrom(null)
                setDateTo(null)
                setAutoRefresh(false)
                setPage(0)
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
            <div className="space-y-2 xl:col-span-3">
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={statusFilter || 'all'}
                onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
              >
                <SelectTrigger id="status-filter" className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 xl:col-span-3">
              <Label htmlFor="invoice-search">Invoice Number</Label>
              <Input
                id="invoice-search"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Search invoice"
              />
            </div>

            <div className="space-y-2 xl:col-span-3">
              <Label htmlFor="date-from">Date From</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom ? dateFrom.toISOString().split('T')[0] : ''}
                onChange={(e) =>
                  setDateFrom(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null)
                }
              />
            </div>

            <div className="space-y-2 xl:col-span-3">
              <Label htmlFor="date-to">Date To</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo ? dateTo.toISOString().split('T')[0] : ''}
                onChange={(e) =>
                  setDateTo(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null)
                }
              />
            </div>

            <div className="flex items-center xl:col-span-12">
              <Label className="flex h-10 items-center gap-2">
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                Auto-refresh (10s)
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Log ID</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent Date/Time</TableHead>
                <TableHead>Error Message</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <TableRow key={`loading-${idx}`}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : logs.length ? (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/los-logs/${log.id}`)}
                  >
                    <TableCell>{log.id.slice(0, 8)}...</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-primary underline-offset-4 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (log.invoice_number) {
                            navigate(`/invoices?id=${log.discounting_request_id}`)
                          }
                        }}
                      >
                        {log.invoice_number || 'N/A'}
                      </button>
                    </TableCell>
                    <TableCell>{getStatusChip(log.status)}</TableCell>
                    <TableCell>{formatDate(log.sent_at)}</TableCell>
                    <TableCell>
                      {log.error_message ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block max-w-[280px] truncate text-sm">
                              {log.error_message}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>{log.error_message}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/los-logs/${log.id}`)
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>View details</TooltipContent>
                        </Tooltip>
                        {log.status === 'FAILED' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedLog(log)
                                  setRetryDialogOpen(true)
                                }}
                              >
                                <RefreshCw className="h-4 w-4 text-amber-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>Retry push</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No LOS logs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing page {page + 1} of {totalPages} ({totalRows} total)
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPage(0)
                  setPageSize(Number(value))
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                  <SelectItem value="200">200 / page</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedLog && (
        <RetryDialog
          open={retryDialogOpen}
          onClose={() => {
            setRetryDialogOpen(false)
            setSelectedLog(null)
          }}
          onConfirm={handleRetry}
          log={selectedLog}
          isRetrying={retryMutation.isPending}
        />
      )}
    </div>
  )
}
