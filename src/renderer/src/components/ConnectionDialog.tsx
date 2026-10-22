import { useState } from 'react'
import { FolderOpen, X } from 'lucide-react'
import type { ConnectionConfig, DriverId } from '@shared/types'
import { useStore } from '@/lib/store'

const COLORS = ['#7c8cff', '#4fd1a5', '#ffb86b', '#ff6b7a', '#c792ea', '#5ac8fa']

export function ConnectionDialog({ initial, onClose }: { initial?: ConnectionConfig; onClose(): void }) {
  const save = useStore((s) => s.saveConnection)
  const [c, setC] = useState<ConnectionConfig>(initial ?? { id: crypto.randomUUID(), name: '', driver: 'sqlite', color: COLORS[0], port: 5432, host: 'localhost' })
  const [status, setStatus] = useState<{ ok: boolean; error?: string } | null>(null)
  const set = (p: Partial<ConnectionConfig>) => { setC({ ...c, ...p }); setStatus(null) }
  const valid = c.driver === 'sqlite' ? !!c.file : !!c.host && !!c.database

  const Label = ({ t, children }: { t: string; children: React.ReactNode }) => (
    <label className="block"><span className="text-dim text-xs mb-1 block">{t}</span>{children}</label>
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50" onMouseDown={onClose}>
      <div className="w-[460px] bg-panel border border-line rounded-xl shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-base font-semibold">{initial ? 'Edit connection' : 'New connection'}</h2>
          <button className="btn ghost !p-1" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['sqlite', 'postgres'] as DriverId[]).map((d) => (
              <button key={d} onClick={() => set({ driver: d })}
                className={`btn justify-center ${c.driver === d ? '!border-accent !bg-accent-soft' : ''}`}>
                {d === 'sqlite' ? 'SQLite' : 'PostgreSQL'}
              </button>
            ))}
          </div>
          <Label t="Name"><input className="field" value={c.name} placeholder="My database" onChange={(e) => set({ name: e.target.value })} autoFocus /></Label>
          {c.driver === 'sqlite' ? (
            <Label t="Database file">
              <div className="flex gap-2">
                <input className="field" value={c.file ?? ''} placeholder="/path/to/db.sqlite" onChange={(e) => set({ file: e.target.value })} />
                <button className="btn" onClick={async () => { const f = await window.api.connections.pickFile(); if (f) set({ file: f, name: c.name || f.split(/[\\/]/).pop()! }) }}><FolderOpen size={14} /></button>
              </div>
            </Label>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_90px] gap-3">
                <Label t="Host"><input className="field" value={c.host ?? ''} onChange={(e) => set({ host: e.target.value })} /></Label>
                <Label t="Port"><input className="field" type="number" value={c.port ?? 5432} onChange={(e) => set({ port: +e.target.value })} /></Label>
              </div>
              <Label t="Database"><input className="field" value={c.database ?? ''} onChange={(e) => set({ database: e.target.value })} /></Label>
              <div className="grid grid-cols-2 gap-3">
                <Label t="User"><input className="field" value={c.user ?? ''} onChange={(e) => set({ user: e.target.value })} /></Label>
                <Label t="Password"><input className="field" type="password" value={c.password ?? ''} onChange={(e) => set({ password: e.target.value })} /></Label>
              </div>
              <label className="flex items-center gap-2 text-dim"><input type="checkbox" checked={!!c.ssl} onChange={(e) => set({ ssl: e.target.checked })} /> Use SSL</label>
            </>
          )}
          <div className="flex gap-2">
            {COLORS.map((col) => (
              <button key={col} onClick={() => set({ color: col })} className="size-5 rounded-full" style={{ background: col, outline: c.color === col ? `2px solid ${col}` : 'none', outlineOffset: 2 }} />
            ))}
          </div>
          {status && <div className={`text-xs ${status.ok ? 'text-ok' : 'text-danger'}`}>{status.ok ? 'Connection successful' : status.error}</div>}
        </div>
        <div className="flex justify-between px-5 py-4 border-t border-line">
          <button className="btn" disabled={!valid} onClick={async () => setStatus(await window.api.connections.test(c))}>Test</button>
          <div className="flex gap-2">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={!valid} onClick={async () => { await save({ ...c, name: c.name || c.file?.split(/[\\/]/).pop() || c.database || 'Untitled' }); onClose() }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
