import { create } from 'zustand'
import api from '@/shared/lib/api'
import type { ApiResponse, BackendUser, SessionPayload, User } from '@/types/auth'
import { toUser } from '@/types/auth'

const ACCESS_TOKEN_KEY = 'token'
const USER_KEY = 'user'

/**
 * The refresh token is intentionally absent from this store and from localStorage.
 * It lives in an HTTP-only cookie set by the backend, so page scripts cannot read
 * it — which is the point. `withCredentials` on the api client carries it.
 */
interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  setUser: (user: User) => void
  setToken: (token: string) => void
}

function readJSON<T>(key: string): T | null {
  const value = localStorage.getItem(key)
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function writeStorage(key: string, value: string | object): void {
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
}

function clearStorage(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export const useAuthStore = create<AuthState>((set, get) => {
  const initialToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  const initialUser = readJSON<User>(USER_KEY)

  return {
    user: initialUser,
    token: initialToken,
    isAuthenticated: Boolean(initialToken && initialUser),
    isLoading: false,

    /**
     * Credentials go to our own backend, which relays them to the auth service
     * server-to-server, returns the access token, and sets the refresh cookie.
     */
    login: async (email: string, password: string) => {
      set({ isLoading: true })
      try {
        const response = await api.post<ApiResponse<SessionPayload>>('/api/auth/login', {
          email,
          password,
        })

        const { accessToken, user: backendUser } = response.data.data
        const user = toUser(backendUser)

        writeStorage(ACCESS_TOKEN_KEY, accessToken)
        writeStorage(USER_KEY, user)

        set({
          token: accessToken,
          user,
          isAuthenticated: true,
          isLoading: false,
        })
      } catch (error) {
        set({ isLoading: false })
        throw error
      }
    },

    logout: async () => {
      try {
        // Revokes the session at the auth service and clears the refresh cookie.
        // The cookie rides along automatically; no token needs passing.
        await api.post('/api/auth/logout')
      } catch {
        // Server-side logout failed; still clear local state.
      }

      clearStorage()
      set({ user: null, token: null, isAuthenticated: false })
    },

    checkAuth: async () => {
      const { token: storeToken } = get()
      let token = storeToken

      if (!token) {
        token = localStorage.getItem(ACCESS_TOKEN_KEY)
        if (token) {
          const storedUser = readJSON<User>(USER_KEY)
          if (storedUser) {
            set({ token, user: storedUser, isAuthenticated: true })
          }
        }
      }

      if (!token) {
        set({ isAuthenticated: false, isLoading: false })
        return
      }

      set({ isLoading: true })
      try {
        // /api/auth/me returns the user directly under `data`.
        const response = await api.get<ApiResponse<BackendUser>>('/api/auth/me')
        const user = toUser(response.data.data)

        writeStorage(USER_KEY, user)
        // The interceptor may have rotated the token mid-flight; read it back.
        const currentToken = localStorage.getItem(ACCESS_TOKEN_KEY) ?? token

        set({
          token: currentToken,
          user,
          isAuthenticated: true,
          isLoading: false,
        })
      } catch {
        // The interceptor already attempted a refresh. If the session was genuinely
        // rejected it cleared storage; if the backend was merely unreachable it left
        // storage intact. Use that as the signal, so an outage doesn't sign anyone out.
        const sessionSurvived = Boolean(localStorage.getItem(ACCESS_TOKEN_KEY))

        if (sessionSurvived) {
          set({ isLoading: false })
          return
        }

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        })
      }
    },

    setUser: (user: User) => {
      writeStorage(USER_KEY, user)
      set({ user })
    },

    setToken: (token: string) => {
      writeStorage(ACCESS_TOKEN_KEY, token)
      set({ token, isAuthenticated: true })
    },
  }
})
