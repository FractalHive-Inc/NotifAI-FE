import type { AxiosRequestConfig } from 'axios'
import axios from 'axios'
import { INGESTION_URL } from '@/config/env'
import { ACCESS_TOKEN_KEY, refreshSession } from '@/shared/lib/api'
import type { IngestionRequest, ProcessingJob } from '@/types/ingestion'

/**
 * Reading processing jobs back out of the ingestion service.
 *
 * This is a third axios instance, and neither of the existing two would do.
 * `@/shared/lib/api` is bound to our own backend, so pointing it at another
 * origin would send this user's session somewhere it does not belong. The
 * upload client in `./upload` has the right origin but authenticates the
 * *party* with a static `X-API-KEY`, which these endpoints reject outright —
 * they authenticate the *user*, via a bearer token.
 *
 * What it does share with `@/shared/lib/api` is the session itself: the same
 * token, and the same refresh. Both services validate against the same SSO
 * service, so a 401 from here means what a 401 from our backend means — the
 * access token needs refreshing — and treating it as anything else leaves this
 * page 401ing every ten seconds while the rest of the app sails on.
 */

/**
 * The service sets `root_path="/api"`, so deployed it lives behind a proxy on
 * that prefix. Locally both forms happen to route, which makes this easy to get
 * wrong and only discover in dev — the prefix is the correct one either way,
 * and it is what the upload client already uses.
 */
const INGESTION_API_PREFIX = '/api/notifai'

const ingestionApi = axios.create({
  baseURL: `${INGESTION_URL}${INGESTION_API_PREFIX}`,
})

ingestionApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

interface RetriableConfig extends AxiosRequestConfig {
  _retry?: boolean
}

/**
 * An expired access token, refreshed and the request retried once.
 *
 * `_retry` guards against a loop: if the freshly minted token is *also*
 * rejected, the second 401 is about something other than expiry — a revoked
 * user, a misconfigured audience — and retrying forever would not fix it.
 *
 * Deliberately unlike the interceptor on `@/shared/lib/api`: a rejected refresh
 * here does not clear the session or redirect. This page polls in the
 * background, and a poll that lands mid-expiry should surface an error on the
 * page, not throw the user out from under whatever they were doing. The other
 * client owns that decision, and it will reach the same conclusion on its next
 * call — against the same shared refresh promise.
 */
ingestionApi.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)

    const originalConfig = error.config as RetriableConfig | undefined
    if (error.response?.status !== 401 || !originalConfig || originalConfig._retry) {
      return Promise.reject(error)
    }

    originalConfig._retry = true

    const outcome = await refreshSession()
    if (outcome.status !== 'refreshed') {
      return Promise.reject(error)
    }

    // No need to set the header here, and setting it would be misleading:
    // `request` re-runs the request interceptor above, which reads the token
    // straight from localStorage — where `refreshSession` has already written
    // the new one by the time it resolves.
    return ingestionApi.request(originalConfig)
  },
)

/** Every response from this service is wrapped in `{ message, data }`. */
interface IngestionEnvelope<T> {
  message: string
  data: T
}

/**
 * Turn a failed read into something a person can act on.
 *
 * The no-response case is called out separately for the same reason as in
 * `./upload`: a browser blocked by CORS reports a network error indistinguish-
 * able from the service being down, so the message names both possibilities.
 */
function toIngestionError(error: unknown, what: string): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error(`Could not load ${what}.`)
  }

  if (!error.response) {
    return new Error(
      `Could not reach the ingestion service at ${INGESTION_URL}. Check that it is running and that it allows requests from ${window.location.origin}.`,
    )
  }

  const { status, data } = error.response
  const detail = (data as { detail?: { message?: string } | string } | null)?.detail
  const message = typeof detail === 'string' ? detail : detail?.message

  // Only reachable once the interceptor has tried a refresh and still been
  // turned away, so this is a dead session rather than a stale token — which is
  // why it asks for a sign-in instead of suggesting a retry.
  if (status === 401 || status === 403) {
    return new Error(message || 'Your session could not be renewed. Sign in again.')
  }
  return new Error(message || `Ingestion service returned ${status} loading ${what}.`)
}

/**
 * Every processing job the service has, newest first.
 *
 * The 404 is not an error: with no jobs at all the service raises
 * "No processing jobs found" rather than returning `[]`, and a brand new
 * environment would otherwise open on a red banner instead of an empty table.
 *
 * No pagination or filter parameters exist — the endpoint takes none and
 * returns the lot — so both are done client-side by the page.
 */
export async function fetchProcessingJobs(): Promise<ProcessingJob[]> {
  try {
    const response = await ingestionApi.get<IngestionEnvelope<ProcessingJob[]>>('/processing/jobs')
    return response.data.data ?? []
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return []
    }
    throw toIngestionError(error, 'processing jobs')
  }
}

/**
 * The incoming requests behind one job.
 *
 * Fetched per job rather than for every row up front: the list endpoint carries
 * none of this, so folding it into the table would mean one request per row.
 *
 * An id this service does not know answers 500, not 404 — it dereferences the
 * missing job before checking it. Nothing is done about that here: the only ids
 * this app passes came from the list, so a 500 means something genuinely went
 * wrong and should surface as an error rather than an empty panel.
 */
export async function fetchIngestionRequests(processingJobId: string): Promise<IngestionRequest[]> {
  try {
    const response = await ingestionApi.get<IngestionEnvelope<IngestionRequest[]>>(
      `/processing/job/${encodeURIComponent(processingJobId)}`,
    )
    return response.data.data ?? []
  } catch (error) {
    throw toIngestionError(error, 'this request')
  }
}
