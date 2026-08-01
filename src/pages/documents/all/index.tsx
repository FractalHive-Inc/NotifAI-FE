import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Label } from '@/shared/components/ui/label/label'
import { Input } from '@/shared/components/ui/input/input'
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
import { useDocuments } from '@/shared/hooks/useDocuments'
import { DocumentType, ProcessingStatus } from '@/types/documents'
import type { Document } from '@/types/documents'
import { formatDate, formatFileSize } from '@/shared/lib/formatters'

function getStatusBadgeVariant(status?: string) {
  if (!status) return 'outline' as const
  if (status === ProcessingStatus.COMPLETED) return 'success' as const
  if (status === ProcessingStatus.FAILED) return 'destructive' as const
  if (status === ProcessingStatus.PROCESSING) return 'secondary' as const
  return 'outline' as const
}

export default function AllDocumentsPage() {
  const navigate = useNavigate()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [filters, setFilters] = useState({
    documentType: '',
    poNumber: '',
    processingStatus: '',
  })

  const { data, isLoading } = useDocuments(page + 1, pageSize, filters)
  const documents = data?.documents || []
  const totalRows = data?.pagination.total || 0
  const totalPages = data?.pagination.total_pages || 1

  return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-bold text-[#043463] sm:text-3xl">All Documents</h1>

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Filters</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters({ documentType: '', poNumber: '', processingStatus: '' })
                setPage(0)
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="document-type">Document Type</Label>
              <Select
                value={filters.documentType || 'all'}
                onValueChange={(value) =>
                  setFilters({ ...filters, documentType: value === 'all' ? '' : value })
                }
              >
                <SelectTrigger id="document-type" className="w-full">
                  <SelectValue placeholder="Document Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value={DocumentType.INVOICE}>Invoice</SelectItem>
                  <SelectItem value={DocumentType.SUPPORTING_DOCUMENT}>
                    Supporting Document
                  </SelectItem>
                  <SelectItem value={DocumentType.UNCLASSIFIED}>Unclassified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-number">PO Number</Label>
              <Input
                id="po-number"
                value={filters.poNumber}
                onChange={(e) => setFilters({ ...filters, poNumber: e.target.value })}
                placeholder="Search by PO Number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="processing-status">Processing Status</Label>
              <Select
                value={filters.processingStatus || 'all'}
                onValueChange={(value) =>
                  setFilters({ ...filters, processingStatus: value === 'all' ? '' : value })
                }
              >
                <SelectTrigger id="processing-status" className="w-full">
                  <SelectValue placeholder="Processing Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value={ProcessingStatus.PENDING}>Pending</SelectItem>
                  <SelectItem value={ProcessingStatus.PROCESSING}>Processing</SelectItem>
                  <SelectItem value={ProcessingStatus.COMPLETED}>Completed</SelectItem>
                  <SelectItem value={ProcessingStatus.FAILED}>Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Email Subject</TableHead>
                <TableHead>Received At</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`loading-${idx}`}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : documents.length ? (
                documents.map((doc: Document) => (
                  <TableRow
                    key={doc.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/documents/all/${doc.id}`)}
                  >
                    <TableCell className="font-medium">{doc.filename}</TableCell>
                    <TableCell>
                      {doc.email_sender ? (
                        doc.email_sender
                      ) : doc.email_id ? (
                        <Link
                          to={`/emails?id=${doc.email_id}`}
                          className="text-primary underline-offset-4 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {doc.email_id.substring(0, 8)}...
                        </Link>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {doc.email_subject && doc.email_subject.trim()
                        ? doc.email_subject
                        : 'No subject'}
                    </TableCell>
                    <TableCell>
                      {doc.email_received_at ? formatDate(doc.email_received_at) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.document_type}</Badge>
                    </TableCell>
                    <TableCell>{doc.po_number || 'N/A'}</TableCell>
                    <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                    <TableCell>
                      {doc.classification_confidence ? `${doc.classification_confidence}%` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(doc.processing_status)}>
                        {doc.processing_status || 'N/A'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No documents found.
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
    </div>
  )
}
