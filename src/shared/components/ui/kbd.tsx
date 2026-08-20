/* eslint-disable react-hooks/set-state-in-effect -- the component detects the platform modifier key after mount; this repo's ruleset is stricter than the registry's. */
import * as React from 'react'
import { cn } from '@/shared/lib/utils'

/** Hook to detect if the client is running on macOS/iOS */
function useIsMacPlatform(): boolean {
  const [isMac, setIsMac] = React.useState(true)

  React.useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent || ''
      const platform = (navigator as any).userAgentData?.platform || navigator.platform || ''
      const macPattern = /Mac|iPhone|iPod|iPad/i
      setIsMac(macPattern.test(platform) || macPattern.test(userAgent))
    }
  }, [])

  return isMac
}

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none',
        "[&_svg:not([class*='size-'])]:size-3",
        'in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10',
        className,
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup, useIsMacPlatform }
