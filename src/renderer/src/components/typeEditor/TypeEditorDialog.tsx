import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { TypeAlteration, TypeInfo } from '@shared/types'
import { buildAlterTypeStatements } from '@shared/typeAlterations'
import { errMessage } from '@/lib/store'
import { createTypeDraft, diffTypeDraft, validateTypeDraft, type TypeDraft } from '@/lib/typeDraft'
import { AttributesEditor } from './AttributesEditor'
import { DomainEditor } from './DomainEditor'
import { EnumLabelsEditor } from './EnumLabelsEditor'
import type { DraftSectionProps } from './draftProps'

/** Kind-specific part of the editor; ranges only have the common fields. */
function KindSection({ type, ...props }: DraftSectionProps & { type: TypeInfo }) {
  switch (type.kind) {
    case 'enum': return <EnumLabelsEditor {...props} />
    case 'composite': return <AttributesEditor {...props} />
    case 'domain': return <DomainEditor {...props} />
    case 'range': return null
  }
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange(v: string): void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block mb-1 font-medium">{label}</span>
      <input className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/**
 * Modal editing a user-defined type. Shows the SQL it will run and applies it
 * in one transaction; the dialog stays open on failure so the user can fix it.
 */
export function TypeEditorDialog({ type, onApply, onClose }: {
  type: TypeInfo
  onApply(alterations: TypeAlteration[]): Promise<void>
  onClose(): void
}) {
  const [draft, setDraft] = useState<TypeDraft>(() => createTypeDraft(type))
  const [isBusy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problems = validateTypeDraft(type, draft)
  const alterations = useMemo(() => (problems.length ? [] : diffTypeDraft(type, draft)), [type, draft, problems.length])
  const statements = buildAlterTypeStatements(type, alterations)
  const change = (patch: Partial<TypeDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const apply = async () => {
    setBusy(true); setError(null)
    try { await onApply(alterations); onClose() } catch (e) { setError(errMessage(e)) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50" onMouseDown={onClose}>
      <div className="w-[600px] max-h-[85vh] flex flex-col bg-panel border border-line rounded-xl shadow-2xl" onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-base font-semibold">Edit {type.kind} · {type.schema}.{type.name}</h2>
          <button className="btn ghost !p-1" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-auto">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Name" value={draft.name} onChange={(name) => change({ name })} />
            <TextField label="Owner" value={draft.owner} onChange={(owner) => change({ owner })} />
          </div>
          <TextField label="Comment" value={draft.comment} placeholder="no comment" onChange={(comment) => change({ comment })} />
          <KindSection type={type} draft={draft} onChange={change} />
          <section>
            <h3 className="font-medium mb-1">SQL</h3>
            <pre className="field font-mono text-xs whitespace-pre-wrap min-h-10">{statements.length ? statements.join('\n') : <span className="text-dim">No changes</span>}</pre>
          </section>
          {[...problems, ...(error ? [error] : [])].map((p) => <div key={p} className="text-danger text-xs">{p}</div>)}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-line">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={isBusy || !statements.length} onClick={apply}>Apply</button>
        </div>
      </div>
    </div>
  )
}
