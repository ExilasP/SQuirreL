interface Props {
  value: string
  /** Whether the column accepts `NULL`; the NULL button is only shown then. */
  isNullable: boolean
  onChange(value: string): void
  /** Saves `value`, or SQL `NULL` when given `null`. */
  onCommit(value: string | null): void
  /** Escape pressed: leave the editor and give the keyboard back to the grid. */
  onCancel(): void
  /** Focus moved elsewhere: leave the editor without stealing focus back. */
  onBlur(): void
}

/**
 * Inline editor shown in a grid cell on double-click or Enter.
 *
 * Has a minimum width so that narrow columns (short ids, booleans…) still
 * leave room to read and edit the value; the column widens while editing.
 */
export function CellEditor({ value, isNullable, onChange, onCommit, onCancel, onBlur }: Props) {
  return (
    <div className="flex gap-1 -mx-2 min-w-48">
      <input autoFocus className="field !py-0.5 font-mono flex-1 min-w-0" value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onCommit(value); if (e.key === 'Escape') onCancel() }}
        onBlur={onBlur} />
      {isNullable && (
        <button className="btn !py-0 !px-1.5 text-dim" onMouseDown={(e) => { e.preventDefault(); onCommit(null) }}>NULL</button>
      )}
    </div>
  )
}
