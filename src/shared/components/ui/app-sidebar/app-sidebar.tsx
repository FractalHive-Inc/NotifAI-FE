'use client'

import * as React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarRail,
  SidebarSeparator,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/shared/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import type { NavMainItem } from './types'
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { motion } from 'motion/react'
import { TruncatedText } from '@/shared/components/ui/truncated-text'
import { APP_VERSION } from '@/shared/lib/app-version'

/**
 * Attribution strip pinned to the bottom of the sidebar panel.
 *
 * It lives inside the panel rather than in `SidebarFooter`, which sits outside
 * `SidebarContent` and so renders on the dashboard background instead of the
 * white card the nav is drawn on.
 */
function SidebarBrandFooter() {
  return (
    <div className="mt-auto pt-4">
      <SidebarSeparator className="mx-0 w-full" />
      <div className="flex flex-col items-center gap-1 pt-4">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-body font-medium text-[#1e3a5f]">Powered by</span>
          <img
            src="/FractalHive_Logo_Website.png"
            alt=""
            className="size-5 shrink-0 object-contain"
          />
          <span className="text-body font-medium text-[#1e3a5f]">FractalHive</span>
        </div>
        <span className="text-caption text-fh-primary-400">Version {APP_VERSION}</span>
      </div>
    </div>
  )
}

export interface NavMainProps {
  items: NavMainItem[]
  onNavClick?: (url: string) => void
  /** Replaces the default "Powered by FractalHive" strip. Hidden when collapsed. */
  footer?: React.ReactNode
}

export function NavMain({ items, onNavClick, footer }: NavMainProps) {
  const { toggleSidebar, state, setOpen } = useSidebar()
  const isOpen = state === 'expanded'

  return (
    <SidebarGroup className="h-full ">
      <SidebarMenu className="bg-background  border-r-5 border-sidebar-dashboard rounded-tl-2xl  py-4 w-full h-full px-5">
        <SidebarMenuButton onClick={() => toggleSidebar()} isActive={false} className="">
          {isOpen && <span className="text-h3 text-[#1e3a5f] font-semibold">NotifAI</span>}
          {isOpen ? (
            <PanelLeftClose className="ml-auto size-5.5!" />
          ) : (
            <PanelLeftOpen className="mx-auto size-5.5!" />
          )}
        </SidebarMenuButton>
        <SidebarSeparator className="mx-0 mt-2 w-full" />
        <div className="mt-4 min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {items.map((item) => {
            const hasSubItems = item.items && item.items.length > 0
            const hasActiveSubItem = Boolean(item.items?.some((sub) => sub.isActive))
            const isParentActive = Boolean(item.isActive || (!isOpen && hasActiveSubItem))

            if (hasSubItems) {
              return (
                <Collapsible
                  key={item.url}
                  asChild
                  defaultOpen={hasActiveSubItem}
                  className="group/collapsible"
                >
                  <SidebarMenuItem className="relative">
                    {isParentActive && (
                      <motion.div
                        layoutId="main-nav-pill"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        className="absolute inset-0 bg-primary rounded-md pointer-events-none z-0"
                      />
                    )}
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isParentActive}
                        className="relative z-10"
                        onClick={() => {
                          if (!isOpen) {
                            setOpen(true)
                          }
                        }}
                      >
                        {item.icon && <item.icon className="size-5! ml-0.5!" />}
                        {isOpen && <TruncatedText showTooltip text={item.title} />}
                        <ChevronRight className="ml-auto shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="border-none relative overflow-hidden pl-5">
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.url} className="relative">
                            {subItem.isActive && (
                              <>
                                <motion.div
                                  layoutId={`subitem-line-${item.url}`}
                                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                  className="absolute -left-4 top-[-1000px] bottom-1/2 w-3.5 border-l-2 border-b-2 border-black/55 rounded-bl-md pointer-events-none z-10"
                                >
                                  <div className="absolute -right-1.5 -bottom-2 text-black/55">
                                    <ChevronRight className="size-3.5 text-black/55 stroke-[2.5]" />
                                  </div>
                                </motion.div>
                                <motion.div
                                  layoutId={`subitem-pill-${item.url}`}
                                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                  className="absolute inset-0 left-1 bg-primary rounded-md pointer-events-none z-0"
                                />
                              </>
                            )}
                            <SidebarMenuSubButton
                              isActive={subItem.isActive}
                              className={`ml-1 relative z-10 ${
                                !subItem.isActive ? 'text-fh-primary-400!' : 'text-white'
                              }`}
                              onClick={() => onNavClick?.(subItem.url)}
                            >
                              <TruncatedText
                                className="z-9 "
                                tooltipTrigger="container"
                                showTooltip
                                text={subItem.title}
                              />
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            }

            return (
              <SidebarMenuItem key={item.url} className="relative">
                {item.isActive && (
                  <motion.div
                    layoutId="main-nav-pill"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    className="absolute inset-0 bg-primary rounded-md pointer-events-none z-0"
                  />
                )}
                <SidebarMenuButton
                  onClick={() => onNavClick?.(item.url)}
                  isActive={item.isActive}
                  tooltip={item.title}
                  className="relative z-10 "
                >
                  {item.icon && <item.icon className="size-5! ml-0.5!" />}
                  <TruncatedText
                    className="z-9"
                    tooltipTrigger="container"
                    showTooltip
                    text={item.title}
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </div>
        {isOpen && (footer ?? <SidebarBrandFooter />)}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  /** Main nav items (title, url, icon, isActive). */
  navMain: NavMainItem[]
  /** Called when a nav item is clicked. Use with your router (e.g. navigate(url)). */
  onNavClick?: (url: string) => void
  /**
   * Replaces the default "Powered by FractalHive" strip at the bottom of the
   * sidebar panel. Hidden while the sidebar is collapsed either way.
   */
  footer?: React.ReactNode
}

export function AppSidebar({ navMain, onNavClick, footer, ...props }: AppSidebarProps) {
  return (
    /*
     * `Sidebar` is `fixed inset-y-0 h-svh`, so the `mt-14` that clears the
     * navbar pushed its last 56px below the fold — taking the footer with it.
     * Shortening it by the same amount puts the bottom back on screen.
     */
    <Sidebar collapsible="icon" {...props} className="border-none mt-14 h-[calc(100svh-3.5rem)]!">
      <SidebarContent>
        <NavMain items={navMain} onNavClick={onNavClick} footer={footer} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
