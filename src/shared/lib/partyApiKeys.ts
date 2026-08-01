import { PARTY_API_KEYS } from '@/config/env'

/**
 * API key issuance for external parties — demo behaviour.
 *
 * Keys are not generated and not persisted server-side: the platform hands a
 * party one of a fixed pool from the environment, and the ingestion webhook
 * validates it elsewhere. Which key a party currently holds therefore has
 * nowhere to live but the browser, so it is kept in localStorage. That means the
 * assignment is per-browser and is lost if site data is cleared.
 */
const STORAGE_KEY = 'party-api-keys'
const CURSOR_KEY = 'party-api-key-cursor'

/** partyId -> index into PARTY_API_KEYS. Absent means "no key issued yet". */
type KeyAssignments = Record<string, number>

function readAssignments(): KeyAssignments {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as KeyAssignments
  } catch {
    return {}
  }
}

function writeAssignments(assignments: KeyAssignments) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
  } catch {
    // Storage full or blocked (private mode). The key still shows for this
    // session; only its persistence across reloads is lost.
  }
}

/**
 * Advance the shared pointer and return the next key index.
 *
 * The cursor is global rather than per-party so that successive issues walk the
 * pool 1 -> 2 -> 3 -> 1 in a predictable order during a demo, whether they come
 * from onboarding two parties or regenerating twice for one.
 */
function nextIndex(): number {
  const raw = localStorage.getItem(CURSOR_KEY)
  const current = raw === null ? -1 : Number.parseInt(raw, 10)
  const safeCurrent = Number.isNaN(current) ? -1 : current
  const next = (safeCurrent + 1) % PARTY_API_KEYS.length
  try {
    localStorage.setItem(CURSOR_KEY, String(next))
  } catch {
    // See writeAssignments — non-fatal.
  }
  return next
}

export function hasConfiguredKeys(): boolean {
  return PARTY_API_KEYS.length > 0
}

/** The key currently issued to a party, or null if none has been issued. */
export function getPartyApiKey(partyId: string): string | null {
  const index = readAssignments()[partyId]
  if (index === undefined) return null
  return PARTY_API_KEYS[index] ?? null
}

/**
 * Issue the next key in the pool to a party. Used for both the first
 * "Generate API Key" and every subsequent "Regenerate".
 */
export function issuePartyApiKey(partyId: string): string {
  if (!hasConfiguredKeys()) {
    throw new Error('No API keys configured. Set VITE_PARTY_API_KEYS in .env')
  }
  const index = nextIndex()
  writeAssignments({ ...readAssignments(), [partyId]: index })
  return PARTY_API_KEYS[index]
}

/** Drop a party's key. The party has no key until one is generated again. */
export function revokePartyApiKey(partyId: string): void {
  const assignments = readAssignments()
  delete assignments[partyId]
  writeAssignments(assignments)
}

/** Masked form for the table, e.g. `••••••••TH-IF_w`. */
export function maskApiKey(key: string): string {
  return `••••••••${key.slice(-7)}`
}
