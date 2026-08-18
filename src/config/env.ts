export const env = {
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  apiUrl: import.meta.env.VITE_API_URL,
  partyApiKeys: (import.meta.env.VITE_PARTY_API_KEYS as string | undefined) ?? '',
  ingestionUrl:
    (import.meta.env.VITE_INGESTION_URL as string | undefined) ?? 'http://localhost:9090',
  ingestionApiKey: (import.meta.env.VITE_INGESTION_API_KEY as string | undefined) ?? '',
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

/**
 * The ingestion service the upload page pushes documents to.
 *
 * This is a different service on a different origin to {@link API_URL}, reached
 * by the browser directly rather than through our backend, so it must allow this
 * app's origin and the `X-API-KEY` header on preflight.
 */
export const INGESTION_URL = env.ingestionUrl.replace(/\/+$/, '')

/** Same caveat as {@link PARTY_API_KEYS}: readable in the bundle, demo keys only. */
export const INGESTION_API_KEY = env.ingestionApiKey.trim()
