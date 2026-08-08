/**
 * Why the document preview failed, in terms a reviewer can act on.
 *
 * The pane used to render every failure identically — one grey placeholder and a
 * "Try again" button — which is wrong in both directions. A task whose document
 * was never stored will never produce one, so the button invites a reviewer to
 * keep clicking at something that cannot change; meanwhile a blob store that
 * blinked looks equally permanent and gets abandoned when a single retry would
 * have fixed it.
 *
 * The backend already distinguishes these: `document-url.service.ts` maps the
 * ingestion service's failures onto separate codes precisely so a credential
 * problem is not indistinguishable from a missing file. This module is the
 * frontend half of that contract.
 */
export interface DocumentPreviewFailure {
  /** Heading on the placeholder. */
  title: string
  /** One sentence on what went wrong. */
  detail: string
  /**
   * Whether refetching could plausibly change the outcome — i.e. whether to
   * offer "Try again" at all. False covers two different situations that look
   * the same to the reviewer: nothing to fetch, and something only an operator
   * can fix.
   */
  retryable: boolean
}

/**
 * Keyed on the backend's error code rather than the HTTP status, because status
 * alone cannot separate the cases that matter here: `DOCUMENT_NOT_FOUND` and
 * `NO_DOCUMENT` are both 404s but have different causes, and every 502 below is
 * a different kind of broken.
 */
const FAILURES: Record<string, DocumentPreviewFailure> = {
  /* 404s — the document is not there to fetch. Retrying re-asks a settled question. */
  NO_DOCUMENT: {
    title: 'No document for this task',
    detail: 'The agent request behind this task carried no document reference.',
    retryable: false,
  },
  DOCUMENT_NOT_FOUND: {
    title: 'No document for this task',
    detail:
      'The ingestion service holds no stored document for this task, so there is nothing to preview.',
    retryable: false,
  },
  DOCUMENT_KEY_MISSING: {
    title: 'No document for this task',
    detail: 'This task carries no reference the document store can be searched by.',
    retryable: false,
  },

  /* 501 — this deployment has no preview at all; every task will look like this. */
  DOCUMENT_URL_NOT_CONFIGURED: {
    title: 'Preview not configured',
    detail: 'No document preview has been configured for this environment.',
    retryable: false,
  },

  /*
   * 502s that a reviewer cannot clear. Both are the *server's* credentials
   * failing, not the reviewer's session, so a retry sends the same rejected
   * login again — worth naming so the report that reaches an operator says
   * something more useful than "the preview is broken".
   */
  DOCUMENT_SERVICE_UNAUTHORIZED: {
    title: 'Preview unavailable',
    detail: 'The document service rejected this system’s credentials. This needs an administrator.',
    retryable: false,
  },
  SERVICE_ACCOUNT_LOGIN_FAILED: {
    title: 'Preview unavailable',
    detail: 'This system could not sign in to the document service. This needs an administrator.',
    retryable: false,
  },

  /* 502s worth another attempt — a timeout, a restart, a transient blob read. */
  DOCUMENT_SERVICE_UNREACHABLE: {
    title: 'Preview unavailable',
    detail: 'The document service could not be reached.',
    retryable: true,
  },
  DOCUMENT_DOWNLOAD_FAILED: {
    title: 'Preview unavailable',
    detail: 'The document was found but could not be downloaded.',
    retryable: true,
  },
  DOCUMENT_URL_UNAVAILABLE: {
    title: 'Preview unavailable',
    detail: 'The document service returned no location for this document.',
    retryable: true,
  },
}

/**
 * An unrecognised failure is assumed retryable.
 *
 * The two ways of being wrong are not symmetric: hiding the button on something
 * transient strands the reviewer with no way forward, while offering it on
 * something permanent costs one wasted click. A new backend code we have not
 * mapped yet should therefore land here, not in a dead end.
 */
const UNKNOWN: DocumentPreviewFailure = {
  title: 'Preview unavailable',
  detail: 'The document could not be loaded.',
  retryable: true,
}

/** The pane also renders this placeholder when there is no error to describe. */
const NO_ERROR: DocumentPreviewFailure = {
  title: 'Preview unavailable',
  detail: 'The document could not be loaded.',
  retryable: false,
}

/** Dig the backend's code out of an axios rejection without assuming its shape. */
function readCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null

  const body = (error as { response?: { data?: unknown } }).response?.data

  if (typeof body !== 'object' || body === null) return null

  const code = (body as { error?: { code?: unknown } }).error?.code

  return typeof code === 'string' && code ? code : null
}

function readStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null

  const status = (error as { response?: { status?: unknown } }).response?.status

  return typeof status === 'number' ? status : null
}

export function describeDocumentFailure(error: unknown): DocumentPreviewFailure {
  if (!error) return NO_ERROR

  const code = readCode(error)
  if (code && code in FAILURES) return FAILURES[code]

  /*
   * No code, or one we do not know. The status still separates the one case
   * worth separating: a 404 means the server looked and found nothing, which no
   * retry changes. Anything else keeps the button.
   */
  const status = readStatus(error)

  if (status === 404) {
    return {
      title: 'No document for this task',
      detail: 'No document could be found for this task.',
      retryable: false,
    }
  }

  if (status === 501) return FAILURES.DOCUMENT_URL_NOT_CONFIGURED

  return UNKNOWN
}
