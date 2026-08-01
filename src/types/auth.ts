/**
 * Auth contracts.
 *
 * The browser talks only to the NotifAI backend. Credentials are relayed to the
 * Keycloak-backed auth service server-side, so no auth-service shapes appear here —
 * the token we hold is issued and verified by our own backend.
 */

/**
 * The authenticated caller, as the backend serialises it from access-token claims.
 *
 * `id` is the auth service's user id; the backend has no local user table.
 */
export interface BackendUser {
  id: string
  email: string
  full_name: string
  roles: string[]
  permissions: string[]
  applicationId: string | null
  orgUnitId: string | null
}

export interface User {
  id: string
  email: string
  name: string
  roles: string[]
  permissions: string[]
  applicationId: string | null
  orgUnitId: string | null
}

/**
 * Payload of POST /api/auth/login and POST /api/auth/refresh.
 *
 * There is deliberately no refresh token here — it is set as an HTTP-only cookie by
 * the backend and never exposed to page scripts.
 */
export interface SessionPayload {
  accessToken: string
  /** Seconds until the access token expires, when the provider reports it. */
  expiresIn: number | null
  user: BackendUser
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  timestamp: string
}

export interface ApiError {
  success: false
  error: {
    message: string
    code: string
    details?: unknown
  }
  timestamp: string
}

/** Normalise the backend payload into the shape the UI uses. */
export function toUser(backendUser: BackendUser): User {
  return {
    id: backendUser.id,
    email: backendUser.email,
    name: backendUser.full_name || backendUser.email,
    roles: backendUser.roles ?? [],
    permissions: backendUser.permissions ?? [],
    applicationId: backendUser.applicationId,
    orgUnitId: backendUser.orgUnitId,
  }
}
