import { TriangleAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog/dialog'
import { Button } from '@/shared/components/ui/button/button'
import { Alert, AlertDescription } from '@/shared/components/ui/alert/alert'

interface UncategoriseInvoiceDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isUncategorising: boolean
}

export default function UncategoriseInvoiceDialog({
  open,
  onClose,
  onConfirm,
  isUncategorising,
}: UncategoriseInvoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-red-600" />
            Uncategorise Invoice
          </DialogTitle>
        </DialogHeader>

        <Alert className="mb-2 border-red-200 bg-red-50 text-red-700">
          <AlertDescription>
            Warning: This will delete the invoice data and move the document back to unclassified.
          </AlertDescription>
        </Alert>

        <p className="text-sm">This action will:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Delete all extracted invoice data</li>
          <li>Delete all line items</li>
          <li>Remove PO number association</li>
          <li>Set document type to UNCLASSIFIED</li>
        </ul>

        <p className="mt-2 text-sm font-semibold">
          You will need to reclassify and reprocess the document to create a new invoice.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isUncategorising}>
            {isUncategorising ? 'Processing...' : 'Confirm Uncategorise'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
