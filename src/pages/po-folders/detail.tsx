import { useNavigate, useParams } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { usePOFolder } from '@/shared/hooks/usePOFolders'
import { APPROVAL_STATUS_LABELS } from '@/types/approvals'
import type { POFolderInvoice } from '@/types/poFolders'
import { formatAmount, formatDateShort } from '@/shared/lib/formatters'

/**
 * One purchase order, and every invoice filed against it.
 *
 * There is no supporting-documents tab any more: that belonged to the email
 * pipeline, where a folder was a set of rows in `nai.documents`. A folder now
 * holds invoices only, so a tab strip with one tab in it earns nothing.
 */

/** Nothing to say when the voucher was never owed — a rejected invoice posts nowhere. */
function TallyBadge({ invoice }: { invoice: POFolderInvoice }) {
  if (invoice.tally_status === null) return null

  if (invoice.tally_status === 'SUCCESS') {
    return (
      <Badge variant="success">
        In Tally{invoice.tally_voucher_id ? ` · ${invoice.tally_voucher_id}` : ''}
      </Badge>
    )
  }

  // PENDING and FAILED read the same to someone looking at this list: the
  // voucher is not there. The task page is where the difference — and the retry —
  // lives.
  return <Badge variant="error">Not in Tally</Badge>
}

export default function POFolderDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  const { data, isLoading } = usePOFolder(id)

  if (isLoading || !id) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-[320px] w-full rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">PO Folder not found</p>
  }

  const { po_folder, invoices = [] } = data

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-muted-foreground">
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => navigate('/po-folders')}
        >
          PO Folders
        </button>
        <span className="mx-1">/</span> {po_folder.po_number}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-[#043463] sm:text-4xl">{po_folder.po_number}</h1>
        <Badge variant="outline" className="text-sm">
          {invoices.length} {invoices.length === 1 ? 'Invoice' : 'Invoices'}
        </Badge>
      </div>

      <Card className="rounded-xl border-[#e4e7ec] py-4 shadow-none">
        <CardContent>
          {invoices.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No invoices in this PO folder</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-medium">
                      {/* An invoice number is not guaranteed to extract; the
                          vendor and the amount still identify the document. */}
                      {invoice.invoice_number ?? 'No invoice number'}
                      {invoice.vendor_name && (
                        <span className="text-muted-foreground"> · {invoice.vendor_name}</span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {formatAmount(invoice.invoice_total_amount, invoice.invoice_currency)}
                      </Badge>
                      {invoice.approval_status && (
                        <Badge
                          variant={invoice.approval_status === 'APPROVED' ? 'success' : 'outline'}
                        >
                          {APPROVAL_STATUS_LABELS[invoice.approval_status]}
                        </Badge>
                      )}
                      <TallyBadge invoice={invoice} />
                      <span className="text-xs text-muted-foreground">
                        {invoice.invoice_date
                          ? formatDateShort(invoice.invoice_date)
                          : `Filed ${formatDateShort(invoice.created_at)}`}
                      </span>
                    </div>
                  </div>

                  {/*
                   * Through to the approval, which is the only page that holds
                   * the document itself and the extraction behind these figures.
                   * Absent for the legacy rows that predate the agent.
                   */}
                  {invoice.approval_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/tasks/${invoice.approval_id}`)}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
