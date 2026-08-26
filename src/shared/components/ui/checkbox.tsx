import * as React from 'react'

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { cva, type VariantProps } from 'class-variance-authority'
import { CheckIcon, MinusIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

const checkboxVariants = cva(
  "peer relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-input active:border-primary bg-background shadow-xs outline-none cursor-pointer transition-all duration-200 ease-out active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 before:pointer-events-none before:absolute before:-inset-px before:z-0 before:origin-center before:scale-70 before:bg-primary before:opacity-0 before:content-[''] before:transition-all before:duration-200 before:ease-out motion-reduce:before:transition-none hover:border-ring/50 hover:before:bg-primary/90 data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground data-[state=checked]:before:scale-100 data-[state=checked]:before:opacity-100 data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:before:scale-100 data-[state=indeterminate]:before:opacity-100 aria-invalid:data-[state=checked]:border-destructive aria-invalid:data-[state=checked]:text-destructive-foreground aria-invalid:data-[state=checked]:before:scale-100 aria-invalid:data-[state=checked]:before:bg-destructive aria-invalid:data-[state=checked]:before:opacity-100 aria-invalid:data-[state=indeterminate]:border-destructive aria-invalid:data-[state=indeterminate]:text-destructive-foreground aria-invalid:data-[state=indeterminate]:before:scale-100 aria-invalid:data-[state=indeterminate]:before:bg-destructive aria-invalid:data-[state=indeterminate]:before:opacity-100",
  {
    variants: {
      variant: {
        default: '',
        secondary:
          'border-muted-foreground/30 before:bg-secondary-foreground text-secondary data-[state=checked]:border-secondary-foreground data-[state=checked]:text-secondary data-[state=checked]:before:bg-secondary-foreground data-[state=indeterminate]:border-secondary-foreground data-[state=indeterminate]:text-secondary data-[state=indeterminate]:before:bg-secondary-foreground',
        destructive:
          'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20 before:bg-destructive data-[state=checked]:border-destructive data-[state=checked]:text-destructive-foreground data-[state=checked]:text-white data-[state=checked]:before:bg-destructive data-[state=indeterminate]:border-destructive data-[state=indeterminate]:text-destructive-foreground data-[state=indeterminate]:before:bg-destructive',
        success:
          'border-green-600/40 hover:border-green-600 focus-visible:border-green-600 focus-visible:ring-green-600/20 before:bg-green-600 data-[state=checked]:border-green-600 data-[state=checked]:text-white data-[state=checked]:before:bg-green-600 data-[state=indeterminate]:border-green-600 data-[state=indeterminate]:text-white data-[state=indeterminate]:before:bg-green-600',
      },
      size: {
        sm: 'size-3.5',
        default: 'size-4',
        lg: 'size-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface CheckboxProps
  extends
    React.ComponentProps<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {}

function Checkbox({ className, variant, size, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(checkboxVariants({ variant, size, className }))}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="group relative z-10 flex size-full items-center justify-center text-current pointer-events-none data-[state=checked]:animate-in data-[state=checked]:zoom-in-75 data-[state=checked]:fade-in-0 data-[state=unchecked]:animate-out data-[state=unchecked]:zoom-out-75 transition-transform duration-150 ease-out"
      >
        <CheckIcon className="size-3.5 stroke-[2.5px] group-data-[state=indeterminate]:hidden" />
        <MinusIcon className="size-3.5 stroke-[2.5px] hidden group-data-[state=indeterminate]:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox, checkboxVariants }
