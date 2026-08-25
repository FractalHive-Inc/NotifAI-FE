import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The FractalHive type scale, as tailwind-merge needs to be told about it.
 *
 * `globals.css` registers `--text-h3` and friends with `@theme`, so Tailwind
 * generates `text-h3` as a font-size utility. tailwind-merge knows nothing
 * about that theme: it only recognises the stock sizes (`text-sm`, `text-lg`),
 * and falls back to treating any other `text-<word>` as a *colour*. So
 * `cn('text-h3', 'text-[#043463]')` looked like two colours in conflict and
 * dropped the size — silently, in every component that pairs a scale class with
 * a colour, which is most of them.
 *
 * Both spellings are listed because both are defined: the bare names and the
 * `fh-` prefixed aliases.
 */
const FH_TEXT_SIZES = [
  'display',
  'h1',
  'h2',
  'h3',
  'h4',
  'body-lg',
  'body',
  'body-sm',
  'caption',
  'overline',
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...FH_TEXT_SIZES, ...FH_TEXT_SIZES.map((size) => `fh-${size}`)] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
