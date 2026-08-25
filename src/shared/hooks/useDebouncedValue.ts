import { useEffect, useState } from 'react'

/**
 * A value that settles rather than tracking every change.
 *
 * The toolbar's search box reports on every keystroke, and the Tasks inbox
 * sends its term to the server — so an unthrottled term turns "INV-1024" into
 * eight requests, each one invalidating the last. Only the final term matters;
 * this holds the value back until typing pauses.
 *
 * The cleanup is what makes it work: every change cancels the pending timer, so
 * the update only lands once `delay` passes with no further edits.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}
