import { Plus, Trash2 } from 'lucide-react'
import type { EnumLabelDraft } from '@/lib/typeDraft'
import { insertAt, newEntryKey, type DraftSectionProps } from './draftProps'

const newLabel = (): EnumLabelDraft => ({ key: newEntryKey(), original: null, value: '' })

/**
 * Enum values in sort order. PostgreSQL can rename or insert values but never
 * drop or reorder existing ones, so only added values can be removed.
 */
export function EnumLabelsEditor({ draft, onChange }: DraftSectionProps) {
  const labels = draft.labels
  const setLabels = (next: EnumLabelDraft[]) => onChange({ labels: next })
  const insertButton = (index: number, title: string) => (
    <button className="btn ghost !p-1" title={title} onClick={() => setLabels(insertAt(labels, index, newLabel()))}><Plus size={14} /></button>
  )
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Values</h3>
        {insertButton(0, 'Insert a value at the start')}
      </div>
      {labels.map((label, i) => (
        <div key={label.key} className="flex items-center gap-1">
          <input className="field font-mono" value={label.value} placeholder="new value" autoFocus={label.original === null}
            onChange={(e) => setLabels(labels.map((l) => (l.key === label.key ? { ...l, value: e.target.value } : l)))} />
          {insertButton(i + 1, 'Insert a value after this one')}
          <button className="btn ghost danger !p-1" disabled={label.original !== null}
            title={label.original !== null ? 'PostgreSQL cannot drop an existing enum value' : 'Remove'}
            onClick={() => setLabels(labels.filter((l) => l.key !== label.key))}><Trash2 size={14} /></button>
        </div>
      ))}
      {!labels.length && <div className="text-dim text-xs">No values yet.</div>}
    </section>
  )
}
