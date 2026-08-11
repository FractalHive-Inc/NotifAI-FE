import { useLocation, useNavigate } from 'react-router-dom'
import { useSidebar } from '@/shared/components/ui/sidebar/use-sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip/tooltip'

interface SidebarProps {
  className?: string
}

export const DRAWER_WIDTH = 230
export const COLLAPSED_DRAWER_WIDTH = 66

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: 'grid' },
  { label: 'Tasks', path: '/tasks', icon: 'inbox' },
  { label: 'Party Onboarding', path: '/party-onboarding', icon: 'building' },
  { label: 'Upload Document', path: '/upload', icon: 'upload' },
  { label: 'Incoming Requests', path: '/incoming-requests', icon: 'activity' },
  { label: 'Tally Push Logs', path: '/tally-push-logs', icon: 'send' },
  { label: 'PO Folders', path: '/po-folders', icon: 'folder' },
]

function NavIcon({ type }: { type: string }) {
  if (type === 'grid') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  }
  if (type === 'inbox') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    )
  }
  if (type === 'spark') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 3v4M12 17v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M3 12h4M17 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
      </svg>
    )
  }
  if (type === 'doc') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    )
  }
  if (type === 'book') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M5 4a2 2 0 0 1 2-2h12v16H7a2 2 0 0 0-2 2z" />
        <path d="M19 2a2 2 0 0 1 2 2v16H9a2 2 0 0 1-2-2" />
      </svg>
    )
  }
  if (type === 'mail') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 7 9-7" />
      </svg>
    )
  }
  if (type === 'folder') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      </svg>
    )
  }
  if (type === 'send') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m22 2-7 20-4-9-9-4Z" />
      </svg>
    )
  }
  if (type === 'building') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 21h18" />
        <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
        <path d="M15 21V9h2a2 2 0 0 1 2 2v10" />
        <path d="M9 7h2M9 11h2M9 15h2" />
      </svg>
    )
  }
  if (type === 'upload') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m17 8-5-5-5 5" />
        <path d="M12 3v12" />
      </svg>
    )
  }
  if (type === 'activity') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    )
  }
  if (type === 'key') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="7.5" cy="15.5" r="3.5" />
        <path d="m10 13 8.5-8.5" />
        <path d="m16 7 3 3" />
        <path d="m19 4 2 2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

export default function Sidebar({ className }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { open, setOpen, isMobile } = useSidebar()
  const pathname = location.pathname

  const handleNavigation = (path: string) => {
    navigate(path)
    if (isMobile) {
      setOpen(false)
    }
  }

  return (
    <>
      <aside
        style={{ width: open ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH }}
        data-state={open ? 'expanded' : 'collapsed'}
        data-collapsible="icon"
        className={`fixed left-0 top-[72px] z-30 h-[calc(100vh-72px)] bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out ${className ?? ''}`}
      >
        <div className="flex h-full flex-col">
          <div className={`${open ? 'px-4 py-3' : 'px-3 py-3'}`}>
            {open ? <div className="h-6" /> : <div className="h-5" />}
          </div>

          <nav className={`flex-1 overflow-y-auto ${open ? 'p-2' : 'p-1.5'}`}>
            {navItems.map((item) => {
              const isActive = pathname === item.path || pathname?.startsWith(item.path + '/')
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleNavigation(item.path)}
                      className={`mb-1 flex w-full items-center rounded-md text-left text-sm transition-colors ${
                        isActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      } ${open ? 'gap-2 px-3 py-2' : 'justify-center px-2 py-2.5'}`}
                    >
                      <NavIcon type={item.icon} />
                      {open && <span className="truncate">{item.label}</span>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </nav>

          <div className={`mt-auto ${open ? 'px-3 pb-3' : 'px-2 pb-3'}`}>
            <div
              className={`rounded-md ${open ? 'px-2 py-2' : 'px-1 py-2'} text-xs text-muted-foreground`}
            >
              {open ? (
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1">
                    <span>Powered by</span>
                    <img
                      src="/FractalHive_Logo_Website.png"
                      alt="FractalHive Logo"
                      width={12}
                      height={12}
                      className="object-contain"
                    />
                  </div>
                  <span>V 1.0</span>
                </div>
              ) : (
                <div className="flex justify-center">
                  <span>V 1.0</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {open && isMobile && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 top-[72px] z-20 bg-black/30 md:hidden"
        />
      )}
    </>
  )
}
