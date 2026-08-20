import * as React from 'react'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/utils'

const badgeVariants = cva(
  'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        pending:
          'border-transparent bg-fh-warning-100 text-fh-warning-900 [a&]:hover:bg-warning-500/90',
        error: 'border-transparent bg-fh-error-100 text-fh-error-700 [a&]:hover:bg-error-500/90 ',
        info: 'border-transparent bg-fh-info-100 text-fh-info-700 [a&]:hover:bg-info-500/90 ',
        success:
          'border-transparent bg-fh-success-100 text-fh-success-700 [a&]:hover:bg-success-500/90 ',
        secondary: 'border-transparent bg-fh-gray-200 text-fh-gray-600 [a&]:hover:bg-gray-500/90 ',
        primary:
          'border-transparent bg-fh-primary-100 text-fh-primary-500 [a&]:hover:bg-primary-500/90 ',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
