import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert/alert'
import { Badge } from '@/shared/components/ui/badge/badge'
import { Button } from '@/shared/components/ui/button/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog/dialog'
import { Label } from '@/shared/components/ui/label/label'
import { Textarea } from '@/shared/components/ui/textarea/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs/tabs'
import { useSubmitDecision } from '@/shared/hooks/useApprovals'
import { APPROVAL_STATUS_LABELS } from '@/types/approvals'
import type { ApprovalDetail, DecisionInput } from '@/types/approvals'
import { formatDate } from '@/shared/lib/formatters'
import { evaluateGates, getContract } from '@/features/documents/contracts'
import DocumentPreviewPane from '@/features/hitl/components/DocumentPreviewPane'
import EditDiffView from '@/features/hitl/components/EditDiffView'
import FieldSection from '@/features/hitl/components/FieldSection'
import type { FieldIssue } from '@/features/hitl/components/FieldSection'
import LineItemsTable from '@/features/hitl/components/LineItemsTable'
import TotalsReconciliation from '@/features/hitl/components/TotalsReconciliation'
import {
  applyEdits,
  emptyEditSet,
  hasEdits,
  normaliseEdit,
  pathKey,
} from '@/features/hitl/lib/apply-edits'
import type { EditSet } from '@/features/hitl/lib/apply-edits'
import { parseDocInsights } from '@/features/hitl/lib/parse-doc-insights'
import type { FieldVM } from '@/features/hitl/lib/types'
import ClassificationTrail from './ClassificationTrail'
import ValidationsPanel from './ValidationsPanel'
import { failuresByFieldPath, parseActionConclusion } from '../lib/parse-action-conclusion'

type PprAction = 'APPROVE' | 'REJECT'

/**
 * Document approval — the post-processing review.
 *
 * Everything about the extracted data is shared with the HITL page: the same
 * parser, sections, line-item table, totals reconciliation, and preview. Two
 * things differ, and both follow from *when* this review happens.
 *
 * The agent has already finished, so:
 *  - there is no reclassify and no callback — the outcome stays inside this
 *    platform, and an approved document moves on to the transaction workspace;
 *  - the extracted values are final, so this is where a reviewer corrects them.
 *    Editing on the HITL page would be overwritten by the extraction that
 *    follows it.
 *
 * And because business actions *have* run, this page has something HITL never
 * does: the agent's validation results, and the gates that can block approval
 * outright.
 *
 * What any of it *means* comes from the document's contract, selected by
 * `classification_status.correct_use_case`. This component renders an invoice
 * and a purchase order with the same code and no branch.
 */
export default function PprReviewPage({ approval }: { approval: ApprovalDetail }) {
  const state = approval.agent_request?.state

  /*
   * `correct_use_case` is the document type; the request's `use_case` is
   * HITL vs PPR and selects the *page*, never the contract. There is
   * deliberately no fallback to the invoice contract — rendering an unknown
   * document under invoice headings would tell a reviewer they are approving
   * an invoice, and pin invoice validations to fields that mean something else.
   */
  const contract = useMemo(
    () => getContract(state?.classification_status?.correct_use_case),
    [state?.classification_status?.correct_use_case],
  )

  const vm = useMemo(
    () => parseDocInsights(state?.doc_insights, contract),
    [state?.doc_insights, contract],
  )

  const conclusion = useMemo(
    () => parseActionConclusion(state?.action_conclusion, contract, state?.doc_insights),
    [state?.action_conclusion, contract, state?.doc_insights],
  )

  /**
   * Conditions that make approval impossible — an invoice with no PO reference,
   * today. Evaluated against `doc_insights` directly rather than read off the
   * validations, so a gate still holds when the agent never ran the matching
   * check.
   */
  const gates = useMemo(
    () => evaluateGates(contract, state?.doc_insights),
    [contract, state?.doc_insights],
  )

  // Problems are surfaced twice: in the panel, and against the field each
  // concerns, where the reviewer is already looking.
  const fieldIssues = useMemo(() => {
    const issues = new Map<string, FieldIssue[]>()

    for (const [path, evaluations] of failuresByFieldPath(conclusion)) {
      issues.set(
        path,
        // The check's answer — "Invalid Tax Id" — beside the field it is about.
        evaluations.map((evaluation) => ({
          tone: evaluation.tone,
          message: evaluation.status,
        })),
      )
    }

    for (const gate of gates) {
      if (!gate.relatedPath) continue

      const existing = issues.get(gate.relatedPath) ?? []
      // The matching evaluation usually says the same thing in the same place;
      // showing it twice against one field reads like two separate problems.
      if (existing.some((issue) => issue.tone === 'BLOCKED')) continue

      issues.set(gate.relatedPath, [...existing, { tone: 'BLOCKED', message: gate.title }])
    }

    return issues
  }, [conclusion, gates])

  const [editing, setEditing] = useState(false)
  const [edits, setEdits] = useState<EditSet>(() => emptyEditSet())
  const [lineRows, setLineRows] = useState<string[][]>(() =>
    vm.lineItems.rows.map((row) => row.map((cell) => cell?.raw ?? '')),
  )
  const [lineItemsChanged, setLineItemsChanged] = useState(false)
  const [pendingAction, setPendingAction] = useState<PprAction | null>(null)
  const [comments, setComments] = useState('')

  const submitDecision = useSubmitDecision()
  const decided = approval.status !== 'PENDING'
  const anyEdits = hasEdits(edits) || lineItemsChanged
  const blocked = gates.length > 0

  const handleFieldEdit = (field: FieldVM, raw: string) => {
    setEdits((current) => {
      const next = new Map(current.fields)
      next.set(pathKey(field.path), {
        path: field.path,
        raw: normaliseEdit(raw, field.value) as string,
        previousRaw: field.value.raw,
      })
      return { ...current, fields: next }
    })
  }

  const handleLineEdit = (rowIndex: number, columnIndex: number, value: string) => {
    setLineRows((current) =>
      current.map((row, r) =>
        r === rowIndex ? row.map((cell, c) => (c === columnIndex ? value : cell)) : row,
      ),
    )
    setLineItemsChanged(true)
  }

  const confirm = () => {
    if (!pendingAction) return

    if (pendingAction === 'REJECT' && !comments.trim()) {
      toast.error('A comment is required when rejecting')
      return
    }

    // The button is disabled, but a gate is a rule and not a styling choice —
    // it holds here too, where the decision is actually submitted.
    if (pendingAction === 'APPROVE' && blocked) {
      toast.error(gates[0].title)
      return
    }

    const input: DecisionInput = {
      action: pendingAction,
      comments: comments.trim() || null,
    }

    // Corrections travel with an approval only. Rejecting discards the document,
    // so edits would be recorded against something nobody will act on.
    if (anyEdits && pendingAction === 'APPROVE') {
      try {
        input.doc_insights = applyEdits(
          state?.doc_insights,
          { fields: edits.fields, lineItems: lineItemsChanged ? { rows: lineRows } : null },
          vm.lineItems,
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not apply your edits')
        return
      }
    }

    submitDecision.mutate(
      { id: approval.id, input },
      {
        onSuccess: (updated) => {
          setPendingAction(null)
          setEditing(false)

          if (pendingAction === 'REJECT') {
            toast.success('Document rejected')
            return
          }

          // The approval is durable whether or not the voucher was created, so a
          // failed push is a success with a caveat — never an error. Reporting it
          // as a failure would make the reviewer approve again, which conflicts.
          if (updated.tally_status === 'SUCCESS') {
            toast.success('Document approved and posted to Tally')
          } else {
            toast.warning('Document approved, but it has not reached Tally yet')
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
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {approval.agent_request?.source ?? 'Unknown source'} ·{' '}
                {formatDate(approval.created_at)}
              </p>
              <ClassificationTrail path={state?.traversal_path} />
            </div>
          </div>
        </div>
        <Badge variant={decided ? 'secondary' : 'outline'}>
          {APPROVAL_STATUS_LABELS[approval.status]}
        </Badge>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <div className="hidden min-h-0 border-r border-[#e4e7ec] md:block">
          <DocumentPreviewPane approvalId={approval.id} />
        </div>

        <div className="min-h-0 overflow-y-auto">
          <Tabs defaultValue="structured" className="p-4">
            {/*
             * Editing is the first thing a reviewer does and the control that
             * changes what every field below looks like, so it sits at the top
             * with the tabs rather than at the far end of the page.
             */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="structured">Extracted Data</TabsTrigger>
                <TabsTrigger value="raw">Raw JSON</TabsTrigger>
              </TabsList>

              {!decided && (
                <div className="flex items-center gap-3">
                  {anyEdits && (
                    <span className="text-xs text-[#043463]">
                      Corrections will be saved when you approve
                    </span>
                  )}
                  <Button
                    variant={editing ? 'default' : 'outline'}
                    className={editing ? 'bg-[#101f45] text-white hover:bg-[#142958]' : undefined}
                    onClick={() => setEditing((current) => !current)}
                    disabled={submitDecision.isPending || vm.lineItems.ragged}
                    title={
                      vm.lineItems.ragged
                        ? 'Line-item columns are misaligned — fix upstream before editing'
                        : undefined
                    }
                  >
                    {editing ? 'Save' : 'Edit fields'}
                  </Button>
                </div>
              )}
            </div>

            <TabsContent value="structured" className="space-y-3 pt-3">
              {decided && (
                <Alert>
                  <AlertTitle>Already decided</AlertTitle>
                  <AlertDescription>
                    {APPROVAL_STATUS_LABELS[approval.status]} by{' '}
                    {approval.decided_by_email ?? 'a reviewer'}
                    {approval.decided_at ? ` on ${formatDate(approval.decided_at)}` : ''}.
                  </AlertDescription>
                </Alert>
              )}

              {/*
               * Surfaced as a caveat on a completed approval rather than as a
               * failure of it. The decision is durable either way — it is the
               * voucher that is outstanding — and a reviewer who reads this as
               * "my approval did not work" will try to approve again, which
               * conflicts and looks broken.
               */}
              {approval.tally_status === 'FAILED' && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>This document is not in Tally yet</AlertTitle>
                  <AlertDescription>
                    The approval is saved, but the purchase voucher was not created
                    {approval.tally_error ? `: ${approval.tally_error}` : ''}.
                  </AlertDescription>
                </Alert>
              )}

              {approval.tally_status === 'SUCCESS' && approval.tally_voucher_id && (
                <Alert>
                  <AlertTitle>Posted to Tally</AlertTitle>
                  <AlertDescription>
                    Created as purchase voucher {approval.tally_voucher_id}.
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

              {/* Stated before the data, because it changes what the reviewer
                  can do with any of it. */}
              {!decided &&
                gates.map((gate) => (
                  <Alert variant="destructive" key={gate.id}>
                    <Ban className="h-4 w-4" />
                    <AlertTitle>{gate.title}</AlertTitle>
                    <AlertDescription>{gate.reason}</AlertDescription>
                  </Alert>
                ))}

              {vm.sections.map((section) => (
                <FieldSection
                  key={section.id}
                  section={section}
                  editing={editing && !decided}
                  edits={edits}
                  onEdit={handleFieldEdit}
                  fieldIssues={fieldIssues}
                />
              ))}

              <LineItemsTable
                lineItems={vm.lineItems}
                editing={editing && !decided}
                rows={lineRows}
                onChange={handleLineEdit}
              />

              {/* Only for documents whose contract asks for it, and only when
                  the figures it needs are actually present. */}
              {vm.reconciliation.length > 0 && <TotalsReconciliation checks={vm.reconciliation} />}

              {/* Last: the agent's own conclusions are read after the data they
                  are about, not before it. */}
              <ValidationsPanel conclusion={conclusion} />
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
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e4e7ec] bg-background px-4 py-3">
          <Button
            variant="destructive"
            onClick={() => {
              setComments('')
              setPendingAction('REJECT')
            }}
            disabled={submitDecision.isPending}
          >
            Reject
          </Button>
          {/* The wrapper carries the tooltip: a disabled button fires no mouse
              events, so the reason would be unreachable on the button itself. */}
          <span title={blocked ? gates[0].reason : undefined}>
            <Button
              className="bg-[#101f45] text-white hover:bg-[#142958]"
              onClick={() => {
                setComments('')
                setPendingAction('APPROVE')
              }}
              disabled={submitDecision.isPending || blocked}
            >
              Approve
            </Button>
          </span>
        </div>
      )}

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === 'REJECT' ? 'Reject this document?' : 'Approve this document?'}
            </DialogTitle>
            <DialogDescription>
              {pendingAction === 'REJECT'
                ? 'The document will not proceed. A comment is required so the rejection can be understood later.'
                : 'The document will move on to its transaction.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* The reviewer is approving despite the agent's own checks — make
                that explicit rather than letting it pass silently. */}
            {pendingAction === 'APPROVE' &&
              conclusion.counts.FAILED +
                conclusion.counts.WARNING +
                conclusion.counts.UNRECOGNISED >
                0 && (
                <Alert variant="destructive">
                  <AlertTitle>Unresolved validations</AlertTitle>
                  <AlertDescription>
                    {conclusion.counts.FAILED > 0 &&
                      `${conclusion.counts.FAILED} check(s) returned a problem. `}
                    {conclusion.counts.WARNING > 0 &&
                      `${conclusion.counts.WARNING} check(s) need a second look. `}
                    {conclusion.counts.UNRECOGNISED > 0 &&
                      `${conclusion.counts.UNRECOGNISED} check(s) need manual review. `}
                    Approving accepts the document regardless.
                  </AlertDescription>
                </Alert>
              )}

            {pendingAction === 'APPROVE' && (
              <EditDiffView edits={edits} lineItemsChanged={lineItemsChanged} />
            )}

            {pendingAction === 'REJECT' && anyEdits && (
              <p className="text-sm text-muted-foreground">
                Your corrections will not be saved — a rejected document does not proceed.
              </p>
            )}

            <div className="space-y-1">
              <Label htmlFor="ppr-comments">
                Comments{pendingAction === 'REJECT' ? '' : ' (optional)'}
              </Label>
              <Textarea
                id="ppr-comments"
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
            <Button
              variant={submitDecision.isPending ? 'loading' : 'default'}
              className="bg-[#101f45] text-white hover:bg-[#142958]"
              onClick={confirm}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
