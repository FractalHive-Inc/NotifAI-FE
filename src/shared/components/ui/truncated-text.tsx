import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'

export interface TruncatedTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The text string to display and truncate. */
  text: string
  /** Additional CSS class names for the container. */
  className?: string
  /** CSS max-width constraint for the container (e.g. `"100%"`, `"12rem"`, `"200px"`). */
  maxWidth?: string
  /** Whether to show a tooltip for the full string. Defaults to `true`. */
  showTooltip?: boolean
  /**
   * Where to trigger the tooltip on hover:
   * - `"ellipsis"`: Show tooltip ONLY when hovering directly over the "..." suffix (default).
   * - `"container"`: Show tooltip when hovering anywhere over the text container.
   */
  tooltipTrigger?: 'ellipsis' | 'container'
  /** Tooltip position side (`"top"` | `"right"` | `"bottom"` | `"left"`). Defaults to `"top"`. */
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  /** Optional custom content for the tooltip (defaults to `text`). */
  tooltipContent?: React.ReactNode
}

/** Single-line text truncation with clean CSS ellipsis and tooltip on hover over "..." */
export function TruncatedText({
  text,
  className,
  maxWidth = '100%',
  showTooltip = true,
  tooltipTrigger = 'ellipsis',
  tooltipSide = 'top',
  tooltipContent,
  ...props
}: TruncatedTextProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const textRef = React.useRef<HTMLDivElement>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)

  const checkTruncation = React.useCallback(() => {
    const el = textRef.current || containerRef.current
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth)
    }
  }, [])

  React.useEffect(() => {
    checkTruncation()
    window.addEventListener('resize', checkTruncation)
    return () => window.removeEventListener('resize', checkTruncation)
  }, [text, maxWidth, checkTruncation])

  const shouldShowTooltip = showTooltip && isTruncated

  // If tooltipTrigger === "container" and text is truncated:
  if (shouldShowTooltip && tooltipTrigger === 'container') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              ref={textRef}
              onMouseEnter={checkTruncation}
              className={cn('block min-w-0 truncate cursor-pointer', className)}
              style={{ maxWidth }}
              {...props}
            >
              {text}
            </div>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="max-w-xs break-words">
            {tooltipContent ?? text}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Default: tooltipTrigger === "ellipsis"
  // Uses native CSS truncate (preventing character clipping artifacts) with an overlay trigger over "..."
  return (
    <div
      ref={containerRef}
      onMouseEnter={checkTruncation}
      className={cn('relative inline-block min-w-0 max-w-full align-bottom', className)}
      style={{ maxWidth }}
      {...props}
    >
      <div ref={textRef} className="block min-w-0 truncate">
        {text}
      </div>
      {shouldShowTooltip && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="absolute right-0 top-0 bottom-0 w-5 cursor-pointer z-10"
                aria-label="Show full text"
              />
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} className="max-w-xs break-words">
              {tooltipContent ?? text}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

TruncatedText.displayName = 'TruncatedText'
