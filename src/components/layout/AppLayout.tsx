import { Fragment, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Building2, Folder, Inbox, LayoutGrid, Send } from 'lucide-react'
import { AppLayout as FhAppLayout } from '@/shared/components/ui/app-layout'
import type { NavMainItem } from '@/shared/components/ui/app-sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/components/ui/breadcrumb'
import { useAuth } from '@/shared/hooks/useAuth'
import { useApproval } from '@/shared/hooks/useApprovals'
import { usePOFolder } from '@/shared/hooks/usePOFolders'
import { documentNumber } from '@/features/tasks/lib/document-id'

interface AppLayoutProps {
  children: React.ReactNode
}

/** Paths match the routes declared in `app/router.tsx`. */
const NAV_ITEMS: NavMainItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutGrid },
  { title: 'Tasks', url: '/tasks', icon: Inbox },
  { title: 'ERP / CRM Integrations', url: '/party-onboarding', icon: Building2 },
  { title: 'Incoming Requests', url: '/incoming-requests', icon: Activity },
  { title: 'Tally Push Logs', url: '/tally-push-logs', icon: Send },
  { title: 'PO Folders', url: '/po-folders', icon: Folder },
]

/**
 * Crumb labels come from the sidebar where the route has an entry, so a page is
 * called the same thing in both places. `formatSegment` covers everything else:
 * intermediate paths and any route that never reached the sidebar.
 */
const NAV_TITLES = new Map(NAV_ITEMS.map((item) => [item.url, item.title]))

/**
 * Acronyms the URL spells in lower case. Without these, capitalising the first
 * letter alone turns `po-folders` into "Po Folders", which reads as a word
 * rather than a purchase order.
 */
const ACRONYMS = new Set(['po', 'los', 'hitl', 'ppr', 'id', 'api'])

const formatSegment = (value: string) =>
  value
    .split('-')
    .map((word) => {
      if (!word) return ''
      if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase()
      return word[0].toUpperCase() + word.slice(1)
    })
    .join(' ')

/**
 * Breadcrumbs are ours, not the registry's — `AppLayout` renders children
 * straight into its content column and has no breadcrumb slot, so they sit at
 * the top of that column instead.
 */
function Breadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)
  const breadcrumbSegments = segments[0] === 'dashboard' ? segments.slice(1) : segments

  /*
   * The task detail crumb names the document, not the route param.
   *
   * A reviewer recognises "INV-PHI-2024-0045"; the approval's UUID is an
   * internal key that happens to be in the URL. The label arrives two ways
   * because there are two ways onto the page:
   *
   * - `location.state`, set by the Tasks and Tally-log rows, which already hold
   *   the number. That renders on the first paint with nothing in flight.
   * - The approval itself, for a direct link, a bookmark, a notification, or a
   *   refresh — React Router drops navigation state on reload.
   *
   * `useApproval` is disabled on an empty id, so this is a cache read on the
   * detail route (the page fetches the same query key) and no request at all
   * anywhere else. It still has to be called unconditionally: hooks cannot sit
   * behind the route check.
   */
  const isTaskDetail = breadcrumbSegments.length === 2 && breadcrumbSegments[0] === 'tasks'
  const taskId = isTaskDetail ? breadcrumbSegments[1] : ''
  const { data: approval } = useApproval(taskId)

  const navDocumentId = (location.state as { documentId?: string } | null)?.documentId
  const taskLabel = navDocumentId ?? documentNumber(approval) ?? taskId

  /*
   * The PO folder crumb names the purchase order, for the same reason and by
   * the same two routes as the task crumb above: the folder card passes the
   * number it already shows, and `usePOFolder` — a cache read on this route,
   * disabled everywhere else — covers a direct link or a refresh.
   */
  const isPoFolderDetail = breadcrumbSegments.length === 2 && breadcrumbSegments[0] === 'po-folders'
  const poFolderId = isPoFolderDetail ? breadcrumbSegments[1] : ''
  const { data: poFolder } = usePOFolder(poFolderId)

  const navPoNumber = (location.state as { poNumber?: string } | null)?.poNumber
  const poFolderLabel = navPoNumber ?? poFolder?.po_folder.po_number ?? poFolderId

  return (
    <Breadcrumb className="mb-5">
      <BreadcrumbList>
        <BreadcrumbItem>
          {breadcrumbSegments.length ? (
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Home</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Home</BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {breadcrumbSegments.map((segment, index) => {
          const href = `/${breadcrumbSegments.slice(0, index + 1).join('/')}`
          const isLast = index === breadcrumbSegments.length - 1
          // `formatSegment` would split a document or PO number on its hyphens
          // and title-case the pieces, turning INV-PHI-2024-0045 into prose.
          const label =
            isLast && isTaskDetail
              ? taskLabel
              : isLast && isPoFolderDetail
                ? poFolderLabel
                : (NAV_TITLES.get(href) ?? formatSegment(segment))
          return (
            <Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const navigationItems = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        ...item,
        isActive: location.pathname === item.url || location.pathname.startsWith(`${item.url}/`),
      })),
    [location.pathname],
  )

  return (
    <FhAppLayout
      defaultOpen={false}
      navigationItems={navigationItems}
      onNavClick={(url) => navigate(url)}
      brand={
        <>
          <img src="/manav_logo.png" alt="" className="h-10" />

          <p className="text-h2 font-semibold text-primary"></p>
        </>
      }
      user={{ name: user?.name || user?.email || 'User' }}
      onLogout={() => void logout()}
      // Nothing feeds a notification count yet; showing the registry's demo "3"
      // would be inventing unread items that do not exist.
      //notificationCount={0}
    >
      <Breadcrumbs />
      {children}
    </FhAppLayout>
  )
}
