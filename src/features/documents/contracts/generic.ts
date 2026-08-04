import { titleCase } from '@/features/hitl/lib/primitives'
import type { DocumentContract } from './types'

/**
 * The contract for a document type we have never seen.
 *
 * It asserts nothing: no field is claimed, so every field sweeps into
 * Additional Fields and all of it renders; no arithmetic is claimed, so no
 * reconciliation card appears; no evaluation reader is claimed, so every
 * validation falls to the generic classifier and reports "Needs review" rather
 * than a verdict we have no basis for.
 *
 * That is the correct behaviour for an unknown document, and it is why the
 * registry must never fall back to the invoice contract. Rendering an unknown
 * document under invoice headings would tell a reviewer they are approving an
 * invoice, and pin invoice validations to fields that mean something else.
 */
export function genericContract(correctUseCase: string): DocumentContract {
  return {
    id: correctUseCase,
    label: correctUseCase ? titleCase(correctUseCase) : 'Document',
    sections: [],
    lineItems: {
      patterns: [/line_?items?/i, /^items$/i, /description/i, /particulars/i],
    },
    reconciliation: [],
    evaluations: {},
    gates: [],
  }
}
