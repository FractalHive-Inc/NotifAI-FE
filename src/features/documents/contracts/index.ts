import { isRecord } from '@/features/hitl/lib/primitives'
import { commercialInvoiceContract } from './commercial-invoice'
import { genericContract } from './generic'
import { purchaseOrderContract } from './purchase-order'
import type { DecisionGate, DocumentContract } from './types'

/**
 * Every document type the platform can read, keyed by the value the agent puts
 * in `classification_status.correct_use_case`.
 *
 * Adding a document type is adding a file and a line here. No parser, page, or
 * component changes.
 */
const CONTRACTS: Record<string, DocumentContract> = {
  [commercialInvoiceContract.id]: commercialInvoiceContract,
  [purchaseOrderContract.id]: purchaseOrderContract,
}

/**
 * Resolve a document type to its contract. Total: any input yields a usable
 * contract, and an unrecognised type gets the generic one rather than being
 * quietly rendered as an invoice.
 */
export function getContract(correctUseCase: unknown): DocumentContract {
  const id = typeof correctUseCase === 'string' ? correctUseCase.trim() : ''
  if (id === '') return genericContract('')
  return CONTRACTS[id] ?? genericContract(id)
}

/**
 * Every document type a reviewer may reclassify *to*, in registration order.
 *
 * Derived from the registry rather than listed separately, so adding a document
 * type really is one file plus one line — a second hand-maintained list is how
 * a new type ends up renderable but not selectable.
 */
export function documentTypeOptions(): Array<{ value: string; label: string }> {
  return Object.values(CONTRACTS).map((contract) => ({
    value: contract.id,
    label: contract.label,
  }))
}

/** True when the document type is one we have a real contract for. */
export function isKnownDocumentType(correctUseCase: unknown): boolean {
  return typeof correctUseCase === 'string' && correctUseCase.trim() in CONTRACTS
}

/**
 * Which of a document's gates are currently blocking approval.
 *
 * Total, like everything else that reads the agent's payload: a gate whose
 * predicate throws is treated as not firing rather than taking the page down.
 * A gate is a safety rail, and a broken rail must not also break the review.
 */
export function evaluateGates(contract: DocumentContract, insights: unknown): DecisionGate[] {
  const context = { insights: isRecord(insights) ? insights : {} }

  return contract.gates.filter((gate) => {
    try {
      return gate.when(context)
    } catch {
      return false
    }
  })
}

export { commercialInvoiceContract, purchaseOrderContract, genericContract }
export type {
  DecisionGate,
  DocumentContract,
  EvaluationContext,
  EvaluationOutcome,
  EvaluationSpec,
  EvaluationTone,
} from './types'
