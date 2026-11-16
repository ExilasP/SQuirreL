import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useGlobalShortcuts } from '@/lib/useGlobalShortcuts'
import { Sidebar } from '@/components/Sidebar'
import { QuickOpen } from '@/components/QuickOpen'
import { Workspace } from '@/components/workspace/Workspace'

export function App() {
  const { init, error, setError } = useStore()
  useEffect(() => { init() }, [init])
  useEffect(() => { if (!error) return; const t = setTimeout(() => setError(null), 8000); return () => clearTimeout(t) }, [error, setError])
  const [isQuickOpenVisible, setQuickOpenVisible] = useState(false)
  useGlobalShortcuts({ onQuickOpen: () => setQuickOpenVisible(true) })

  return (
    <div className="h-full flex">
      <Sidebar />
      <main className="flex-1 min-w-0 flex">
        <Workspace />
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
