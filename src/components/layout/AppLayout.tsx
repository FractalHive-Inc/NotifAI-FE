import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar, { COLLAPSED_DRAWER_WIDTH, DRAWER_WIDTH } from './Sidebar'
import { SidebarProvider, SidebarInset } from '@/shared/components/ui/sidebar/sidebar'
import { useSidebar } from '@/shared/components/ui/sidebar/use-sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/components/ui/breadcrumb/breadcrumb'

interface AppLayoutProps {
  children: React.ReactNode
}

function AppLayoutContent({ children }: AppLayoutProps) {
  const { open } = useSidebar()
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)
  const dashboardSegments = segments[0] === 'dashboard' ? segments.slice(1) : segments

  const formatSegment = (value: string) =>
    value
      .split('-')
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
      .join(' ')

  const breadcrumbSegments = dashboardSegments

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      <Header title="NotifAI" />
      <div className="relative flex w-full min-w-0 flex-1 overflow-x-hidden bg-sidebar-dashboard">
        <Sidebar />

        <SidebarInset
          style={{ paddingLeft: (open ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH) + 10 }}
          className="box-border min-w-0 w-full overflow-x-hidden bg-transparent pt-0 transition-[padding] duration-300 ease-in-out"
        >
          <div className="mt-[72px] min-h-[calc(100vh-72px)] rounded-tl-[32px] bg-background px-6 pt-6 pb-12 md:px-10 lg:px-14 xl:px-20">
            <div className="w-full min-w-0 overflow-x-hidden">
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
                    const href = `/${dashboardSegments.slice(0, index + 1).join('/')}`
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
              {children}
            </div>
          </div>
        </SidebarInset>
      </div>
    </div>
  )
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider className="min-h-screen" defaultOpen={false}>
      <AppLayoutContent>{children}</AppLayoutContent>
    </SidebarProvider>
  )
}
