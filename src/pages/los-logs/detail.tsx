import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Button } from '@/shared/components/ui/button/button'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Alert, AlertDescription } from '@/shared/components/ui/alert/alert'
import { Separator } from '@/shared/components/ui/separator/separator'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip/tooltip'
import RetryDialog from '@/components/los-logs/RetryDialog'
import { useLOSLogDetail, useRetryPush } from '@/shared/hooks/useLOSLogs'
import type { LOSPushStatus } from '@/types/losLogs'
import { formatDate } from '@/shared/lib/formatters'

function getStatusConfig(status: LOSPushStatus) {
  switch (status) {
    case 'PENDING':
      return {
        variant: 'outline' as const,
        icon: <Clock3 className="h-4 w-4" />,
        label: 'Pending',
      }
    case 'SUCCESS':
      return {
        variant: 'success' as const,
        icon: <CheckCircle2 className="h-4 w-4" />,
        label: 'Success',
      }
    case 'FAILED':
      return {
        variant: 'destructive' as const,
        icon: <XCircle className="h-4 w-4" />,
        label: 'Failed',
      }
    default:
      return {
        variant: 'outline' as const,
        icon: <Clock3 className="h-4 w-4" />,
        label: 'Unknown',
      }
  }
}

export default function LOSLogDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  const { data, isLoading } = useLOSLogDetail(id)
  const retryMutation = useRetryPush()
  const [retryDialogOpen, setRetryDialogOpen] = useState(false)

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  const { log, discounting_request } = data
  const statusConfig = getStatusConfig(log.status)
  const responsePayload = log.response_payload as {
    receiptId?: string
    status?: string
    timestamp?: string
  } | null
  const requestPayloadText = JSON.stringify(log.request_payload, null, 2)
  const responsePayloadText = log.response_payload
    ? JSON.stringify(log.response_payload, null, 2)
    : null

  const handleRetry = async () => {
    try {
      await retryMutation.mutateAsync(log.discounting_request_id)
      toast.success('Retry initiated successfully')
      setRetryDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to retry push')
    }
  }

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-muted-foreground">
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => navigate('/los-logs')}
        >
          LOS Logs
        </button>{' '}
        / Log Details
      </p>

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold text-[#043463]">LOS Push Log</h1>
            <Badge variant={statusConfig.variant} className="gap-1">
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Log ID</p>
              <p className="text-sm font-medium break-all">{log.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sent Timestamp</p>
              <p className="text-sm font-medium">{formatDate(log.sent_at)}</p>
            </div>
            {responsePayload?.timestamp && (
              <div>
                <p className="text-sm text-muted-foreground">Response Timestamp</p>
                <p className="text-sm font-medium">{formatDate(responsePayload.timestamp)}</p>
              </div>
            )}
            {log.status === 'SUCCESS' && responsePayload?.receiptId && (
              <div>
                <p className="text-sm text-muted-foreground">Receipt ID</p>
                <p className="text-sm font-semibold break-all">{responsePayload.receiptId}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Request Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Separator />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Discounting Request ID</p>
              <button
                type="button"
                className="text-primary text-sm hover:underline"
                onClick={() => navigate(`/discounting-requests?id=${log.discounting_request_id}`)}
              >
                {log.discounting_request_id.substring(0, 8)}...
              </button>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invoice Number</p>
              <p className="text-sm font-medium">{log.invoice_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Method</p>
              <p className="text-sm font-medium">POST</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Endpoint</p>
              <p className="text-sm font-medium">/api/los/discounting-request</p>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {responsePayloadText && (
        <Card className="rounded-xl border-[#e4e7ec] shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Response Payload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <pre className="max-h-[420px] overflow-auto text-xs leading-5 whitespace-pre-wrap break-words">
                {responsePayloadText}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {log.status === 'FAILED' && log.error_message && (
        <Card className="rounded-xl border-[#e4e7ec] shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Error Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="border-red-200 bg-red-50 text-red-700">
              <AlertDescription>{log.error_message}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/los-logs')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Logs
        </Button>
        {discounting_request && (
          <Button
            variant="outline"
            onClick={() => navigate(`/discounting-requests?id=${discounting_request.id}`)}
          >
            View Discounting Request
          </Button>
        )}
        {log.status === 'FAILED' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                onClick={() => setRetryDialogOpen(true)}
                disabled={retryMutation.isPending}
              >
                <RefreshCw className="h-4 w-4" />
                Retry Push
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>Retry this failed request</TooltipContent>
          </Tooltip>
        )}
      </div>

      <RetryDialog
        open={retryDialogOpen}
        onClose={() => setRetryDialogOpen(false)}
        onConfirm={handleRetry}
        log={log}
        isRetrying={retryMutation.isPending}
      />
    </div>
  )
}
