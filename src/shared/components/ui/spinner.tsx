import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const spinnerVariants = cva('shrink-0 text-[#1E3A5F] overflow-visible', {
  variants: {
    size: {
      default: 'size-4',
      sm: 'size-3.5',
      lg: 'size-6',
      xl: 'size-8',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

export interface SpinnerProps
  extends React.ComponentProps<'svg'>, VariantProps<typeof spinnerVariants> {}

const DOT_POSITIONS = [
  { cx: 92, cy: 34, delay: 0 }, // [0,1] top-middle
  { cx: 150, cy: 34, delay: 130 }, // [0,2] top-right
  { cx: 150, cy: 92, delay: 260 }, // [1,2] middle-right
  { cx: 150, cy: 150, delay: 390 }, // [2,2] bottom-right
  { cx: 92, cy: 150, delay: 520 }, // [2,1] bottom-middle
  { cx: 34, cy: 150, delay: 650 }, // [2,0] bottom-left
  { cx: 34, cy: 92, delay: 780 }, // [1,0] middle-left
  { cx: 34, cy: 34, delay: 910 }, // [0,0] top-left
  { cx: 92, cy: 92, delay: 1040 }, // [1,1] center
]

/**
 * 3x3 Grid Clockwise Ring Spinner matching FractalHive design specs.
 * Circles fill in navy clockwise around the outer ring then center,
 * then unfill back to gray in the same clockwise order with no reset, looping continuously.
 */
function Spinner({ className, size, ...props }: SpinnerProps) {
  return (
    <svg
      className={cn(spinnerVariants({ size }), className)}
      viewBox="0 0 184 184"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      aria-hidden="true"
      {...props}
    >
      <style>
        {`
          @keyframes fh-grid-fill {
            0% {
              fill: var(--fh-spinner-on, currentColor);
              transform: scale(1.18);
            }
            4.6% {
              fill: var(--fh-spinner-on, currentColor);
              transform: scale(1);
            }
            50% {
              fill: var(--fh-spinner-on, currentColor);
              transform: scale(1);
            }
            50.01% {
              fill: var(--fh-spinner-off, #C4CAD1);
              transform: scale(0.92);
            }
            54.6% {
              fill: var(--fh-spinner-off, #C4CAD1);
              transform: scale(1);
            }
            100% {
              fill: var(--fh-spinner-off, #C4CAD1);
              transform: scale(1);
            }
          }
        `}
      </style>
      {DOT_POSITIONS.map((dot, i) => (
        <circle
          key={i}
          cx={dot.cx}
          cy={dot.cy}
          r={24}
          fill="var(--fh-spinner-off, #C4CAD1)"
          style={{
            transformOrigin: `${dot.cx}px ${dot.cy}px`,
            animation: 'fh-grid-fill 2.6s linear infinite',
            animationDelay: `${dot.delay}ms`,
          }}
        />
      ))}
    </svg>
  )
}

export { Spinner, Spinner as LoadingSpinner, spinnerVariants }
