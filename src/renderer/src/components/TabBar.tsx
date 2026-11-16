import { useState, type DragEvent } from 'react'
import { FileCode2, Network, Shapes, Table2, Users, X } from 'lucide-react'
import { parseConnectionKey } from '@shared/types'
import { useStore, type Tab } from '@/lib/store'
import { dropIndex, type DropSide } from '@/lib/reorder'

const icon = { table: Table2, query: FileCode2, diagram: Network, roles: Users, types: Shapes }
const MIDDLE_BUTTON = 1

/** Where the dragged tab would land if released now. */
interface DropHint {
  targetId: string
  side: DropSide
}

/** Strip of open tabs above the main view; tabs can be reordered by drag and drop. */
export function TabBar() {
  const { tabs, activeTab, setActive, closeTab, moveTab } = useStore()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<DropHint | null>(null)

  const endDrag = () => { setDraggedId(null); setDropHint(null) }

  const dropOn = (targetId: string, side: DropSide) => {
    const fromIndex = tabs.findIndex((t) => t.id === draggedId)
    const targetIndex = tabs.findIndex((t) => t.id === targetId)
    if (draggedId && fromIndex !== -1 && targetIndex !== -1) moveTab(draggedId, dropIndex(fromIndex, targetIndex, side))
    endDrag()
  }

  return (
    <div className="flex h-12 items-end border-b border-line bg-panel overflow-x-auto">
      {tabs.map((t) => (
        <TabItem key={t.id} tab={t} isActive={t.id === activeTab} isDragged={t.id === draggedId}
          dropSide={draggedId && draggedId !== t.id && dropHint?.targetId === t.id ? dropHint.side : null}
          onActivate={() => setActive(t.id)} onClose={() => closeTab(t.id)}
          onDragStart={() => setDraggedId(t.id)} onDragEnd={endDrag}
          onDragOverSide={(side) => setDropHint({ targetId: t.id, side })} onDropSide={(side) => dropOn(t.id, side)} />
      ))}
    </div>
  )
}

interface TabItemProps {
  tab: Tab
  isActive: boolean
  isDragged: boolean
  /** Side where the dragged tab would be inserted, `null` when it is not hovering this tab. */
  dropSide: DropSide | null
  onActivate(): void
  onClose(): void
  onDragStart(): void
  onDragEnd(): void
  onDragOverSide(side: DropSide): void
  onDropSide(side: DropSide): void
}

/** Left or right half of the tab under the pointer. */
function sideOf(e: DragEvent<HTMLElement>): DropSide {
  const rect = e.currentTarget.getBoundingClientRect()
  return e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
}

const DROP_INDICATOR: Record<DropSide, string> = {
  before: 'shadow-[inset_2px_0_0_var(--color-accent)]',
  after: 'shadow-[inset_-2px_0_0_var(--color-accent)]',
}

function TabItem({ tab, isActive, isDragged, dropSide, onActivate, onClose, onDragStart, onDragEnd, onDragOverSide, onDropSide }: TabItemProps) {
  const connections = useStore((s) => s.connections)
  const Icon = icon[tab.kind]
  const { connId, database } = parseConnectionKey(tab.connId)
  const conn = connections.find((c) => c.id === connId)
  return (
    <div onClick={onActivate} draggable
      // Middle-click closes the tab, as in browsers; preventing mousedown stops the autoscroll cursor.
      onMouseDown={(e) => { if (e.button === MIDDLE_BUTTON) e.preventDefault() }}
      onAuxClick={(e) => { if (e.button === MIDDLE_BUTTON) onClose() }}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOverSide(sideOf(e)) }}
      onDrop={(e) => { e.preventDefault(); onDropSide(sideOf(e)) }}
      className={`group flex items-center gap-2 h-10 px-3 cursor-pointer border-t-2 whitespace-nowrap ${isActive ? 'bg-bg border-accent text-fg' : 'border-transparent text-dim hover:text-fg'} ${isDragged ? 'opacity-50' : ''} ${dropSide ? DROP_INDICATOR[dropSide] : ''}`}>
      <Icon size={13} /> {tab.title}{tab.kind === 'query' && tab.sql !== tab.savedSql && <span className="text-accent" title="Unsaved changes">●</span>}
      <span className="text-[10px] text-dim">{conn?.name}{database && ` · ${database}`}</span>
      <button className="btn ghost !p-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onClose() }}><X size={12} /></button>
    </div>
  )
}
