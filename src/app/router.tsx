import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import { Skeleton } from '@/shared/components/ui/skeleton/skeleton'

const LoginPage = lazy(() => import('@/pages/login'))
const DashboardPage = lazy(() => import('@/pages/dashboard'))
const PartyOnboardingPage = lazy(() => import('@/pages/party-onboarding'))
const DocumentUploadPage = lazy(() => import('@/pages/document-upload'))
const TasksPage = lazy(() => import('@/pages/tasks'))
const TaskDetailPage = lazy(() => import('@/pages/tasks/detail'))
const IngestionRequestsPage = lazy(() => import('@/pages/ingestion-requests'))
const POFoldersPage = lazy(() => import('@/pages/po-folders'))
const POFolderDetailPage = lazy(() => import('@/pages/po-folders/detail'))

const SuspenseFallback = (
  <div className="space-y-3 p-8">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-64" />
    <Skeleton className="h-48 w-full" />
  </div>
)

function DashboardRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  )
}

function RootRedirect() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return <Navigate to={token ? '/dashboard' : '/login'} replace />
}

export function RouterProvider() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={SuspenseFallback}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route element={<DashboardRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/party-onboarding" element={<PartyOnboardingPage />} />
              <Route path="/upload" element={<DocumentUploadPage />} />
              <Route path="/ingestion-requests" element={<IngestionRequestsPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/tasks/:id" element={<TaskDetailPage />} />
              {/*
               * Top level, not under /documents. The breadcrumb is built from the
               * URL, so a /documents segment renders a crumb linking to a hub
               * page that no longer exists — everything else under it belonged to
               * the retired email pipeline and went with it.
               */}
              <Route path="/po-folders" element={<POFoldersPage />} />
              <Route path="/po-folders/:id" element={<POFolderDetailPage />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
