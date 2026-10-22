import { useState } from 'react'

/** Small modal asking for a single name (Electron has no `window.prompt`). */
export function NameDialog({ title, initial = '', onSubmit, onClose }: {
  title: string
  initial?: string
  onSubmit: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial)
  const submit = () => { if (name.trim()) { onSubmit(name.trim()); onClose() } }
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50" onMouseDown={onClose}>
      <div className="w-[360px] bg-panel border border-line rounded-xl shadow-2xl p-5 space-y-4" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold">{title}</h2>
        <input className="field" autoFocus value={name} placeholder="Query name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }} />
        <div className="flex justify-end gap-2">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!name.trim()} onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  )
}
