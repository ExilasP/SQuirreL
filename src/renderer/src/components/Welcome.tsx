import { Database } from 'lucide-react'
import { SHORTCUTS, displayKeys } from '@/lib/shortcuts'

/** Empty-state screen listing the keyboard shortcuts. */
export function Welcome() {
  return (
    <div className="h-full grid place-items-center text-dim">
      <div className="w-[380px]">
        <Database size={36} className="mx-auto mb-4 opacity-40" />
        <h2 className="text-center text-fg font-semibold mb-4">Keyboard shortcuts</h2>
        <ul className="space-y-2">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-4">
              <span>{s.label}</span>
              <span className="flex gap-1">
                {displayKeys(s.keys).map((part) => (
                  <kbd key={part} className="px-1.5 py-0.5 rounded border border-line bg-raised text-fg text-xs font-mono">{part}</kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
