import type { Ref, SelectHTMLAttributes } from 'react'

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  /** Values the column accepts, in the order the type declares them. */
  options: string[]
  /** Current text; shown as an extra entry when it is not one of `options` (e.g. empty). */
  value: string
  placeholder?: string
  onChange(value: string): void
  ref?: Ref<HTMLSelectElement>
}

/** Drop-down restricted to the labels of an enum column. */
export function EnumSelect({ options, value, placeholder = 'Choose…', onChange, ...rest }: Props) {
  const isKnown = options.includes(value)
  return (
    <select {...rest} value={value} onChange={(e) => onChange(e.target.value)}>
      {!isKnown && <option value={value} disabled>{value || placeholder}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

/** Opens the native picker so arrow keys browse the list instead of changing the value right away. */
export function openPicker(select: HTMLSelectElement | null): void {
  try { select?.showPicker() } catch { /* needs a user gesture; the select stays usable without it */ }
}

