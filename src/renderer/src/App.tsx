import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useGlobalShortcuts } from '@/lib/useGlobalShortcuts'
import { Sidebar } from '@/components/Sidebar'
import { TabBar } from '@/components/TabBar'
import { QuickOpen } from '@/components/QuickOpen'
import { Welcome } from '@/components/Welcome'
import { TableView } from '@/views/TableView'
import { QueryView } from '@/views/QueryView'
import { DiagramView } from '@/views/DiagramView'
import { RolesView } from '@/views/RolesView'
import { TypesView } from '@/views/TypesView'

export function App() {
  const { tabs, activeTab, init, error, setError } = useStore()
  useEffect(() => { init() }, [init])
  useEffect(() => { if (!error) return; const t = setTimeout(() => setError(null), 8000); return () => clearTimeout(t) }, [error, setError])
  const active = tabs.find((t) => t.id === activeTab)
  const [isQuickOpenVisible, setQuickOpenVisible] = useState(false)
  useGlobalShortcuts({ onQuickOpen: () => setQuickOpenVisible(true) })

  return (
    <div className="h-full flex">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <TabBar />
        <div className="flex-1 min-h-0 relative">
          {tabs.map((t) => (
            <div key={t.id} className={`absolute inset-0 ${t.id === activeTab ? '' : 'hidden'}`}>
              {t.kind === 'table' && <TableView tab={t} />}
              {t.kind === 'query' && <QueryView tab={t} />}
              {t.kind === 'diagram' && <DiagramView tab={t} />}
              {t.kind === 'roles' && <RolesView tab={t} />}
              {t.kind === 'types' && <TypesView tab={t} />}
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
