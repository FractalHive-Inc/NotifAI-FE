import { Copy, KeyRound, RefreshCw, XCircle } from 'lucide-react'
import type { ColumnDef } from '@/shared/components/ui/table'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { getPartyApiKey, hasConfiguredKeys, maskApiKey } from '@/shared/lib/partyApiKeys'
import type { ExternalParty } from '@/types/externalParties'
import { PARTY_TYPE_LABELS } from '@/types/externalParties'

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export interface PartyColumnHandlers {
  onCopyKey: (value: string) => void
  onIssueKey: (partyId: string, partyName: string, isRegenerate: boolean) => void
  onRevoke: (target: { partyId: string; partyName: string }) => void
}

/**
 * Built as a factory because the API-key column reads localStorage rather than
 * the row, and the actions column needs the page's handlers. `keyVersion` is not
 * used in the body — it is here so the page can bust the memo after a
 * generate/regenerate/revoke, which is the only signal that localStorage moved.
 */
export function createPartyColumns(
  handlers: PartyColumnHandlers,
  _keyVersion: number,
): ColumnDef<ExternalParty>[] {
  return [
    {
      id: 'party_name',
      accessorKey: 'party_name',
      header: 'Party Name',
      cell: ({ row }) => <span className="font-medium">{row.original.party_name}</span>,
    },
    {
      id: 'party_type',
      accessorKey: 'party_type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant={row.original.party_type === 'SUPPLIER' ? 'primary' : 'info'}>
          {PARTY_TYPE_LABELS[row.original.party_type]}
        </Badge>
      ),
    },
    {
      id: 'description',
      accessorKey: 'description',
      header: 'Description',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="line-clamp-2 block max-w-65 text-muted-foreground">
          {row.original.description || '—'}
        </span>
      ),
    },
    {
      id: 'api_key',
      header: 'API Key',
      enableSorting: false,
      cell: ({ row }) => {
        const apiKey = getPartyApiKey(row.original.id)
        if (!apiKey) return <span className="text-xs text-muted-foreground">Not issued</span>
        return (
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
              {maskApiKey(apiKey)}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handlers.onCopyKey(apiKey)}
              title="Copy key"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      },
    },
    {
      id: 'created_at',
      accessorKey: 'created_at',
      header: 'Added',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.created_at)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="block text-right">Actions</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const party = row.original
        const apiKey = getPartyApiKey(party.id)
        return (
          <div className="flex items-center justify-end gap-2">
            {apiKey ? (
              <>
                <Button
                  size="sm"
                  onClick={() => handlers.onIssueKey(party.id, party.party_name, true)}
                  className="bg-[#101f45] text-white hover:bg-[#142958]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handlers.onRevoke({ partyId: party.id, partyName: party.party_name })
                  }
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <XCircle className="h-4 w-4" />
                  Revoke
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                disabled={!hasConfiguredKeys()}
                onClick={() => handlers.onIssueKey(party.id, party.party_name, false)}
                className="bg-[#101f45] text-white hover:bg-[#142958]"
              >
                <KeyRound className="h-4 w-4" />
                Generate API Key
              </Button>
            )}
          </div>
        )
      },
    },
  ]
}
