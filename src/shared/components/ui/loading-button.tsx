import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Button, type ButtonProps } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import { Spinner as LoadingSpinner } from '@/shared/components/ui/spinner'

const loadingButtonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      roundness: {
        default: 'rounded-lg',
        round: 'rounded-full',
      },
      size: {
        default: 'h-9 px-4 py-2 text-sm gap-2 [&_svg]:size-4',
        lg: 'h-10 px-5 text-sm gap-2.5 [&_svg]:size-4.5',
        sm: 'h-8 px-3 text-xs gap-1.5 [&_svg]:size-3.5',
        mini: 'h-7 px-2.5 text-xs gap-1 [&_svg]:size-3',
      },
      state: {
        default: '',
        hover: 'bg-accent/80 text-accent-foreground border-accent-foreground/20',
        focus: 'ring-2 ring-primary/80 ring-offset-1 border-primary',
      },
    },
    defaultVariants: {
      roundness: 'default',
      size: 'default',
    },
  },
)

export interface LoadingButtonProps
  extends Omit<ButtonProps, 'size'>, VariantProps<typeof loadingButtonVariants> {
  /** Size variant: default, lg (Large), sm (Small), or mini */
  size?: 'default' | 'lg' | 'sm' | 'mini'
  /** Roundness variant: default (rounded-lg) or round (rounded-full) */
  roundness?: 'default' | 'round'
  /** Display state force override for docs/previews */
  state?: 'default' | 'hover' | 'focus'
  /** Controls whether the loading spinner is displayed */
  loading?: boolean
  /** Custom spinner element */
  spinner?: React.ReactNode
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      className,
      variant = 'outline',
      size = 'default',
      roundness = 'default',
      state,
      loading = true,
      disabled,
      spinner,
      children = 'Label',
      ...props
    },
    ref,
  ) => {
    // Determine button size prop to map to base Button if needed
    const buttonSize =
      size === 'mini' ? 'xs' : size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'default'

    return (
      <Button
        ref={ref}
        variant={variant}
        size={buttonSize}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          loadingButtonVariants({ roundness, size, state }),
          roundness === 'round' && 'rounded-full!',
          size === 'mini' && 'h-7 px-2.5 text-xs gap-1',
          state === 'focus' && 'ring-2 ring-primary/90 ring-offset-1 border-primary',
          state === 'hover' && 'bg-accent text-accent-foreground',
          className,
        )}
        {...props}
      >
        {loading && (spinner || <LoadingSpinner />)}
        {children}
      </Button>
    )
  },
)
LoadingButton.displayName = 'LoadingButton'

export { LoadingButton, loadingButtonVariants, LoadingSpinner }
