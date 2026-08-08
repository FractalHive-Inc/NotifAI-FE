import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RefreshOutcome } from '@/shared/lib/api'

/**
 * The expired-token path, which is what took the Ingestion Requests page down:
 * the client had no way to renew a token the rest of the app renews silently.
 *
 * These drive the real axios instance through a stub adapter rather than
 * mocking the module's own functions, because the behaviour under test lives in
 * the interceptor — retry-once, and what happens when the refresh itself fails.
 */

const refreshSession = vi.fn<() => Promise<RefreshOutcome>>()

vi.mock('@/shared/lib/api', () => ({
  ACCESS_TOKEN_KEY: 'token',
  refreshSession: () => refreshSession(),
}))

/**
 * The `Authorization` header of every request the stub adapter saw.
 *
 * A snapshot rather than the config itself: axios retries by mutating and
 * re-dispatching the *same* config object, so holding references would show
 * every recorded attempt carrying the last attempt's token.
 */
let seen: (string | undefined)[] = []
/** Statuses to answer with, in order; the last one repeats. */
let replies: number[] = []

/**
 * `config` has to be threaded onto the error: the interceptor reads it to know
 * what to retry, and an error without one is indistinguishable from a request
 * that never went out.
 */
function failure(config: AxiosRequestConfig, status: number): Promise<never> {
  const response = {
    data: status === 401 ? { detail: { message: 'User authentication failed' } } : {},
    status,
    statusText: '',
    headers: {},
    config,
  } as unknown as AxiosResponse
  return Promise.reject(
    new axios.AxiosError(
      `Request failed with status code ${status}`,
      axios.AxiosError.ERR_BAD_REQUEST,
      config as never,
      {},
      response,
    ),
  )
}

axios.defaults.adapter = (config: AxiosRequestConfig) => {
  seen.push((config.headers as Record<string, string> | undefined)?.Authorization)
  const status = replies[Math.min(seen.length - 1, replies.length - 1)]
  if (status >= 400) return failure(config, status)
  return Promise.resolve({
    data: { message: 'Success', data: [{ id: 'j1', status: 'completed' }] },
    status,
    statusText: 'OK',
    headers: {},
    config,
  } as unknown as AxiosResponse)
}

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
})
vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })

// Imported after the adapter and globals are in place: `axios.create` captures
// the adapter from defaults when the module body runs.
const { fetchProcessingJobs } = await import('../processing-jobs')

beforeEach(() => {
  seen = []
  replies = [200]
  store.set('token', 'expired-token')
  refreshSession.mockReset()
})

describe('ingestion client authentication', () => {
  it('sends the stored access token', async () => {
    await fetchProcessingJobs()

    expect(seen).toHaveLength(1)
    expect(seen[0]).toBe('Bearer expired-token')
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('refreshes an expired token and retries with the new one', async () => {
    replies = [401, 200]
    // Faithful to the real `refreshSession`, which persists the token before it
    // resolves — that write is what the retry actually picks up.
    refreshSession.mockImplementation(() => {
      store.set('token', 'fresh-token')
      return Promise.resolve({ status: 'refreshed', token: 'fresh-token' })
    })

    await expect(fetchProcessingJobs()).resolves.toHaveLength(1)

    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe('Bearer expired-token')
    expect(seen[1]).toBe('Bearer fresh-token')
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  /** A fresh token that is also rejected is not an expiry problem. */
  it('retries at most once, so a persistent 401 cannot loop', async () => {
    replies = [401]
    refreshSession.mockResolvedValue({ status: 'refreshed', token: 'fresh-token' })

    await expect(fetchProcessingJobs()).rejects.toThrow(/authentication failed/i)
    // Two attempts, not three or forever.
    expect(seen).toHaveLength(2)
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it.each<RefreshOutcome>([{ status: 'rejected' }, { status: 'unavailable' }])(
    'surfaces the failure without retrying when the refresh is %j',
    async (outcome) => {
      replies = [401]
      refreshSession.mockResolvedValue(outcome)

      await expect(fetchProcessingJobs()).rejects.toThrow()
      // No second attempt: refreshing produced no token to attempt it with.
      expect(seen).toHaveLength(1)
    },
  )

  /** An empty system answers 404, and the page must open on an empty table. */
  it('reads a 404 as no jobs rather than an error', async () => {
    replies = [404]

    await expect(fetchProcessingJobs()).resolves.toEqual([])
    expect(refreshSession).not.toHaveBeenCalled()
  })
})
