import { TriangleAlert } from 'lucide-react'
import type { LOSPushLog } from '@/types/losLogs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog/dialog'
import { Button } from '@/shared/components/ui/button/button'
import { Alert, AlertDescription } from '@/shared/components/ui/alert/alert'

interface RetryDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  log: LOSPushLog
  isRetrying: boolean
}

export default function RetryDialog({
  open,
  onClose,
  onConfirm,
  log,
  isRetrying,
}: RetryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-amber-500" />
            Retry Push to LOS
          </DialogTitle>
        </DialogHeader>

        <Alert className="mb-2 border-amber-200 bg-amber-50 text-amber-700">
          <AlertDescription>
            This will create a new push attempt. The previous failure will remain in the logs for
            audit purposes.
          </AlertDescription>
        </Alert>

        {log.error_message && (
          <div className="mb-2">
            <p className="mb-1 text-sm text-muted-foreground">Previous Error:</p>
            <Alert className="border-red-200 bg-red-50 text-red-700">
              <AlertDescription>{log.error_message}</AlertDescription>
            </Alert>
          </div>
        )}

        <p className="text-sm text-muted-foreground">Invoice: {log.invoice_number || 'N/A'}</p>

        {isRetrying && <div className="mt-2 h-1 w-full animate-pulse rounded bg-primary/30" />}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRetrying}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isRetrying}>
            {isRetrying ? 'Retrying...' : 'Confirm Retry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
