import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Folder, Paperclip, Search } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card/card'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Input } from '@/shared/components/ui/input/input'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import { usePOFolders } from '@/shared/hooks/usePOFolders'
import { formatDateShort } from '@/shared/lib/formatters'

export default function POFoldersPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const { data: poFolders, isLoading } = usePOFolders()

  const filteredFolders =
    poFolders?.filter((folder) =>
      folder.po_number.toLowerCase().includes(searchTerm.toLowerCase()),
    ) || []

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[#043463] sm:text-3xl">PO Folders</h1>

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
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredFolders.map((folder) => (
            <Card
              key={folder.id}
              className="cursor-pointer rounded-xl border-[#e4e7ec] py-5 shadow-none transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => navigate(`/documents/po-folders/${folder.id}`)}
            >
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Folder className="h-8 w-8 text-[#043463]" />
                  <h2 className="text-sm font-semibold text-[#0f172a]">PO-{folder.po_number}</h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {folder.invoice_count || 0} Invoices
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Paperclip className="h-3.5 w-3.5" />
                    {folder.supporting_doc_count || 0} Supporting
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground">
                  Created {formatDateShort(folder.created_at)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
