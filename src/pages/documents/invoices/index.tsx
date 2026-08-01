import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card/card'
import { Label } from '@/shared/components/ui/label/label'
import { Input } from '@/shared/components/ui/input/input'
import { Switch } from '@/shared/components/ui/switch/switch'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Button } from '@/shared/components/ui/button/button'
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
import { useInvoices } from '@/shared/hooks/useInvoices'
import type { Invoice } from '@/types/invoices'
import { formatCurrency, formatDateShort } from '@/shared/lib/formatters'

export default function InvoicesPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState({
    isApproved: '',
    hasDuplicate: false,
    poNumber: '',
    vendorName: '',
  })

  const { data, isLoading } = useInvoices(page + 1, pageSize, filters)
  const invoices = data?.invoices || []
  const totalRows = data?.pagination.total || 0
  const totalPages = data?.pagination.total_pages || 1

  return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-bold text-[#043463] sm:text-3xl">Invoices</h1>

      <Card className="rounded-xl border-[#e4e7ec] shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Filters</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters({
                  isApproved: '',
                  hasDuplicate: false,
                  poNumber: '',
                  vendorName: '',
                })
                setPage(0)
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="approval-status">Approval Status</Label>
              <Select
                value={filters.isApproved || 'all'}
                onValueChange={(value) =>
                  setFilters({ ...filters, isApproved: value === 'all' ? '' : value })
                }
              >
                <SelectTrigger id="approval-status" className="w-full">
                  <SelectValue placeholder="Approval Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Approved</SelectItem>
                  <SelectItem value="false">Pending</SelectItem>
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
              <Label htmlFor="vendor-name">Vendor Name</Label>
              <Input
                id="vendor-name"
                value={filters.vendorName}
                onChange={(e) => setFilters({ ...filters, vendorName: e.target.value })}
                placeholder="Search by vendor"
              />
            </div>

            <div className="flex items-end">
              <label
                htmlFor="duplicates-only"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Switch
                  id="duplicates-only"
                  checked={filters.hasDuplicate}
                  onCheckedChange={(checked) =>
                    setFilters({ ...filters, hasDuplicate: Boolean(checked) })
                  }
                />
                Show Only Duplicates
              </label>
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
                <TableHead>Invoice Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Warning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`loading-${idx}`}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : invoices.length ? (
                invoices.map((invoice: Invoice) => (
                  <TableRow
                    key={invoice.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/documents/invoices/${invoice.id}`)}
                  >
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.vendor_name || 'N/A'}</TableCell>
                    <TableCell>{invoice.po_number || 'N/A'}</TableCell>
                    <TableCell>{formatDateShort(invoice.invoice_date)}</TableCell>
                    <TableCell>{formatCurrency(invoice.invoice_total_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.is_approved ? 'success' : 'outline'}>
                        {invoice.is_approved ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approved
                          </>
                        ) : (
                          'Pending'
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.has_duplicate_warning ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No invoices found.
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
