import { Plus, Trash2 } from 'lucide-react'
import type { CheckDraft } from '@/lib/typeDraft'
import { newEntryKey, type DraftSectionProps } from './draftProps'

/** Default, nullability and `CHECK` constraints of a domain. Existing checks can only be dropped. */
export function DomainEditor({ draft, onChange }: DraftSectionProps) {
  const checks = draft.checks
  const setChecks = (next: CheckDraft[]) => onChange({ checks: next })
  const add = () => setChecks([...checks, { key: newEntryKey(), original: null, definition: '' }])
  return (
    <section className="space-y-3">
      <label className="block">
        <span className="block mb-1 font-medium">Default</span>
        <input className="field font-mono" value={draft.defaultValue} placeholder="no default"
          onChange={(e) => onChange({ defaultValue: e.target.value })} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={draft.isNotNull} onChange={(e) => onChange({ isNotNull: e.target.checked })} />
        <span>NOT NULL</span>
      </label>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Checks</h3>
          <button className="btn ghost !p-1" title="Add a check" onClick={add}><Plus size={14} /></button>
        </div>
        {checks.map((check) => (
          <div key={check.key} className="flex items-center gap-1">
            {check.original !== null
              ? <div className="field font-mono text-dim truncate" title={`${check.original}: ${check.definition}`}>{check.definition}</div>
              : <input className="field font-mono" value={check.definition} placeholder="VALUE > 0" autoFocus
                onChange={(e) => setChecks(checks.map((c) => (c.key === check.key ? { ...c, definition: e.target.value } : c)))} />}
            <button className="btn ghost danger !p-1" title="Drop"
              onClick={() => setChecks(checks.filter((c) => c.key !== check.key))}><Trash2 size={14} /></button>
          </div>
        ))}
        {!checks.length && <div className="text-dim text-xs">No checks.</div>}
      </div>
    </section>
  )
}
