import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { LoadingButton } from '@/shared/components/ui/loading-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useSubmitDecision } from '@/shared/hooks/useApprovals'
import {
  APPROVAL_STATUS_LABELS,
  type ApprovalAction,
  type ApprovalDetail,
  type CorrectUseCase,
  type DecisionInput,
} from '@/types/approvals'
import { formatDate } from '@/shared/lib/formatters'
import { getContract } from '@/features/documents/contracts'
import DecisionBar from './DecisionBar'
import DocumentPreviewPane from './DocumentPreviewPane'
import FieldSection from './FieldSection'
import LineItemsTable from './LineItemsTable'
import TotalsReconciliation from './TotalsReconciliation'
import { emptyEditSet } from '../lib/apply-edits'
import { parseDocInsights } from '../lib/parse-doc-insights'

const ACTION_COPY: Record<ApprovalAction, { title: string; description: string }> = {
  APPROVE: {
    title: 'Approve this extraction?',
    description: 'The agent will continue with these values and run its business validations.',
  },
  RECLASSIFY: {
    title: 'Reclassify this document?',
    description:
      'The agent will discard this extraction and run again as the document type you selected.',
  },
  REJECT: {
    title: 'Reject this document?',
    description:
      'The agent will stop processing it. A comment is required so the rejection can be understood later.',
  },
}

export default function HitlReviewPage({ approval }: { approval: ApprovalDetail }) {
  const state = approval.agent_request?.state
  const classification = state?.classification_status

  const originalUseCase = (classification?.correct_use_case ?? '') as CorrectUseCase

  /*
   * Which document this is, per the agent's classification. An unrecognised or
   * missing type gets the generic contract, which claims nothing — so the page
   * still renders every field, under no heading that would misrepresent it.
   */
  const contract = useMemo(() => getContract(originalUseCase), [originalUseCase])

  const vm = useMemo(
    () => parseDocInsights(state?.doc_insights, contract),
    [state?.doc_insights, contract],
  )

  // The heading states what the document *is*; the dropdown needs a valid
  // starting selection even when the agent classified nothing.
  const [selectedUseCase, setSelectedUseCase] = useState<CorrectUseCase>(
    originalUseCase || 'commercial_invoice',
  )
  const [pendingAction, setPendingAction] = useState<ApprovalAction | null>(null)
  const [comments, setComments] = useState('')

  const submitDecision = useSubmitDecision()
  const decided = approval.status !== 'PENDING'

  // This page is read-only by design. The agent is paused mid-extraction, so any
  // correction made here would be discarded by the extraction that follows —
  // offering an edit box would promise a fix the pipeline then throws away.
  // Field corrections belong on the document approval page, where the data is
  // final. `emptyEditSet()` is passed so FieldSection keeps one code path.
  const noEdits = useMemo(() => emptyEditSet(), [])

  const confirm = () => {
    if (!pendingAction) return

    if (pendingAction === 'REJECT' && !comments.trim()) {
      toast.error('A comment is required when rejecting')
      return
    }

    const input: DecisionInput = {
      action: pendingAction,
      // On reject the platform sends UNKNOWN; on approve the classification is
      // unchanged; on reclassify it is whatever the reviewer picked.
      correct_use_case: pendingAction === 'REJECT' ? 'UNKNOWN' : selectedUseCase,
      comments: comments.trim() || null,
    }

    submitDecision.mutate(
      { id: approval.id, input },
      {
        onSuccess: (updated) => {
          setPendingAction(null)
          // The decision is durable even when delivery is not, so this is a
          // success with a caveat — never an error. Telling the reviewer it
          // failed would make them click again, which then conflicts.
          if (updated.callback_status === 'SENT') {
            toast.success('Decision sent to the agent')
          } else {
            toast.warning('Decision saved, but the agent has not been notified yet')
          }
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Could not submit the decision')
        },
      },
    )
  }

  return (
    <div className="flex h-[calc(100vh-72px)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e7ec] px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to="/tasks">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold text-[#043463]">{contract.label}</h1>
            <p className="text-xs text-muted-foreground">
              {approval.agent_request?.source ?? 'Unknown source'} ·{' '}
              {formatDate(approval.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={decided ? 'secondary' : 'outline'}>
            {APPROVAL_STATUS_LABELS[approval.status]}
          </Badge>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <div className="hidden min-h-0 border-r border-[#e4e7ec] md:block">
          <DocumentPreviewPane approvalId={approval.id} />
        </div>

        <div className="min-h-0 overflow-y-auto">
          <Tabs defaultValue="structured" className="p-4">
            <TabsList>
              <TabsTrigger value="structured">Extracted Data</TabsTrigger>
              <TabsTrigger value="document">Document</TabsTrigger>
              <TabsTrigger value="raw">Raw JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="structured" className="space-y-3 pt-3">
              {decided && (
                <Alert>
                  <AlertTitle>Already Approved</AlertTitle>
                  <AlertDescription>
                    {APPROVAL_STATUS_LABELS[approval.status]} by{' '}
                    {approval.decided_by_email ?? 'a reviewer'}
                    {approval.decided_at ? ` on ${formatDate(approval.decided_at)}` : ''}.
                  </AlertDescription>
                </Alert>
              )}

              {approval.callback_status === 'FAILED' && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>The agent has not been notified</AlertTitle>
                  <AlertDescription>
                    The decision is saved, but delivery failed
                    {approval.callback_error ? `: ${approval.callback_error}` : ''}. It will be
                    retried.
                  </AlertDescription>
                </Alert>
              )}

              {vm.warnings
                .filter((warning) => warning.code === 'NOT_AN_OBJECT')
                .map((warning) => (
                  <Alert variant="destructive" key={warning.code}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Extracted data could not be read</AlertTitle>
                    <AlertDescription>{warning.message}</AlertDescription>
                  </Alert>
                ))}

              {/* Only for documents whose contract asks for it, and only when
                  the figures it needs are actually present. */}
              {vm.reconciliation.length > 0 && <TotalsReconciliation checks={vm.reconciliation} />}

              {vm.sections.map((section) => (
                <FieldSection
                  key={section.id}
                  section={section}
                  editing={false}
                  edits={noEdits}
                  onEdit={() => undefined}
                />
              ))}

              <LineItemsTable
                lineItems={vm.lineItems}
                editing={false}
                rows={[]}
                onChange={() => undefined}
              />
            </TabsContent>

            <TabsContent value="document" className="pt-3 md:hidden">
              <div className="h-[60vh]">
                <DocumentPreviewPane approvalId={approval.id} />
              </div>
            </TabsContent>

            <TabsContent value="raw" className="pt-3">
              <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(state ?? {}, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {!decided && (
        <DecisionBar
          originalUseCase={originalUseCase}
          selectedUseCase={selectedUseCase}
          onSelectUseCase={setSelectedUseCase}
          disabled={submitDecision.isPending}
          onAct={(action) => {
            setComments('')
            setPendingAction(action)
          }}
        />
      )}

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction ? ACTION_COPY[pendingAction].title : ''}</DialogTitle>
            <DialogDescription>
              {pendingAction ? ACTION_COPY[pendingAction].description : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {pendingAction === 'RECLASSIFY' && (
              <Alert>
                <AlertTitle>Extraction will run again</AlertTitle>
                <AlertDescription>
                  The agent will discard the values shown here and re-extract the document as{' '}
                  {getContract(selectedUseCase).label}.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1">
              <Label htmlFor="decision-comments">
                Comments{pendingAction === 'REJECT' ? '' : ' (optional)'}
              </Label>
              <Textarea
                id="decision-comments"
                rows={3}
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                placeholder={
                  pendingAction === 'REJECT'
                    ? 'Why is this document being rejected?'
                    : 'Anything worth recording'
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <LoadingButton
              loading={submitDecision.isPending}
              className="bg-[#101f45] text-white hover:bg-[#142958]"
              onClick={confirm}
            >
              Confirm
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
