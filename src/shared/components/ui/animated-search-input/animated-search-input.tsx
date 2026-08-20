'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/shared/lib/utils'

export interface AnimatedSearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Array of placeholder strings to cycle through with a typewriter effect. */
  placeholders: string[]
  /** Optional class name applied to the wrapping container div. */
  containerClassName?: string
  /** Delay (ms) between each typed character. @default 55 */
  typeSpeed?: number
  /** Delay (ms) between each deleted character. @default 28 */
  deleteSpeed?: number
  /** How long (ms) the full placeholder is displayed before deleting. @default 1800 */
  pauseAfterType?: number
}

// ─── AnimState (ref-only, never triggers renders) ─────────────────────────────

interface AnimState {
  phraseIndex: number
  charIndex: number
  phase: 'typing' | 'pausing' | 'deleting'
  timerId: ReturnType<typeof setTimeout> | null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Renders individual characters with Framer Motion enter/exit animations.
 * Each character is its own `AnimatePresence` child so deletions animate out
 * and additions animate in independently.
 */
const AnimatedPlaceholder = React.memo(
  ({
    text,
    // reducedMotion,
  }: {
    text: string
    // reducedMotion: boolean | null;
  }) => (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center pl-9 pr-3"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {text.split('').map((char, i) => (
          <motion.span
            key={`${char}-${i}`}
            // variants={reducedMotion ? undefined : charVariants}
            initial="hidden"
            animate="visible"
            // exit="exit"
            transition={{
              duration: 0.12,
              ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quart — smooth but snappy
            }}
            className="inline-block whitespace-pre text-sm text-muted-foreground"
            style={{ willChange: 'transform, opacity' }}
          >
            {char}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  ),
)
AnimatedPlaceholder.displayName = 'AnimatedPlaceholder'

// ─── Main Component ───────────────────────────────────────────────────────────

export const AnimatedSearchInput = React.memo(
  React.forwardRef<HTMLInputElement, AnimatedSearchInputProps>(
    (
      {
        placeholders = [],
        containerClassName,
        className,
        typeSpeed = 55,
        deleteSpeed = 28,
        pauseAfterType = 1800,
        onChange,
        onFocus,
        onBlur,
        value: valueProp,
        defaultValue,
        ...props
      },
      ref,
    ) => {
      // const reducedMotion = useReducedMotion();

      // Whether the input is currently focused — drives the animation lifecycle.
      const [isFocused, setIsFocused] = React.useState(false)

      // Whether the user has typed anything in uncontrolled mode — hides the animated placeholder.
      const [uncontrolledHasValue, setUncontrolledHasValue] = React.useState(() =>
        Boolean(valueProp ?? defaultValue ?? ''),
      )

      // Controlled vs uncontrolled value presence check
      const isControlled = valueProp !== undefined
      const hasValue = isControlled ? Boolean(valueProp) : uncontrolledHasValue

      // The currently displayed animated text — only this triggers re-renders.
      const [displayedText, setDisplayedText] = React.useState('')

      // Stable ref to latest placeholders so the loop never goes stale.
      const placeholdersRef = React.useRef(placeholders)
      React.useLayoutEffect(() => {
        placeholdersRef.current = placeholders
      })

      // All animation bookkeeping — mutations here never cause re-renders.
      const animRef = React.useRef<AnimState>({
        phraseIndex: 0,
        charIndex: 0,
        phase: 'typing',
        timerId: null,
      })

      /** Stop the running loop and fully reset state so next focus starts fresh. */
      const stopAndReset = React.useCallback(() => {
        const state = animRef.current
        if (state.timerId !== null) {
          clearTimeout(state.timerId)
          state.timerId = null
        }
        state.phraseIndex = 0
        state.charIndex = 0
        state.phase = 'typing'
        setDisplayedText('')
      }, [])

      // ── Animation loop ── driven entirely by `isFocused` ──────────────────────
      React.useEffect(() => {
        const phrases = placeholdersRef.current

        // Guard: nothing to animate.
        if (!phrases || phrases.length === 0) return

        // Not focused → make sure the loop is stopped (stopAndReset already
        // called in handleBlur, but this covers programmatic focus changes).
        if (!isFocused) return

        // Single phrase or reduced motion → just show the first phrase, no loop.
        if (phrases.length === 1) {
          // if (phrases.length === 1 || reducedMotion) {
          setDisplayedText(phrases[0])
          return
        }

        const state = animRef.current

        function tick() {
          const phrases = placeholdersRef.current
          const fullText = phrases[state.phraseIndex]

          switch (state.phase) {
            case 'typing': {
              if (state.charIndex < fullText.length) {
                state.charIndex += 1
                setDisplayedText(fullText.slice(0, state.charIndex))
                state.timerId = setTimeout(tick, typeSpeed)
              } else {
                state.phase = 'pausing'
                state.timerId = setTimeout(tick, pauseAfterType)
              }
              break
            }
            case 'pausing': {
              state.phase = 'deleting'
              state.timerId = setTimeout(tick, deleteSpeed)
              break
            }
            case 'deleting': {
              if (state.charIndex > 0) {
                state.charIndex -= 1
                setDisplayedText(fullText.slice(0, state.charIndex))
                state.timerId = setTimeout(tick, deleteSpeed)
              } else {
                state.phraseIndex = (state.phraseIndex + 1) % phrases.length
                state.phase = 'typing'
                state.timerId = setTimeout(tick, typeSpeed)
              }
              break
            }
          }
        }

        // Kick off fresh loop each time we focus.
        state.timerId = setTimeout(tick, typeSpeed)

        return () => {
          // Cleanup runs when isFocused flips to false or on unmount.
          if (state.timerId !== null) {
            clearTimeout(state.timerId)
            state.timerId = null
          }
        }

        // typeSpeed / deleteSpeed / pauseAfterType excluded intentionally:
        // they are configuration constants, not reactive triggers.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [isFocused])

      // ── Event handlers ─────────────────────────────────────────────────────────

      const handleFocus = React.useCallback(
        (e: React.FocusEvent<HTMLInputElement>) => {
          setIsFocused(true)
          onFocus?.(e)
        },
        [onFocus],
      )

      const handleBlur = React.useCallback(
        (e: React.FocusEvent<HTMLInputElement>) => {
          setIsFocused(false)
          // Reset so the next focus always starts from the beginning.
          stopAndReset()
          onBlur?.(e)
        },
        [onBlur, stopAndReset],
      )

      const handleChange = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
          setUncontrolledHasValue(e.target.value.length > 0)
          onChange?.(e)
        },
        [onChange],
      )

      // ── Derived render flags ───────────────────────────────────────────────────

      // Show the animated typewriter only when focused AND no real value typed.
      const showAnimated = isFocused && !hasValue

      // When unfocused and empty, show a static dimmed hint so the field
      // doesn't look completely blank.
      const showStaticHint = !isFocused && !hasValue

      return (
        <div className={cn('relative w-[300px]', containerClassName)}>
          {/* Search icon */}
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />

          {/*
           * Static hint — visible only when unfocused and empty.
           * Fades in/out so the transition between static ↔ animated is smooth.
           */}
          <AnimatePresence>
            {showStaticHint && (
              <motion.span
                key="static-hint"
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none absolute inset-0 z-[3] flex items-center pl-9 pr-3 text-sm text-muted-foreground/50 truncate"
              >
                {placeholders[0]}
              </motion.span>
            )}
          </AnimatePresence>

          {/*
           * Animated placeholder — active only while focused and empty.
           * z-[3] keeps it above the opaque input background (z-[2]).
           * pointer-events-none lets all clicks pass through to the input.
           */}
          <AnimatePresence>
            {showAnimated && (
              <motion.div
                key="animated-placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none absolute inset-0 z-3 flex items-center overflow-hidden"
              >
                <AnimatedPlaceholder
                  text={displayedText}
                  // reducedMotion={reducedMotion}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Native input — transparent placeholder so our overlay shows */}
          <input
            ref={ref}
            type="search"
            aria-label={props['aria-label'] ?? 'Search'}
            value={valueProp}
            defaultValue={defaultValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              'relative z-2 flex h-9 w-full rounded-lg border border-border bg-white px-3 py-1',
              'pl-9 pr-3 text-sm transition-colors',
              'placeholder:text-transparent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
            {...props}
          />
        </div>
      )
    },
  ),
)

AnimatedSearchInput.displayName = 'AnimatedSearchInput'
