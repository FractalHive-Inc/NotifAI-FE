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
              {/* <Route path="/los-logs" element={<LOSLogsPage />} />
              <Route path="/los-logs/:id" element={<LOSLogDetailPage />} />
              <Route path="/documents" element={<DocumentsHubPage />} />
              <Route path="/documents/all" element={<AllDocumentsPage />} />
              <Route path="/documents/all/:id" element={<DocumentDetailPage />} />
              <Route path="/documents/invoices" element={<InvoicesPage />} />
              <Route path="/documents/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/documents/po-folders" element={<POFoldersPage />} />
              <Route path="/documents/po-folders/:id" element={<POFolderDetailPage />} />
              <Route path="/documents/discounting-requests" element={<DiscountingRequestsPage />} />
              <Route
                path="/documents/discounting-requests/:id"
                element={<DiscountingRequestDetailPage />}
              /> */}
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
