import { Plus, Trash2 } from 'lucide-react'
import type { AttributeDraft } from '@/lib/typeDraft'
import { newEntryKey, type DraftSectionProps } from './draftProps'

/** Fields of a composite type. New attributes always go last: PostgreSQL cannot reorder them. */
export function AttributesEditor({ draft, onChange }: DraftSectionProps) {
  const attributes = draft.attributes
  const setAttributes = (next: AttributeDraft[]) => onChange({ attributes: next })
  const update = (key: string, patch: Partial<AttributeDraft>) =>
    setAttributes(attributes.map((a) => (a.key === key ? { ...a, ...patch } : a)))
  const add = () => setAttributes([...attributes, { key: newEntryKey(), original: null, name: '', type: 'text' }])
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Attributes</h3>
        <button className="btn ghost !p-1" title="Add an attribute" onClick={add}><Plus size={14} /></button>
      </div>
      {attributes.map((attribute) => (
        <div key={attribute.key} className="flex items-center gap-1">
          <input className="field" value={attribute.name} placeholder="name" autoFocus={attribute.original === null}
            onChange={(e) => update(attribute.key, { name: e.target.value })} />
          <input className="field font-mono" value={attribute.type} placeholder="type"
            onChange={(e) => update(attribute.key, { type: e.target.value })} />
          <button className="btn ghost danger !p-1" title="Drop"
            onClick={() => setAttributes(attributes.filter((a) => a.key !== attribute.key))}><Trash2 size={14} /></button>
        </div>
      ))}
      {!attributes.length && <div className="text-dim text-xs">No attributes.</div>}
    </section>
  )
}
