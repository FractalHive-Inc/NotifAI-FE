import { TriangleAlert } from 'lucide-react'
import type { DiscountingRequest } from '@/types/discountingRequests'
import { formatCurrency } from '@/shared/lib/formatters'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog/dialog'
import { Button } from '@/shared/components/ui/button/button'
import { Alert, AlertDescription } from '@/shared/components/ui/alert/alert'
import { Separator } from '@/shared/components/ui/separator/separator'

interface PushConfirmationDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  request: DiscountingRequest
  isPushing: boolean
}

export default function PushConfirmationDialog({
  open,
  onClose,
  onConfirm,
  request,
  isPushing,
}: PushConfirmationDialogProps) {
  const payload = request.request_payload as {
    line_items?: unknown[]
    attached_documents?: unknown[]
    invoice_number?: string
    vendor_name?: string
    invoice_total_amount?: number
    po_number?: string
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-amber-500" />
            Push to LOS
          </DialogTitle>
        </DialogHeader>

        <Alert className="mb-2">
          <AlertDescription>
            This will send the discounting request to the Loan Origination System (LOS). This action
            cannot be undone.
          </AlertDescription>
        </Alert>

        <p className="text-sm text-muted-foreground">Request Summary</p>

        <div className="rounded-md border border-border bg-muted/20 p-3">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Invoice Number:</span>
            <span className="font-semibold">
              {request.invoice_number || payload.invoice_number || 'N/A'}
            </span>
          </div>

          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Vendor:</span>
            <span>{request.vendor_name || payload.vendor_name || 'N/A'}</span>
          </div>

          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Line Items:</span>
            <span>{payload.line_items?.length || 0}</span>
          </div>

          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Attached Documents:</span>
            <span>{payload.attached_documents?.length || 0}</span>
          </div>

          <Separator className="my-2" />

          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Amount:</span>
            <span className="text-lg font-semibold text-primary">
              {formatCurrency(request.invoice_total_amount || payload.invoice_total_amount || 0)}
            </span>
          </div>
        </div>

        {isPushing && <div className="mt-2 h-1 w-full animate-pulse rounded bg-primary/30" />}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPushing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPushing}>
            {isPushing ? 'Pushing...' : 'Confirm Push'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
