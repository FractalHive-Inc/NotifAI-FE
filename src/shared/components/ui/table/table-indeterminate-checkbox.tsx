import * as React from 'react'

import { Checkbox } from '@/shared/components/ui/checkbox'

export interface IndeterminateCheckboxProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Checkbox>,
  'checked' | 'onChange'
> {
  checked?: boolean | 'indeterminate'
  indeterminate?: boolean
  onChange?: (event: { target: { checked: boolean }; currentTarget: { checked: boolean } }) => void
}

export const IndeterminateCheckbox = React.forwardRef<
  React.ElementRef<typeof Checkbox>,
  IndeterminateCheckboxProps
>(({ checked, indeterminate, onChange, onCheckedChange, className, ...props }, ref) => {
  const checkedState = indeterminate ? 'indeterminate' : checked

  const handleCheckedChange = (newChecked: boolean | 'indeterminate') => {
    onCheckedChange?.(newChecked)
    if (onChange) {
      const syntheticEvent = {
        target: { checked: newChecked === true },
        currentTarget: { checked: newChecked === true },
      }
      onChange(syntheticEvent)
    }
  }

  return (
    <Checkbox
      ref={ref}
      checked={checkedState}
      onCheckedChange={handleCheckedChange}
      className={className}
      {...props}
    />
  )
})
IndeterminateCheckbox.displayName = 'IndeterminateCheckbox'
