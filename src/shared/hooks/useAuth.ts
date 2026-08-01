import { useAuthStore } from '@/store/authStore'

export const useAuth = () => {
  const { user, token, isAuthenticated, isLoading, login, logout, checkAuth, setUser, setToken } =
    useAuthStore()

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
    setUser,
    setToken,
  }
}
