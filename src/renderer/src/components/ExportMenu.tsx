import { useState } from 'react'
import { Download } from 'lucide-react'
import type { ExportFormat, ExportOutcome } from '@shared/types'
import { errMessage, useStore } from '@/lib/store'

export function ExportMenu({ run, disabled }: { run(format: ExportFormat): Promise<ExportOutcome | null>; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const setError = useStore((s) => s.setError)

  const go = async (f: ExportFormat) => {
    setOpen(false)
    try {
      const r = await run(f)
      if (r) { setNote(`Exported ${r.count.toLocaleString()} rows`); setTimeout(() => setNote(null), 4000) }
    } catch (e) { setError(errMessage(e)) }
  }

  return (
    <div className="relative">
      <button className="btn" disabled={disabled} onClick={() => setOpen(!open)}><Download size={14} /> {note ?? 'Export'}</button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 w-32 bg-raised border border-line rounded-lg shadow-xl p-1">
            {(['csv', 'json'] as ExportFormat[]).map((f) => (
              <button key={f} className="w-full text-left px-3 py-1.5 rounded-md hover:bg-accent-soft uppercase text-xs" onClick={() => go(f)}>{f}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
