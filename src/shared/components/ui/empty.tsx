import { cn } from '@/shared/lib/utils'

function EmptyState({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'text-muted-foreground flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center',
        className,
      )}
      {...props}
    />
  )
}

function EmptyStateTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('text-foreground text-base font-semibold', className)} {...props} />
}

function EmptyStateDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-muted-foreground text-sm', className)} {...props} />
}

export { EmptyState, EmptyStateDescription, EmptyStateTitle }
