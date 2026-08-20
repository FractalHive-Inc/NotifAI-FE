import * as React from 'react'

import * as TabsPrimitive from '@radix-ui/react-tabs'
import { motion } from 'motion/react'

import { cn } from '@/shared/lib/utils'

const TABS_INDICATOR_LAYOUT_ID = 'tabs-active-indicator'

const TabsContext = React.createContext<{
  value: string
  layoutId: string | undefined
}>({ value: '', layoutId: undefined })

function useTabsContext() {
  const context = React.useContext(TabsContext)
  return context
}

interface TabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {
  /** Optional layoutId for shared layout animation of the active tab indicator */
  layoutId?: string
}

function Tabs({
  className,
  layoutId: customLayoutId,
  value: controlledValue,
  onValueChange,
  defaultValue,
  ...rootProps
}: TabsProps) {
  const generatedId = React.useId()
  const layoutId = customLayoutId ?? `tabs-indicator-${generatedId}`
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? '')
  const value = controlledValue ?? uncontrolledValue

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(newValue)
      }
      onValueChange?.(newValue)
    },
    [controlledValue, onValueChange],
  )

  return (
    <TabsContext.Provider value={{ value: value ?? '', layoutId }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className={cn('flex flex-col gap-2', className)}
        value={value}
        onValueChange={handleValueChange}
        defaultValue={defaultValue}
        {...rootProps}
      />
    </TabsContext.Provider>
  )
}

const springTransition = { type: 'spring' as const, stiffness: 400, damping: 35, bounce: 0 }

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'bg-muted text-muted-foreground relative inline-flex h-9 w-fit items-center justify-center rounded-[0.625rem] p-0.75 overflow-hidden',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  value,
  showBgSpan = true,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & { showBgSpan?: boolean }) {
  const { value: activeValue, layoutId } = useTabsContext()
  const isActive = activeValue === value
  const indicatorLayoutId = layoutId ?? TABS_INDICATOR_LAYOUT_ID

  return (
    <motion.span
      className="inline-flex flex-1"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      // transition={springTransition}
    >
      <TabsPrimitive.Trigger
        data-slot="tabs-trigger"
        value={value}
        className={cn(
          'relative',
          "dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[0.625rem] border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-transparent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          'data-[state=active]:shadow-sm dark:data-[state=active]:bg-transparent',
          className,
        )}
        {...props}
      >
        {isActive && indicatorLayoutId && showBgSpan ? (
          <motion.span
            layoutId={indicatorLayoutId}
            className="bg-background dark:bg-input/30 dark:border-input absolute inset-0 rounded-[0.625rem] border border-transparent shadow-sm"
            transition={springTransition}
            style={{ zIndex: 0 }}
            aria-hidden
          />
        ) : null}
        <span className="relative z-1">{children}</span>
      </TabsPrimitive.Trigger>
    </motion.span>
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
