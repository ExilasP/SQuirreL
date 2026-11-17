import { EnumSelect, openPicker } from './EnumSelect'

interface Props {
  value: string
  /** Allowed values of an enum column: a drop-down replaces the text input. */
  enumValues?: string[] | null
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
 * Fills the cell: the grid widens the edited column (see
 * `widenEditedColumn`) so that narrow columns leave room to edit the value.
 */
export function CellEditor({ value, enumValues, isNullable, onChange, onCommit, onCancel, onBlur }: Props) {
  return (
    <div className="flex gap-1 -mx-2">
      {enumValues ? (
        // Picking a value saves it at once: there is nothing else to type.
        <EnumSelect ref={openPicker} autoFocus className="field !py-0.5 font-mono flex-1 min-w-0" options={enumValues} value={value}
          onChange={onCommit} onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }} onBlur={onBlur} />
      ) : (
        <input autoFocus className="field !py-0.5 font-mono flex-1 min-w-0" value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommit(value); if (e.key === 'Escape') onCancel() }}
          onBlur={onBlur} />
      )}
      {isNullable && (
        <button className="btn !py-0 !px-1.5 text-dim" onMouseDown={(e) => { e.preventDefault(); onCommit(null) }}>NULL</button>
      )}
    </div>
  )
}
