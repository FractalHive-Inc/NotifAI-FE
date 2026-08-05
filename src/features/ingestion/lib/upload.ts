import axios from 'axios'
import { INGESTION_API_KEY, INGESTION_URL } from '@/config/env'

/**
 * Pushing a document into the ingestion service.
 *
 * Deliberately not built on `@/shared/lib/api`: that instance carries this
 * user's bearer token and the refresh-cookie interceptor, aimed at our own
 * backend. The ingestion service is a separate origin that authenticates the
 * *party*, not the user, with a static API key — sending our session there would
 * leak it, and a 401 from there must not trigger a token refresh or log anyone out.
 */

/** Identifies this app as the origin of the document, for every upload. */
export const INGESTION_SOURCE_ID = 'notifai_platform'

const INGESTION_PATH = '/api/notifai/default'

export interface UploadDocumentInput {
  file: File
  pages: number
}

export interface UploadDocumentResult {
  /** Echoed back so the UI can show what was sent, and so a retry is traceable. */
  idempotencyKey: string
  /** Whatever the service returned; shape is its own concern, not ours. */
  data: unknown
}

/**
 * A fresh key per call, so re-sending the same file is a new document rather
 * than a no-op — which is the point of the upload page during a demo.
 *
 * `crypto.randomUUID` is missing outside a secure context, which is not
 * hypothetical here: the dev server reached over the LAN (http://192.168.x.x)
 * is exactly that case, while localhost is fine. The fallback is only unique
 * enough to distinguish uploads, and is not a real v4 UUID's worth of entropy.
 */
function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random()
    .toString(16)
    .slice(2, 10)}`
}

/**
 * Turn a failed upload into something a person can act on.
 *
 * The no-response case is called out separately because it is the one most
 * likely to be hit first and the one least likely to be guessed: a browser
 * blocked by CORS reports a network error indistinguishable from the service
 * being down, so the message names both possibilities.
 */
function toUploadError(error: unknown): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error('Upload failed.')
  }

  if (!error.response) {
    return new Error(
      `Could not reach the ingestion service at ${INGESTION_URL}. Check that it is running and that it allows requests from ${window.location.origin}.`,
    )
  }

  const { status, data } = error.response
  const detail =
    typeof data === 'string'
      ? data
      : ((data as { message?: string; detail?: string; error?: string } | null)?.message ??
        (data as { detail?: string } | null)?.detail ??
        (data as { error?: string } | null)?.error)

  if (status === 401 || status === 403) {
    return new Error(
      detail || 'The ingestion service rejected the API key (VITE_INGESTION_API_KEY).',
    )
  }
  return new Error(detail || `Ingestion service returned ${status}.`)
}

/** POST a document to the ingestion service as multipart/form-data. */
export async function uploadDocument({
  file,
  pages,
}: UploadDocumentInput): Promise<UploadDocumentResult> {
  if (!INGESTION_API_KEY) {
    throw new Error('No ingestion API key configured. Set VITE_INGESTION_API_KEY in .env.')
  }

  const idempotencyKey = newIdempotencyKey()

  const form = new FormData()
  form.append('file', file)
  form.append('source_id', INGESTION_SOURCE_ID)
  form.append('idempotency_key', idempotencyKey)
  form.append('pages', String(pages))

  try {
    // No Content-Type header on purpose: the browser has to set it so the
    // multipart boundary matches the body it actually serialises.
    const response = await axios.post(`${INGESTION_URL}${INGESTION_PATH}`, form, {
      headers: { 'X-API-KEY': INGESTION_API_KEY },
    })
    return { idempotencyKey, data: response.data }
  } catch (error) {
    throw toUploadError(error)
  }
}
