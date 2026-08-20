import { Fragment, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Building2, Folder, Inbox, LayoutGrid, Send, Upload } from 'lucide-react'
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

interface AppLayoutProps {
  children: React.ReactNode
}

/** Paths match the routes declared in `app/router.tsx`. */
const NAV_ITEMS: NavMainItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutGrid },
  { title: 'Tasks', url: '/tasks', icon: Inbox },
  { title: 'Party Onboarding', url: '/party-onboarding', icon: Building2 },
  { title: 'Upload Document', url: '/upload', icon: Upload },
  { title: 'Incoming Requests', url: '/incoming-requests', icon: Activity },
  { title: 'Tally Push Logs', url: '/tally-push-logs', icon: Send },
  { title: 'PO Folders', url: '/po-folders', icon: Folder },
]

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
          return (
            <Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{formatSegment(segment)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={href}>{formatSegment(segment)}</Link>
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
      brand={<p className="text-h2 font-semibold text-primary">NotifAI</p>}
      user={{ name: user?.name || user?.email || 'User' }}
      onLogout={() => void logout()}
      // Nothing feeds a notification count yet; showing the registry's demo "3"
      // would be inventing unread items that do not exist.
      notificationCount={0}
    >
      <Breadcrumbs />
      {children}
    </FhAppLayout>
  )
}
