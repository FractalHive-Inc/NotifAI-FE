import { describe, expect, it } from 'vitest'
import { describeDocumentFailure } from '../document-preview-error'

/** An axios rejection carrying the backend's `ApiError` envelope. */
function rejection(status: number, code?: string) {
  return {
    response: {
      status,
      data: code
        ? { success: false, error: { message: 'irrelevant', code }, timestamp: '' }
        : undefined,
    },
  }
}

describe('describeDocumentFailure', () => {
  it.each([
    ['DOCUMENT_NOT_FOUND', 404],
    ['NO_DOCUMENT', 404],
    ['DOCUMENT_KEY_MISSING', 404],
    ['DOCUMENT_URL_NOT_CONFIGURED', 501],
    ['DOCUMENT_SERVICE_UNAUTHORIZED', 502],
    ['SERVICE_ACCOUNT_LOGIN_FAILED', 502],
  ])('does not offer a retry for %s', (code, status) => {
    expect(describeDocumentFailure(rejection(status, code)).retryable).toBe(false)
  })

  it.each([
    ['DOCUMENT_SERVICE_UNREACHABLE', 502],
    ['DOCUMENT_DOWNLOAD_FAILED', 502],
    ['DOCUMENT_URL_UNAVAILABLE', 502],
  ])('offers a retry for %s', (code, status) => {
    expect(describeDocumentFailure(rejection(status, code)).retryable).toBe(true)
  })

  it('names a missing document rather than blaming the load', () => {
    const failure = describeDocumentFailure(rejection(404, 'DOCUMENT_NOT_FOUND'))

    expect(failure.title).toBe('No document for this task')
    expect(failure.detail).toContain('no stored document')
  })

  /*
   * The distinction the whole module exists for: two 404s and two 502s that the
   * old status-only check collapsed into one placeholder.
   */
  it('separates a missing document from an unreachable service', () => {
    const missing = describeDocumentFailure(rejection(404, 'DOCUMENT_NOT_FOUND'))
    const unreachable = describeDocumentFailure(rejection(502, 'DOCUMENT_SERVICE_UNREACHABLE'))

    expect(missing.retryable).toBe(false)
    expect(unreachable.retryable).toBe(true)
    expect(missing.title).not.toBe(unreachable.title)
  })

  it('separates rejected server credentials from a transient outage', () => {
    const credentials = describeDocumentFailure(rejection(502, 'DOCUMENT_SERVICE_UNAUTHORIZED'))

    expect(credentials.retryable).toBe(false)
    expect(credentials.detail).toContain('administrator')
  })

  it('keeps the retry when the code is unrecognised', () => {
    expect(describeDocumentFailure(rejection(502, 'SOMETHING_NEW')).retryable).toBe(true)
  })

  it('falls back to the status when the body carries no code', () => {
    expect(describeDocumentFailure(rejection(404)).retryable).toBe(false)
    expect(describeDocumentFailure(rejection(501)).title).toBe('Preview not configured')
    expect(describeDocumentFailure(rejection(500)).retryable).toBe(true)
  })

  it('survives a rejection with no response at all', () => {
    const failure = describeDocumentFailure(new Error('Network Error'))

    expect(failure.title).toBe('Preview unavailable')
    expect(failure.retryable).toBe(true)
  })

  it('offers no retry when there is no error to describe', () => {
    expect(describeDocumentFailure(null).retryable).toBe(false)
    expect(describeDocumentFailure(undefined).retryable).toBe(false)
  })
})
