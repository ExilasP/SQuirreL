import { useEffect, useState } from 'react'
import { FileCode2, Network, Table2, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useGlobalShortcuts } from '@/lib/useGlobalShortcuts'
import { Sidebar } from '@/components/Sidebar'
import { QuickOpen } from '@/components/QuickOpen'
import { Welcome } from '@/components/Welcome'
import { TableView } from '@/views/TableView'
import { QueryView } from '@/views/QueryView'
import { DiagramView } from '@/views/DiagramView'

const icon = { table: Table2, query: FileCode2, diagram: Network }

export function App() {
  const { tabs, activeTab, setActive, closeTab, init, error, setError, connections } = useStore()
  useEffect(() => { init() }, [init])
  useEffect(() => { if (!error) return; const t = setTimeout(() => setError(null), 8000); return () => clearTimeout(t) }, [error, setError])
  const active = tabs.find((t) => t.id === activeTab)
  const [isQuickOpenVisible, setQuickOpenVisible] = useState(false)
  useGlobalShortcuts({ onQuickOpen: () => setQuickOpenVisible(true) })

  return (
    <div className="h-full flex">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex h-12 items-end border-b border-line bg-panel overflow-x-auto">
          {tabs.map((t) => {
            const Icon = icon[t.kind]; const conn = connections.find((c) => c.id === t.connId)
            return (
              <div key={t.id} onClick={() => setActive(t.id)}
                className={`group flex items-center gap-2 h-10 px-3 cursor-pointer border-t-2 whitespace-nowrap ${t.id === activeTab ? 'bg-bg border-accent text-fg' : 'border-transparent text-dim hover:text-fg'}`}>
                <Icon size={13} /> {t.title}{t.kind === 'query' && t.sql !== t.savedSql && <span className="text-accent" title="Unsaved changes">●</span>}
                <span className="text-[10px] text-dim">{conn?.name}</span>
                <button className="btn ghost !p-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); closeTab(t.id) }}><X size={12} /></button>
              </div>
            )
          })}
        </div>
        <div className="flex-1 min-h-0 relative">
          {tabs.map((t) => (
            <div key={t.id} className={`absolute inset-0 ${t.id === activeTab ? '' : 'hidden'}`}>
              {t.kind === 'table' && <TableView tab={t} />}
              {t.kind === 'query' && <QueryView tab={t} />}
              {t.kind === 'diagram' && <DiagramView tab={t} />}
            </div>
          ))}
          {!active && <Welcome />}
        </div>
      </main>
      {isQuickOpenVisible && <QuickOpen onClose={() => setQuickOpenVisible(false)} />}
      {error && (
        <div className="fixed bottom-4 right-4 max-w-md bg-raised border border-danger/50 text-danger rounded-lg px-4 py-3 shadow-xl flex gap-3">
          <span className="break-words">{error}</span><button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}
    </div>
  )
}
