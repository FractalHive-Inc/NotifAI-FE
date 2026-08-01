import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileClock,
  Send,
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
import PushConfirmationDialog from '@/components/discounting-requests/PushConfirmationDialog'
import {
  useDiscountingRequestDetail,
  useDiscountingRequestStats,
  useDiscountingRequests,
  usePushToLOS,
} from '@/shared/hooks/useDiscountingRequests'
import type { DiscountingRequest } from '@/types/discountingRequests'
import { formatCurrency, formatDateShort } from '@/shared/lib/formatters'

function getStatusChip(request: DiscountingRequest) {
  if (request.los_receipt_id) {
    return (
      <Badge variant="success" className="gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>Pushed to LOS</TooltipContent>
        </Tooltip>
        {`Pushed: ${request.los_receipt_id}`}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Clock3 className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>Not pushed yet</TooltipContent>
      </Tooltip>
      Not Pushed
    </Badge>
  )
}

export default function DiscountingRequestsPage() {
  const navigate = useNavigate()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [pushStatusFilter, setPushStatusFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)

  const filters: { has_receipt?: boolean; date_from?: string; date_to?: string } = {}
  if (pushStatusFilter === 'pushed') filters.has_receipt = true
  else if (pushStatusFilter === 'not_pushed') filters.has_receipt = false
  if (dateFrom) filters.date_from = dateFrom.toISOString().split('T')[0]
  if (dateTo) filters.date_to = dateTo.toISOString().split('T')[0]

  const { data, isLoading } = useDiscountingRequests({
    page: page + 1,
    limit: pageSize,
    ...filters,
  })

  const { data: stats, isLoading: statsLoading } = useDiscountingRequestStats()
  const { data: selectedRequestDetail, isLoading: isLoadingDetail } = useDiscountingRequestDetail(
    selectedRequestId || '',
  )
  const pushMutation = usePushToLOS()

  const requests = data?.discounting_requests || []
  const totalRows = data?.pagination.total || 0
  const totalPages = data?.pagination.total_pages || 1

  const selectedRequest = selectedRequestDetail
    ? (() => {
        const dr = selectedRequestDetail.discounting_request
        const invoice = selectedRequestDetail.invoice
        const payload = dr.request_payload as {
          invoice_number?: string
          vendor_name?: string
          invoice_total_amount?: number
          po_number?: string
        }
        return {
          ...dr,
          invoice_number: invoice?.invoice_number || payload?.invoice_number || dr.invoice_number,
          vendor_name: invoice?.vendor_name || payload?.vendor_name || dr.vendor_name,
          invoice_total_amount:
            invoice?.invoice_total_amount ||
            payload?.invoice_total_amount ||
            dr.invoice_total_amount,
          po_number: invoice?.po_number || payload?.po_number || dr.po_number,
        }
      })()
    : null

  const pushDialogOpen = Boolean(selectedRequestId && selectedRequest && !isLoadingDetail)

  const handlePush = async () => {
    if (!selectedRequestId) return
    try {
      await pushMutation.mutateAsync(selectedRequestId)
      toast.success('Successfully pushed to LOS')
      setSelectedRequestId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to push to LOS')
    }
  }

  return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-bold text-[#043463] sm:text-3xl">Discounting Requests</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            title: 'Total Requests',
            value: stats?.total || 0,
            icon: <FileClock className="h-4 w-4" />,
            iconTooltip: 'Total requests',
          },
          {
            title: 'Pushed',
            value: stats?.pushed || 0,
            icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
            iconTooltip: 'Successfully pushed',
          },
          {
            title: 'Pending',
            value: stats?.pending || 0,
            icon: <Clock3 className="h-4 w-4 text-amber-600" />,
            iconTooltip: 'Pending push',
          },
          {
            title: 'Failed',
            value: stats?.failed || 0,
            icon: <AlertCircle className="h-4 w-4 text-red-600" />,
            iconTooltip: 'Failed requests',
          },
          {
            title: 'Success Rate',
            value: `${(stats?.success_rate || 0).toFixed(1)}%`,
            icon: <CheckCircle2 className="h-4 w-4 text-sky-600" />,
            iconTooltip: 'Push success rate',
          },
        ].map((item) => (
          <Card key={item.title} className="rounded-xl border-[#e4e7ec] py-4 shadow-none">
            <CardContent className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>{item.icon}</TooltipTrigger>
                <TooltipContent sideOffset={6}>{item.iconTooltip}</TooltipContent>
              </Tooltip>
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
                setPushStatusFilter('')
                setDateFrom(null)
                setDateTo(null)
                setPage(0)
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="push-status">Push Status</Label>
              <Select
                value={pushStatusFilter || 'all'}
                onValueChange={(value) => {
                  setPushStatusFilter(value === 'all' ? '' : value)
                  setPage(0)
                }}
              >
                <SelectTrigger id="push-status" className="w-full">
                  <SelectValue placeholder="Push Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pushed">Pushed</SelectItem>
                  <SelectItem value="not_pushed">Not Pushed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-from">Date From</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom ? dateFrom.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  setDateFrom(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null)
                  setPage(0)
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-to">Date To</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo ? dateTo.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  setDateTo(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null)
                  setPage(0)
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>LOS Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Pushed At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`loading-${idx}`}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : requests.length ? (
                requests.map((request) => (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/documents/discounting-requests/${request.id}`)}
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="text-primary underline-offset-4 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/documents/invoices/${request.invoice_id}`)
                        }}
                      >
                        {request.invoice_number || 'N/A'}
                      </button>
                    </TableCell>
                    <TableCell>{request.vendor_name || 'N/A'}</TableCell>
                    <TableCell>{request.po_number || 'N/A'}</TableCell>
                    <TableCell>{formatCurrency(request.invoice_total_amount || 0)}</TableCell>
                    <TableCell>{getStatusChip(request)}</TableCell>
                    <TableCell>{formatDateShort(request.created_at)}</TableCell>
                    <TableCell>
                      {request.sent_to_los_at ? formatDateShort(request.sent_to_los_at) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/documents/discounting-requests/${request.id}`)
                          }}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Eye className="h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>View details</TooltipContent>
                          </Tooltip>
                        </Button>
                        {!request.los_receipt_id && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRequestId(request.id)
                            }}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Send className="h-4 w-4 text-primary" />
                              </TooltipTrigger>
                              <TooltipContent sideOffset={6}>Push to LOS</TooltipContent>
                            </Tooltip>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/los-logs?discounting_request_id=${request.id}`)
                          }}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <FileClock className="h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>View logs</TooltipContent>
                          </Tooltip>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No discounting requests found.
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
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page === 0}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ChevronLeft className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>Previous page</TooltipContent>
                </Tooltip>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={page >= totalPages - 1}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ChevronRight className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>Next page</TooltipContent>
                </Tooltip>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedRequest && !isLoadingDetail && (
        <PushConfirmationDialog
          open={pushDialogOpen}
          onClose={() => setSelectedRequestId(null)}
          onConfirm={handlePush}
          request={selectedRequest}
          isPushing={pushMutation.isPending}
        />
      )}
    </div>
  )
}
