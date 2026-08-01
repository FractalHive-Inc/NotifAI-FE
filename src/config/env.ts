export const env = {
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  partyApiKeys: (import.meta.env.VITE_PARTY_API_KEYS as string | undefined) ?? '',
} as const

// The auth service is reached only by the backend, server-to-server. Deliberately
// not exposed here: its refresh token lives in an HTTP-only cookie on its own
// domain, which a cross-origin browser can neither read nor replay.
export const API_URL = env.apiUrl

/**
 * Demo API keys handed to external parties at onboarding.
 *
 * These ship inside the browser bundle, which would normally be disqualifying —
 * it is acceptable only because these are throwaway demo keys and the ingestion
 * webhook validates them outside this platform. Do not put a real key here.
 */
export const PARTY_API_KEYS: string[] = env.partyApiKeys
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean)
