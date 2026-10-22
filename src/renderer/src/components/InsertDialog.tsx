import { useState } from 'react'
import { X } from 'lucide-react'
import type { ColumnInfo, TableDetail } from '@shared/types'

type Mode = 'value' | 'null' | 'default'
interface Field { mode: Mode; text: string }

/** Required = NOT NULL with no default: the user must supply a value. */
const isRequired = (c: ColumnInfo) => !c.nullable && c.defaultValue === null && !c.primaryKey
const initialMode = (c: ColumnInfo): Mode => (isRequired(c) ? 'value' : c.defaultValue !== null || c.primaryKey ? 'default' : 'null')

export function InsertDialog({ detail, onSubmit, onClose }: {
  detail: TableDetail
  onSubmit(values: Record<string, unknown>): Promise<void>
  onClose(): void
}) {
  const [fields, setFields] = useState<Record<string, Field>>(
    Object.fromEntries(detail.columns.map((c) => [c.name, { mode: initialMode(c), text: '' }]))
  )
  const [busy, setBusy] = useState(false)
  const set = (name: string, p: Partial<Field>) => setFields((f) => ({ ...f, [name]: { ...f[name], ...p } }))
  const missing = detail.columns.filter((c) => isRequired(c) && fields[c.name].mode === 'value' && fields[c.name].text === '')

  const submit = async () => {
    const values: Record<string, unknown> = {}
    for (const c of detail.columns) {
      const f = fields[c.name]
      if (f.mode === 'value') values[c.name] = f.text
      else if (f.mode === 'null') values[c.name] = null
    }
    setBusy(true)
    try { await onSubmit(values); onClose() } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50" onMouseDown={onClose}>
      <div className="w-[560px] max-h-[85vh] flex flex-col bg-panel border border-line rounded-xl shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-base font-semibold">New row · {detail.name}</h2>
          <button className="btn ghost !p-1" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 overflow-auto">
          {detail.columns.map((c) => {
            const f = fields[c.name]; const req = isRequired(c)
            return (
              <div key={c.name}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-dim text-xs font-mono">{c.type}</span>
                  {req && <span className="text-[10px] uppercase text-danger">required</span>}
                  {c.primaryKey && <span className="text-[10px] uppercase text-accent">pk</span>}
                </div>
                <div className="flex gap-2">
                  <input className="field font-mono" disabled={f.mode !== 'value'} value={f.mode === 'value' ? f.text : ''}
                    placeholder={f.mode === 'default' ? (c.defaultValue ? `default: ${c.defaultValue}` : 'default') : f.mode === 'null' ? 'NULL' : ''}
                    onChange={(e) => set(c.name, { text: e.target.value })} />
                  <div className="flex shrink-0 rounded-lg overflow-hidden border border-line">
                    {(['value', 'null', 'default'] as Mode[]).filter((m) => (m !== 'null' || c.nullable) && (m !== 'default' || !req)).map((m) => (
                      <button key={m} onClick={() => set(c.name, { mode: m })}
                        className={`px-2 text-xs ${f.mode === m ? 'bg-accent-soft text-accent' : 'text-dim hover:text-fg'}`}>{m === 'value' ? 'Value' : m === 'null' ? 'NULL' : 'Default'}</button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-line">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || missing.length > 0} title={missing.length ? `Required: ${missing.map((c) => c.name).join(', ')}` : ''} onClick={submit}>Insert</button>
        </div>
      </div>
    </div>
  )
}
