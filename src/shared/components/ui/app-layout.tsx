'use client'

import * as React from 'react'
import { SidebarInset, SidebarProvider, useSidebar } from '@/shared/components/ui/sidebar'
import { cn } from '@/shared/lib/utils'
import { NavbarSearch } from '@/shared/components/ui/navbar-search/navbar-search'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Button } from '@/shared/components/ui/button'
import { Bell, LogOut, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { AppSidebar, type NavMainItem } from '@/shared/components/ui/app-sidebar'

export interface AppLayoutProps {
  /** Sidebar component (e.g. AppSidebar). */
  sidebar?: React.ReactNode
  /** Main content. */
  children: React.ReactNode
  /** Optional top navbar (e.g. above SidebarProvider). */
  navbar?: React.ReactNode
  /** Whether sidebar is open by default. */
  defaultOpen?: boolean
  /** Controlled open state. */
  open?: boolean
  /** Called when sidebar open state changes. */
  onOpenChange?: (open: boolean) => void
  /** Class name for the outer wrapper. */
  className?: string
  /** Class name for the inner content container. */
  contentClassName?: string
  /** main Navigation items  */
  navigationItems?: NavMainItem[]

  /** on Navigation Click */
  onNavClick?: (url: string) => void

  /**
   * The following make the default navbar usable by a real app. Upstream
   * hardcodes FractalHive branding, a "John Doe" avatar and an inert Logout
   * item; each of those is now a prop that falls back to the original value, so
   * the component still renders the registry's demo chrome when given nothing.
   */
  /** Replaces the FractalHive logo + wordmark on the left of the navbar. */
  brand?: React.ReactNode
  /** Signed-in user shown in the account dropdown. */
  user?: { name: string; initial?: string }
  /** Called when the Logout item is chosen. Without it the item is hidden. */
  onLogout?: () => void
  /** Called when the Profile item is chosen. Without it the item is hidden. */
  onProfile?: () => void
  /** Unread count on the bell. `0` hides the badge. */
  notificationCount?: number
  /** Body of the notifications popover. */
  notifications?: React.ReactNode
}

function LayoutContent({
  sidebar,
  children,
  contentClassName,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
  contentClassName?: string
}) {
  const { open } = useSidebar()

  return (
    <>
      {sidebar}
      <SidebarInset className="bg-sidebar-dashboard relative">
        <div
          className={cn(
            'bg-background pointer-events-none fixed top-14 rounded-tr-2xl right-3 bottom-0 z-0  transition-[left] duration-200 ease-linear',
            open ? 'left-(--sidebar-width)' : 'left-(--sidebar-width-icon)',
          )}
        />
        <div className={cn('relative w-full px-6 pt-6 pb-20 lg:px-15 lg:pt-23 ', contentClassName)}>
          {children}
        </div>
        <div className="-z-1 fixed top-12 right-0 bg-sidebar-dashboard h-screen w-10"></div>
      </SidebarInset>
    </>
  )
}

export function AppLayout({
  sidebar,
  children,
  navbar,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
  contentClassName,
  navigationItems,
  onNavClick,
  brand,
  user,
  onLogout,
  onProfile,
  notificationCount = 3,
  notifications,
}: AppLayoutProps) {
  return (
    <div className={cn('bg-sidebar-dashboard flex min-h-svh flex-col', className)}>
      {navbar ? (
        navbar
      ) : (
        <>
          <div className="bg-sidebar-dashboard fixed top-0 right-0 left-0 z-12 h-14 w-full ">
            <div className="relative flex h-full items-center justify-center px-4">
              <div className="absolute left-1/2 flex -translate-x-1/2 items-center ">
                <NavbarSearch />
              </div>
              <div className="absolute left-6 flex items-center gap-2">
                {brand ?? (
                  <>
                    <img src="/FractalHive_Logo.svg" alt="" />
                    <p className="font-semibold text-h2 text-primary">FractalHive</p>
                  </>
                )}
              </div>
              <div className="absolute right-4 flex h-full items-center justify-end gap-3 p-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-slate-100"
                      aria-label="Open notifications"
                    >
                      <Bell className="size-5" />
                      {notificationCount > 0 && (
                        <span className="bg-destructive absolute -top-0.5 right-0 min-w-5 rounded-full px-1 text-center text-xs font-semibold text-white">
                          {notificationCount}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent align="end" side="bottom" sideOffset={20} className="w-96 p-0">
                    <div className="flex items-center justify-between border-b px-3 py-2">
                      <p className="text-sm font-semibold">Notifications</p>
                      <button type="button" className="text-xs text-blue-600 hover:underline">
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                      {notifications ?? (
                        <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                          No notifications
                        </p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80">
                      <Avatar>
                        <AvatarFallback>
                          {user?.initial ?? user?.name?.charAt(0).toUpperCase() ?? 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium whitespace-nowrap">
                        {user?.name ?? 'John Doe'}
                      </p>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {onProfile && (
                      <DropdownMenuItem onSelect={onProfile}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </DropdownMenuItem>
                    )}
                    {onLogout && (
                      <DropdownMenuItem
                        onSelect={onLogout}
                        className="text-red-600 focus:text-red-600"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Logout</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </>
      )}
      <SidebarProvider
        className="bg-sidebar-dashboard flex-1"
        defaultOpen={defaultOpen}
        open={open}
        onOpenChange={onOpenChange}
      >
        <LayoutContent
          sidebar={
            sidebar ? (
              sidebar
            ) : (
              <AppSidebar navMain={navigationItems || []} onNavClick={onNavClick} />
            )
          }
          contentClassName={contentClassName}
        >
          {children}
        </LayoutContent>
      </SidebarProvider>
    </div>
  )
}

export { AppLayout as ElevateLayout, type AppLayoutProps as ElevateLayoutProps }
