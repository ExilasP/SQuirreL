import { useEffect, useRef, useState, type DragEvent } from 'react'
import { FileCode2, Network, Shapes, Table2, Users, X } from 'lucide-react'
import { parseConnectionKey } from '@shared/types'
import { useStore, type Tab } from '@/lib/store'
import { dropIndex, type DropSide } from '@/lib/reorder'
import { useTabDrag } from '@/lib/useTabDrag'
import { HorizontalScroller } from './HorizontalScroller'
import type { PaneIndex } from '@/lib/panes'

const icon = { table: Table2, query: FileCode2, diagram: Network, roles: Users, types: Shapes }
const MIDDLE_BUTTON = 1

/** Where the dragged tab would land if released now. */
interface DropHint {
  targetId: string
  side: DropSide
}

/** Props of {@link TabBar}. */
export interface TabBarProps {
  pane: PaneIndex
  /** Whether this pane receives keyboard shortcuts and new tabs; only then is its active tab highlighted. */
  isFocused: boolean
}

/** Tab strip of one pane; tabs can be reordered, or dragged into the other pane's strip. */
export function TabBar({ pane, isFocused }: TabBarProps) {
  const { tabs, layout, setActive, closeTab, moveTab } = useStore()
  const { draggedTabId, setDraggedTabId } = useTabDrag()
  const [dropHint, setDropHint] = useState<DropHint | null>(null)
  const { tabIds, activeTabId } = layout.panes[pane]
  const paneTabs = tabIds.map((id) => tabs.find((t) => t.id === id)).filter((t): t is Tab => !!t)

  const endDrag = () => { setDraggedTabId(null); setDropHint(null) }
  // A drag ending in another strip or pane must not leave a stale indicator here.
  useEffect(() => { if (!draggedTabId) setDropHint(null) }, [draggedTabId])

  const dropOn = (targetId: string, side: DropSide) => {
    const targetIndex = tabIds.indexOf(targetId)
    if (!draggedTabId || targetIndex === -1) return endDrag()
    const fromIndex = tabIds.indexOf(draggedTabId)
    // A tab coming from the other pane is inserted, nothing shifts in this strip.
    const position = fromIndex === -1 ? targetIndex + (side === 'after' ? 1 : 0) : dropIndex(fromIndex, targetIndex, side)
    moveTab(draggedTabId, pane, position)
    endDrag()
  }

  // Dropping past the last tab appends to this pane.
  const dropAtEnd = (e: DragEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget || !draggedTabId) return
    e.preventDefault()
    moveTab(draggedTabId, pane, tabIds.includes(draggedTabId) ? tabIds.length - 1 : tabIds.length)
    endDrag()
  }

  return (
    <HorizontalScroller className="h-12 items-end border-b border-line bg-panel"
      onDragOver={(e) => { if (draggedTabId) e.preventDefault() }} onDrop={dropAtEnd} onDragLeave={(e) => { if (e.target === e.currentTarget) setDropHint(null) }}>
      {paneTabs.map((t) => (
        <TabItem key={t.id} tab={t} isActive={t.id === activeTabId} isFocused={isFocused} isDragged={t.id === draggedTabId}
          dropSide={draggedTabId && draggedTabId !== t.id && dropHint?.targetId === t.id ? dropHint.side : null}
          onActivate={() => setActive(t.id)} onClose={() => closeTab(t.id)}
          onDragStart={() => setDraggedTabId(t.id)} onDragEnd={endDrag}
          onDragOverSide={(side) => setDropHint({ targetId: t.id, side })} onDropSide={(side) => dropOn(t.id, side)} />
      ))}
    </HorizontalScroller>
  )
}

interface TabItemProps {
  tab: Tab
  isActive: boolean
  isFocused: boolean
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

function TabItem({ tab, isActive, isFocused, isDragged, dropSide, onActivate, onClose, onDragStart, onDragEnd, onDragOverSide, onDropSide }: TabItemProps) {
  const connections = useStore((s) => s.connections)
  const Icon = icon[tab.kind]
  const { connId, database } = parseConnectionKey(tab.connId)
  const conn = connections.find((c) => c.id === connId)
  const tabRef = useRef<HTMLDivElement>(null)
  // With no scrollbar, a tab opened or activated off-screen must be brought into view.
  useEffect(() => { if (isActive) tabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [isActive])
  return (
    <div ref={tabRef} onClick={onActivate} draggable
      // Middle-click closes the tab, as in browsers; preventing mousedown stops the autoscroll cursor.
      onMouseDown={(e) => { if (e.button === MIDDLE_BUTTON) e.preventDefault() }}
      onAuxClick={(e) => { if (e.button === MIDDLE_BUTTON) onClose() }}
      onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; onDragOverSide(sideOf(e)) }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropSide(sideOf(e)) }}
      className={`group shrink-0 flex items-center gap-2 h-10 px-3 cursor-pointer border-t-2 whitespace-nowrap ${isActive ? `bg-bg text-fg ${isFocused ? 'border-accent' : 'border-line'}` : 'border-transparent text-dim hover:text-fg'} ${isDragged ? 'opacity-50' : ''} ${dropSide ? DROP_INDICATOR[dropSide] : ''}`}>
      <Icon size={13} /> {tab.title}{tab.kind === 'query' && tab.sql !== tab.savedSql && <span className="text-accent" title="Unsaved changes">●</span>}
      <span className="text-[10px] text-dim">{conn?.name}{database && ` · ${database}`}</span>
      <button className="btn ghost !p-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onClose() }}><X size={12} /></button>
    </div>
  )
}
