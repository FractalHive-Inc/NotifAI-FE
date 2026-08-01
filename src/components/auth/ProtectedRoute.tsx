import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { useAuth } from '@/shared/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, checkAuth } = useAuth()
  const [isChecking, setIsChecking] = useState(true)
  const hasCheckedAuth = useRef(false)
  const checkAuthRef = useRef(checkAuth)

  useEffect(() => {
    checkAuthRef.current = checkAuth
  }, [checkAuth])

  useEffect(() => {
    if (hasCheckedAuth.current) return

    const verifyAuth = async () => {
      const token = localStorage.getItem('token')

      if (!token) {
        setIsChecking(false)
        hasCheckedAuth.current = true
        return
      }

      if (!isAuthenticated && !isLoading) {
        try {
          await checkAuthRef.current()
        } catch {
          // handled by checkAuth/logout
        }
      }

      setIsChecking(false)
      hasCheckedAuth.current = true
    }

    const timeoutId = setTimeout(verifyAuth, 50)
    return () => clearTimeout(timeoutId)
  }, [isAuthenticated, isLoading])

  useEffect(() => {
    if (!isChecking && !isLoading && !isAuthenticated) {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
      }
    }
  }, [isChecking, isLoading, isAuthenticated, navigate])

  if (isLoading || isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
