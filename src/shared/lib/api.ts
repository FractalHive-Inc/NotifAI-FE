import type { AxiosError } from 'axios'
import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { API_URL } from '@/config/env'
import type { ApiError, ApiResponse, SessionPayload } from '@/types/auth'

const ACCESS_TOKEN_KEY = 'token'
const USER_KEY = 'user'

/**
 * `withCredentials` is required, not cosmetic: the refresh token lives in an
 * HTTP-only cookie set by our backend, and without this axios will not send it.
 */
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

/**
 * Why three outcomes and not just a token-or-null: only a genuinely rejected
 * session should end the session. A backend that is down or a network blip must
 * fail the one request and leave the user logged in — collapsing those cases into
 * "no token" is what turns a transient error into a surprise logout.
 */
type RefreshOutcome =
  | { status: 'refreshed'; token: string }
  | { status: 'rejected' }
  | { status: 'unavailable' }

let refreshPromise: Promise<RefreshOutcome> | null = null

/**
 * Ask the backend for a new access token.
 *
 * No body: the refresh token travels in the HTTP-only cookie, which is why page
 * scripts cannot read or forge it. A bare `axios` call (not `api`) keeps this
 * request out of the interceptor that triggered it, but it still needs
 * `withCredentials` to carry the cookie.
 */
async function refreshAccessToken(): Promise<RefreshOutcome> {
  try {
    const response = await axios.post<ApiResponse<SessionPayload>>(
      `${API_URL}/api/auth/refresh`,
      undefined,
      { withCredentials: true },
    )
    // Only the token is this module's concern; user state belongs to the auth store,
    // which normalises it into a different shape under the same key.
    const { accessToken } = response.data.data
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    return { status: 'refreshed', token: accessToken }
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined

    // 401/403 => the refresh cookie is spent, expired, or absent: session is over.
    // Anything else (5xx, timeout, no response) is not the user's fault.
    if (status === 401 || status === 403) {
      return { status: 'rejected' }
    }
    return { status: 'unavailable' }
  }
}

function clearSessionAndRedirect(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  if (!window.location.pathname.includes('/login')) {
    setTimeout(() => {
      window.location.href = '/login'
    }, 100)
  }
}

interface RetriableConfig extends AxiosRequestConfig {
  _retry?: boolean
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalConfig = error.config as RetriableConfig | undefined

    if (error.response?.status !== 401 || !originalConfig || originalConfig._retry) {
      return Promise.reject(error)
    }

    originalConfig._retry = true

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }

    const outcome = await refreshPromise

    if (outcome.status === 'rejected') {
      clearSessionAndRedirect()
      return Promise.reject(error)
    }

    if (outcome.status === 'unavailable') {
      // Keep the session; surface the failure to the caller instead.
      return Promise.reject(error)
    }

    originalConfig.headers = {
      ...(originalConfig.headers ?? {}),
      Authorization: `Bearer ${outcome.token}`,
    }
    return api.request(originalConfig)
  },
)

export default api
