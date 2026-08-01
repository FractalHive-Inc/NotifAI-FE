import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock3, FileClock, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Button } from '@/shared/components/ui/button/button'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Separator } from '@/shared/components/ui/separator/separator'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table/table'
import PushConfirmationDialog from '@/components/discounting-requests/PushConfirmationDialog'
import {
  useDiscountingRequestDetail,
  usePushToLOS,
  useRetryPushDR,
} from '@/shared/hooks/useDiscountingRequests'
import { useLOSLogs } from '@/shared/hooks/useLOSLogs'
import { formatCurrency, formatDate } from '@/shared/lib/formatters'

export default function DiscountingRequestDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()

  const { data, isLoading } = useDiscountingRequestDetail(id)
  const { data: logsData } = useLOSLogs({ limit: 100 })
  const pushMutation = usePushToLOS()
  const retryMutation = useRetryPushDR()
  const [pushDialogOpen, setPushDialogOpen] = useState(false)

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  const { discounting_request, invoice } = data
  const request = discounting_request

  const relatedLogs =
    logsData?.logs.filter((log) => log.discounting_request_id === request.id) || []

  const payload = request.request_payload as {
    attached_documents?: Array<{
      document_id: string
      filename: string
      document_type: string
    }>
  }

  const handlePush = async () => {
    try {
      await pushMutation.mutateAsync(request.id)
      toast.success('Successfully pushed to LOS')
      setPushDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to push to LOS')
    }
  }

  const canPush = !request.los_receipt_id
  const canRetry =
    relatedLogs.length > 0 && relatedLogs[relatedLogs.length - 1]?.status === 'FAILED'
  const requestPayloadText = JSON.stringify(request.request_payload, null, 2)

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-muted-foreground">
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => navigate('/documents/discounting-requests')}
        >
          Discounting Requests
        </button>{' '}
        / Request Details
      </p>

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold text-[#043463]">Discounting Request</h1>
            {request.los_receipt_id ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {`Pushed: ${request.los_receipt_id}`}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Clock3 className="h-4 w-4" />
                Not Pushed
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Request ID</p>
              <p className="text-sm font-medium break-all">{request.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created Date</p>
              <p className="text-sm font-medium">{formatDate(request.created_at)}</p>
            </div>
            {request.los_receipt_id && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">LOS Receipt ID</p>
                  <p className="text-sm font-medium break-all">{request.los_receipt_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pushed At</p>
                  <p className="text-sm font-medium">
                    {request.sent_to_los_at ? formatDate(request.sent_to_los_at) : 'N/A'}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {invoice && (
        <Card className="rounded-xl border-[#e4e7ec] shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Separator />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Invoice Number</p>
                <button
                  type="button"
                  className="text-primary text-sm hover:underline"
                  onClick={() => navigate(`/documents/invoices/${invoice.id}`)}
                >
                  {invoice.invoice_number}
                </button>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendor Name</p>
                <p className="text-sm font-medium">{invoice.vendor_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PO Number</p>
                {invoice.po_number ? (
                  <button
                    type="button"
                    className="text-primary text-sm hover:underline"
                    onClick={() => navigate(`/documents/po-folders?po=${invoice.po_number}`)}
                  >
                    {invoice.po_number}
                  </button>
                ) : (
                  <p className="text-sm font-medium">N/A</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Invoice Total</p>
                <p className="text-sm font-medium">
                  {formatCurrency(invoice.invoice_total_amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Invoice Date</p>
                <p className="text-sm font-medium">{formatDate(invoice.invoice_date)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Request Payload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <pre className="max-h-[420px] overflow-auto text-xs leading-5 whitespace-pre-wrap break-words">
              {requestPayloadText}
            </pre>
          </div>
        </CardContent>
      </Card>

      {payload.attached_documents && payload.attached_documents.length > 0 && (
        <Card className="rounded-xl border-[#e4e7ec] shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">
              {`Attached Documents (${payload.attached_documents.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.attached_documents.map((doc) => (
                  <TableRow key={doc.document_id}>
                    <TableCell>{doc.filename}</TableCell>
                    <TableCell>{doc.document_type}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/documents/all/${doc.document_id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {relatedLogs.length > 0 && (
        <Card className="rounded-xl border-[#e4e7ec] shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Push History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Log ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.status === 'SUCCESS' ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Success
                        </Badge>
                      ) : log.status === 'FAILED' ? (
                        <Badge variant="destructive" className="gap-1">
                          <RefreshCw className="h-3.5 w-3.5" />
                          Failed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(log.sent_at)}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-primary text-sm hover:underline"
                        onClick={() => navigate(`/los-logs/${log.id}`)}
                      >
                        {log.id.slice(0, 8)}...
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/documents/discounting-requests')}>
          <ArrowLeft className="h-4 w-4" />
          Back to List
        </Button>
        {canPush && (
          <Button
            variant="default"
            onClick={() => setPushDialogOpen(true)}
            disabled={pushMutation.isPending}
          >
            <Send className="h-4 w-4" />
            Push to LOS
          </Button>
        )}
        {canRetry && (
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await retryMutation.mutateAsync(request.id)
                toast.success('Retry initiated')
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed to retry push')
              }
            }}
            disabled={retryMutation.isPending}
          >
            <RefreshCw className="h-4 w-4" />
            Retry Push
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => navigate(`/los-logs?discounting_request_id=${request.id}`)}
        >
          <FileClock className="h-4 w-4" />
          View All Logs
        </Button>
      </div>

      <PushConfirmationDialog
        open={pushDialogOpen}
        onClose={() => setPushDialogOpen(false)}
        onConfirm={handlePush}
        request={request}
        isPushing={pushMutation.isPending}
      />
    </div>
  )
}
