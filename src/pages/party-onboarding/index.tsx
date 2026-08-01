import { useCallback, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Copy, KeyRound, Plus, RefreshCw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button/button'
import { Card } from '@/shared/components/ui/card/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog/dialog'
import { Input } from '@/shared/components/ui/input/input'
import { Label } from '@/shared/components/ui/label/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select/select'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'
import { Textarea } from '@/shared/components/ui/textarea/textarea'
import { useCreateExternalParty, useExternalParties } from '@/shared/hooks/useExternalParties'
import {
  getPartyApiKey,
  hasConfiguredKeys,
  issuePartyApiKey,
  maskApiKey,
  revokePartyApiKey,
} from '@/shared/lib/partyApiKeys'
import { PARTY_TYPE_LABELS } from '@/types/externalParties'

const partySchema = z.object({
  party_name: z.string().min(1, 'Party name is required').max(255, 'Keep it under 255 chars'),
  party_type: z.enum(['SUPPLIER', 'BUYER'], { message: 'Select a party type' }),
  description: z.string().max(500, 'Keep it under 500 chars').optional(),
})

type PartyValues = z.infer<typeof partySchema>

interface IssuedKey {
  partyName: string
  key: string
  isRegenerate: boolean
}

interface RevokeTarget {
  partyId: string
  partyName: string
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function PartyOnboardingPage() {
  const { data: parties, isLoading } = useExternalParties()
  const createParty = useCreateExternalParty()

  const [addOpen, setAddOpen] = useState(false)
  const [issuedKey, setIssuedKey] = useState<IssuedKey | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null)

  // Key assignments live in localStorage, not in query state, so this counter is
  // what tells React a row's key changed after generate/regenerate/revoke.
  const [keyVersion, setKeyVersion] = useState(0)
  const refreshKeys = useCallback(() => setKeyVersion((v) => v + 1), [])

  const form = useForm<PartyValues>({
    resolver: zodResolver(partySchema),
    defaultValues: { party_name: '', party_type: 'SUPPLIER', description: '' },
  })

  const handleAddParty = async (values: PartyValues) => {
    try {
      await createParty.mutateAsync({
        party_name: values.party_name,
        party_type: values.party_type,
        description: values.description?.trim() ? values.description.trim() : null,
      })
      setAddOpen(false)
      form.reset()
      toast.success('Party added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add party')
    }
  }

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Copy failed')
    }
  }

  const handleIssueKey = (partyId: string, partyName: string, isRegenerate: boolean) => {
    try {
      const key = issuePartyApiKey(partyId)
      refreshKeys()
      setIssuedKey({ partyName, key, isRegenerate })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to issue API key')
    }
  }

  const handleConfirmRevoke = () => {
    if (!revokeTarget) return
    revokePartyApiKey(revokeTarget.partyId)
    refreshKeys()
    setRevokeTarget(null)
    toast.success('API key revoked')
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#043463] sm:text-3xl">Party Onboarding</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Register suppliers and buyers, then issue the API key they use to call the ingestion
            webhook.
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-[#101f45] text-white hover:bg-[#142958]"
        >
          <Plus className="h-4 w-4" />
          Add Party
        </Button>
      </div>

      {!hasConfiguredKeys() && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No API keys configured. Set <code className="font-mono">VITE_PARTY_API_KEYS</code> in{' '}
          <code className="font-mono">.env</code> and restart the dev server.
        </div>
      )}

      <Card className="mt-6 overflow-hidden rounded-xl border-[#e4e7ec] p-0 shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e4e7ec] bg-[#f8fafc] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Party Name</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">API Key</th>
                <th className="px-5 py-3 font-medium">Added</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#e4e7ec] last:border-0">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : parties && parties.length > 0 ? (
                parties.map((party) => {
                  const apiKey = getPartyApiKey(party.id)
                  return (
                    <tr
                      key={`${party.id}-${keyVersion}`}
                      className="border-b border-[#e4e7ec] last:border-0"
                    >
                      <td className="px-5 py-4 font-medium text-[#0f172a]">{party.party_name}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            party.party_type === 'SUPPLIER'
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-sky-50 text-sky-700'
                          }`}
                        >
                          {PARTY_TYPE_LABELS[party.party_type]}
                        </span>
                      </td>
                      <td className="max-w-[260px] px-5 py-4 text-muted-foreground">
                        <span className="line-clamp-2">{party.description || '—'}</span>
                      </td>
                      <td className="px-5 py-4">
                        {apiKey ? (
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-muted px-2 py-1 font-mono text-xs text-[#0f172a]">
                              {maskApiKey(apiKey)}
                            </code>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleCopy(apiKey)}
                              title="Copy key"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not issued</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {formatDate(party.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {apiKey ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleIssueKey(party.id, party.party_name, true)}
                                className="bg-[#101f45] text-white hover:bg-[#142958]"
                              >
                                <RefreshCw className="h-4 w-4" />
                                Regenerate
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setRevokeTarget({
                                    partyId: party.id,
                                    partyName: party.party_name,
                                  })
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
                              onClick={() => handleIssueKey(party.id, party.party_name, false)}
                              className="bg-[#101f45] text-white hover:bg-[#142958]"
                            >
                              <KeyRound className="h-4 w-4" />
                              Generate API Key
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="rounded-full bg-[#e8efff] p-4">
                        <Building2 className="h-7 w-7 text-[#101f45]" />
                      </div>
                      <p className="mt-4 text-base font-medium text-[#0f172a]">
                        No external parties yet
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Add a supplier or buyer to issue them an ingestion API key.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <form onSubmit={form.handleSubmit(handleAddParty)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add external party</DialogTitle>
              <DialogDescription>
                Register a supplier or buyer. You can issue their API key once they&apos;re added.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="party-name">Party name</Label>
              <Input
                id="party-name"
                placeholder="e.g. Acme Textiles Pvt Ltd"
                autoFocus
                {...form.register('party_name')}
              />
              {form.formState.errors.party_name && (
                <p className="text-xs text-red-600">{form.formState.errors.party_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="party-type">Party type</Label>
              <Controller
                control={form.control}
                name="party_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="party-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPPLIER">Supplier</SelectItem>
                      <SelectItem value="BUYER">Buyer</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.party_type && (
                <p className="text-xs text-red-600">{form.formState.errors.party_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="party-description">
                Description
                <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="party-description"
                placeholder="What this party sends us"
                rows={3}
                {...form.register('description')}
              />
              {form.formState.errors.description && (
                <p className="text-xs text-red-600">{form.formState.errors.description.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={createParty.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createParty.isPending}
                className="bg-[#101f45] text-white hover:bg-[#142958]"
              >
                {createParty.isPending ? 'Adding…' : 'Add Party'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={issuedKey !== null}
        onOpenChange={(open) => {
          if (!open) setIssuedKey(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {issuedKey?.isRegenerate ? 'New API key generated' : 'API key generated'}
            </DialogTitle>
            <DialogDescription>
              {issuedKey?.isRegenerate ? (
                <>
                  <span className="font-medium text-red-600">
                    The previous key is no longer valid.
                  </span>{' '}
                  Share this one with the party.
                </>
              ) : (
                <>Share this key with the party — they send it with every webhook call.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Party</Label>
            <p className="text-sm text-[#0f172a]">{issuedKey?.partyName}</p>
          </div>
          <div className="space-y-2">
            <Label>API key</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md border border-[#e4e7ec] bg-muted px-3 py-2 font-mono text-xs text-[#0f172a]">
                {issuedKey?.key}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => issuedKey && handleCopy(issuedKey.key)}
                title="Copy"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIssuedKey(null)}
              className="bg-[#101f45] text-white hover:bg-[#142958]"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-110">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-red-50 p-2">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="space-y-1.5">
                <DialogTitle>Revoke API key?</DialogTitle>
                <DialogDescription>
                  <span className="font-medium text-[#0f172a]">{revokeTarget?.partyName}</span>
                  &apos;s calls to the ingestion webhook will stop working immediately. You can
                  issue a new key afterwards.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRevoke}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <XCircle className="h-4 w-4" />
              Revoke key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
