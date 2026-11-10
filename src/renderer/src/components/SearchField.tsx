import { forwardRef, type KeyboardEvent } from 'react'
import { Search, X } from 'lucide-react'

interface Props {
  value: string
  placeholder: string
  onChange(value: string): void
  /** Extra key handling (e.g. Enter to jump to the next match); Escape is handled here. */
  onKeyDown?(event: KeyboardEvent<HTMLInputElement>): void
  /** Called after Escape cleared the field, to give the focus back to the content. */
  onEscape?(): void
  /** Optional text shown at the right of the field, such as `2 / 5`. */
  status?: string
  className?: string
}

/** Text field with a search icon and a clear button, targeted by Ctrl+F. */
export const SearchField = forwardRef<HTMLInputElement, Props>(function SearchField({ value, placeholder, onChange, onKeyDown, onEscape, status, className }, ref) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); onChange(''); onEscape?.(); return }
    onKeyDown?.(event)
  }
  return (
    <div className={`relative ${className ?? ''}`}>
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
      <input ref={ref} className="field !pl-8 !pr-16" placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} onKeyDown={handleKeyDown} />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-dim">
        {value && status}
        {value && <button className="hover:text-fg" title="Clear (Esc)" onClick={() => onChange('')}><X size={12} /></button>}
      </span>
    </div>
  )
})
