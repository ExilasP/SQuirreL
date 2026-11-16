import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ColumnInfo } from '@shared/types'
import { applyColumnCompletion, findIdentifierAtCaret, suggestColumns } from '@/lib/whereCompletion'

interface Props {
  value: string
  /** Columns of the browsed table, offered as completions. */
  columns: ColumnInfo[]
  onChange(value: string): void
  /** Called on Enter when no suggestion is being picked. */
  onSubmit(): void
}

/**
 * Filter input for a raw `WHERE` fragment, with a drop-down completing column names.
 *
 * Suggestions appear while typing a name (or on Ctrl+Space); ↑/↓ browse them,
 * Tab or Enter insert the highlighted one and Escape dismisses the list.
 */
export function WhereInput({ value, columns, onChange, onSubmit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [caret, setCaret] = useState(0)
  /** `typing` lists matches only once a name is started; `forced` (Ctrl+Space) also lists every column on an empty prefix. */
  const [openMode, setOpenMode] = useState<'closed' | 'typing' | 'forced'>('closed')
  const [cursor, setCursor] = useState(0)

  const target = useMemo(() => findIdentifierAtCaret(value, caret), [value, caret])
  const suggestions = useMemo(() => {
    if (openMode === 'closed' || !target) return []
    if (openMode === 'typing' && target.prefix === '') return []
    return suggestColumns(target.prefix, columns)
  }, [openMode, target, columns])
  const isShowingSuggestions = suggestions.length > 0

  const syncCaret = () => setCaret(inputRef.current?.selectionStart ?? 0)

  const accept = (column: ColumnInfo) => {
    if (!target) return
    const next = applyColumnCompletion(value, target, column.name)
    onChange(next.text)
    setOpenMode('closed')
    setCaret(next.caret)
    // Wait for React to commit the new value before moving the caret.
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(next.caret, next.caret))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' && e.ctrlKey) { e.preventDefault(); setCursor(0); setOpenMode('forced'); return }
    if (!isShowingSuggestions) { if (e.key === 'Enter') onSubmit(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((i) => (i + 1) % suggestions.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((i) => (i - 1 + suggestions.length) % suggestions.length) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(suggestions[Math.min(cursor, suggestions.length - 1)]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpenMode('closed') }
  }

  return (
    <div className="relative">
      <input ref={inputRef} className="field !w-96 font-mono" placeholder="WHERE …   e.g.  age > 30 AND name LIKE 'A%'" value={value}
        spellCheck={false} autoComplete="off" role="combobox" aria-expanded={isShowingSuggestions} aria-autocomplete="list"
        onChange={(e) => { onChange(e.target.value); setCaret(e.target.selectionStart ?? 0); setCursor(0); setOpenMode('typing') }}
        onSelect={syncCaret} onKeyDown={onKeyDown} onBlur={() => setOpenMode('closed')} />
      {isShowingSuggestions && (
        <div role="listbox" className="absolute left-0 top-full mt-1 z-20 w-96 max-h-64 overflow-auto bg-raised border border-line rounded-lg shadow-xl p-1 font-mono text-[12.5px]">
          {suggestions.map((column, i) => (
            <div key={column.name} role="option" aria-selected={i === cursor}
              ref={(el) => { if (i === cursor) el?.scrollIntoView({ block: 'nearest' }) }}
              className={`flex items-center gap-2 px-2 h-7 rounded-md cursor-pointer ${i === cursor ? 'bg-accent-soft' : 'hover:bg-panel'}`}
              // mousedown, not click: the input would lose focus (and close the list) before a click lands.
              onMouseDown={(e) => { e.preventDefault(); accept(column) }} onMouseMove={() => setCursor(i)}>
              <span className="truncate">{column.name}</span>
              <span className="ml-auto text-dim text-[11px] truncate">{column.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
