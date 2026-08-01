import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card/card'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Button } from '@/shared/components/ui/button/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs/tabs'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import { usePOFolder } from '@/shared/hooks/usePOFolders'
import { ProcessingStatus } from '@/types/documents'
import { formatDateShort, formatFileSize } from '@/shared/lib/formatters'

function getStatusBadgeVariant(status?: string | null) {
  if (!status) return 'outline' as const
  if (status === ProcessingStatus.COMPLETED) return 'success' as const
  if (status === ProcessingStatus.FAILED) return 'destructive' as const
  if (status === ProcessingStatus.PROCESSING) return 'secondary' as const
  return 'outline' as const
}

export default function POFolderDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  const [tabValue, setTabValue] = useState(0)
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

  const { po_folder, invoices = [], supporting_documents = [] } = data

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-muted-foreground">
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => navigate('/documents/po-folders')}
        >
          PO Folders
        </button>
        <span className="mx-1">/</span> PO-{po_folder.po_number}
      </p>

      <h1 className="text-3xl font-bold text-[#043463] sm:text-4xl">PO-{po_folder.po_number}</h1>

      <Badge variant="outline" className="text-sm">
        {invoices.length + supporting_documents.length} Total Documents
      </Badge>

      <Card className="rounded-xl border-[#e4e7ec] py-4 shadow-none">
        <CardContent>
          <Tabs value={String(tabValue)} onValueChange={(value) => setTabValue(Number(value))}>
            <TabsList>
              <TabsTrigger value="0">Invoices ({invoices.length})</TabsTrigger>
              <TabsTrigger value="1">
                Supporting Documents ({supporting_documents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="0" className="pt-2">
              {invoices.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">No invoices in this PO folder</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{invoice.filename}</p>
                        <div className="flex flex-wrap gap-2">
                          {invoice.processing_status && (
                            <Badge variant={getStatusBadgeVariant(invoice.processing_status)}>
                              {invoice.processing_status}
                            </Badge>
                          )}
                          {invoice.is_approved && <Badge variant="success">Approved</Badge>}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/documents/invoices/${invoice.invoice_id}`)}
                      >
                        <Eye className="h-4 w-4" />
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="1" className="pt-2">
              {supporting_documents.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">
                  No supporting documents in this PO folder
                </p>
              ) : (
                <div className="space-y-2">
                  {supporting_documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)} • {formatDateShort(doc.created_at)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/documents/all/${doc.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
