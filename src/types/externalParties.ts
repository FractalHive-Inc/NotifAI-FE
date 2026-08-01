export type PartyType = 'SUPPLIER' | 'BUYER'

export interface ExternalParty {
  id: string
  party_name: string
  party_type: PartyType
  description: string | null
  created_at: string
  updated_at: string
}

export interface ExternalPartyInput {
  party_name: string
  party_type: PartyType
  description?: string | null
}

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  SUPPLIER: 'Supplier',
  BUYER: 'Buyer',
}
