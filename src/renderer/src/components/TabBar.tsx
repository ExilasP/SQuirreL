import { FileCode2, Network, Shapes, Table2, Users, X } from 'lucide-react'
import { parseConnectionKey } from '@shared/types'
import { useStore, type Tab } from '@/lib/store'

const icon = { table: Table2, query: FileCode2, diagram: Network, roles: Users, types: Shapes }

/** Strip of open tabs above the main view. */
export function TabBar() {
  const { tabs, activeTab, setActive, closeTab } = useStore()
  return (
    <div className="flex h-12 items-end border-b border-line bg-panel overflow-x-auto">
      {tabs.map((t) => (
        <TabItem key={t.id} tab={t} isActive={t.id === activeTab} onActivate={() => setActive(t.id)} onClose={() => closeTab(t.id)} />
      ))}
    </div>
  )
}

interface TabItemProps {
  tab: Tab
  isActive: boolean
  onActivate(): void
  onClose(): void
}

function TabItem({ tab, isActive, onActivate, onClose }: TabItemProps) {
  const connections = useStore((s) => s.connections)
  const Icon = icon[tab.kind]
  const { connId, database } = parseConnectionKey(tab.connId)
  const conn = connections.find((c) => c.id === connId)
  return (
    <div onClick={onActivate}
      className={`group flex items-center gap-2 h-10 px-3 cursor-pointer border-t-2 whitespace-nowrap ${isActive ? 'bg-bg border-accent text-fg' : 'border-transparent text-dim hover:text-fg'}`}>
      <Icon size={13} /> {tab.title}{tab.kind === 'query' && tab.sql !== tab.savedSql && <span className="text-accent" title="Unsaved changes">●</span>}
      <span className="text-[10px] text-dim">{conn?.name}{database && ` · ${database}`}</span>
      <button className="btn ghost !p-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onClose() }}><X size={12} /></button>
    </div>
  )
}
