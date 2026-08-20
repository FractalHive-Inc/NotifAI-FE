import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Folder, Search } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { usePOFolders } from '@/shared/hooks/usePOFolders'
import { formatAmount, formatDateShort } from '@/shared/lib/formatters'

/**
 * Every purchase order we hold invoices against.
 *
 * Folders are opened by the approval path, not from here: approving an invoice
 * that references a PO number files it, creating the folder if it is the first
 * one. So an empty list means nothing has been approved yet, not that something
 * is misconfigured.
 */
export default function POFoldersPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const { data: poFolders, isLoading } = usePOFolders()

  const term = searchTerm.trim().toLowerCase()
  const filteredFolders =
    poFolders?.filter((folder) => folder.po_number.toLowerCase().includes(term)) ?? []

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#043463] sm:text-3xl">PO Folders</h1>
          <p className="text-sm text-muted-foreground">
            Approved invoices, grouped by the purchase order they reference.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-[320px]">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search PO Number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <button
            type="button"
            className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
            onClick={() => setSearchTerm('')}
          >
            Clear
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={`po-skeleton-${idx}`} className="h-[180px] w-full rounded-xl" />
          ))}
        </div>
      ) : filteredFolders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {poFolders?.length
            ? 'No purchase order matches that search.'
            : 'No purchase orders yet. A folder is created when the first invoice referencing it is approved.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredFolders.map((folder) => (
            <Card
              key={folder.id}
              className="cursor-pointer rounded-xl border-[#e4e7ec] py-5 shadow-none transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => navigate(`/po-folders/${folder.id}`)}
            >
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Folder className="h-8 w-8 shrink-0 text-[#043463]" />
                  {/*
                   * The PO number is printed exactly as recorded. The old page
                   * prefixed a literal "PO-", which doubled up on every number
                   * that already carried one.
                   */}
                  <h2 className="min-w-0 truncate text-sm font-semibold text-[#0f172a]">
                    {folder.po_number}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {folder.invoice_count} {folder.invoice_count === 1 ? 'Invoice' : 'Invoices'}
                  </Badge>
                  {/* Absent rather than zero when the folder mixes currencies —
                      the backend will not add those together. */}
                  {folder.total_amount !== null && (
                    <Badge variant="secondary">
                      {formatAmount(folder.total_amount, folder.currency)}
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {folder.last_invoice_at
                    ? `Last invoice ${formatDateShort(folder.last_invoice_at)}`
                    : `Opened ${formatDateShort(folder.created_at)}`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
