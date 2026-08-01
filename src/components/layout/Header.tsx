import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PanelLeftIcon } from 'lucide-react'
import { useAuth } from '@/shared/hooks/useAuth'
import { useSidebar } from '@/shared/components/ui/sidebar/use-sidebar'
import { DRAWER_WIDTH } from './Sidebar'

interface HeaderProps {
  title?: string
}

export default function Header({ title = 'NotifAI' }: HeaderProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { open, toggleSidebar } = useSidebar()

  const userName = user?.name || 'User'
  const userInitial = useMemo(() => userName.charAt(0).toUpperCase(), [userName])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-[72px] bg-sidebar-dashboard">
      <div className="flex h-full items-center justify-between px-4 md:px-4 lg:px-4">
        <div className="flex min-w-0 items-center gap-3">
          {open ? (
            <div
              style={{ width: DRAWER_WIDTH }}
              className="grid h-9 grid-cols-[35px_1fr_35px] items-center gap-3 whitespace-nowrap"
            >
              <img
                src="/FractalHive_Logo_Website copy.png"
                alt="FractalHive logo"
                width={35}
                height={35}
                className="block size-9 object-contain transition-all duration-300 group-hover/logo:hidden"
              />
              <span className="text-lg text-foreground px-2 transition-all duration-300">
                {title}
              </span>
              <button
                type="button"
                onClick={toggleSidebar}
                title="Toggle sidebar"
                aria-label="Toggle sidebar"
                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-all duration-300 ease-in-out hover:bg-accent"
              >
                <PanelLeftIcon className="size-5 text-foreground/70" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
              className="group relative inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md transition-all duration-300 ease-in-out hover:bg-accent"
            >
              <img
                src="/FractalHive_Logo_Website copy.png"
                alt="FractalHive logo"
                width={35}
                height={35}
                className="size-9 object-contain transition-opacity duration-300 ease-in-out group-hover:opacity-0"
              />
              <PanelLeftIcon className="absolute size-5 text-foreground/70 opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100" />
            </button>
          )}
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-3 px-4">
          <div className="hidden items-center rounded-md border border-input bg-sidebar-accent px-3 py-1.5 md:flex">
            <input
              type="text"
              placeholder="Search..."
              className="w-[220px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <span className="ml-3 text-muted-foreground">⌘E</span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {userInitial}
              </span>
              <span className="hidden max-w-[180px] truncate text-sm font-medium text-foreground sm:block">
                {userName}
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-md border border-border bg-popover p-1 shadow-lg">
                <button
                  type="button"
                  className="block w-full rounded-sm px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent"
                >
                  Profile
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full rounded-sm px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
