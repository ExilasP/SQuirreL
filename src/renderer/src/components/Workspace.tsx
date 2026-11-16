import { useRef, useState, type CSSProperties } from 'react'
import { useStore, type Tab } from '@/lib/store'
import { paneOf, type Layout, type PaneIndex, type SplitSide } from '@/lib/panes'
import { useResizable } from '@/lib/useResizable'
import { useTabDrag } from '@/lib/useTabDrag'
import { TableView } from '@/views/TableView'
import { QueryView } from '@/views/QueryView'
import { DiagramView } from '@/views/DiagramView'
import { RolesView } from '@/views/RolesView'
import { TypesView } from '@/views/TypesView'
import { TabBar } from './TabBar'
import { Welcome } from './Welcome'
import { ResizeHandle } from './ResizeHandle'

/** Narrowest a pane may get, so its tab strip and toolbar stay usable. */
const MIN_PANE_WIDTH = 240

// Width of the left pane, as a CSS length clamped to the workspace (100% resolves against it).
const splitPosition = (leftWidth: number) => `min(${leftWidth}px, calc(100% - ${MIN_PANE_WIDTH}px))`

/** Horizontal extent of a pane inside the workspace. */
function paneBox(layout: Layout, pane: PaneIndex): CSSProperties {
  if (layout.panes.length === 1) return { left: 0, right: 0 }
  return pane === 0 ? { left: 0, width: 'var(--split)' } : { left: 'var(--split)', right: 0 }
}

/**
 * Tab strips and views of the open tabs, in one pane or two side by side.
 *
 * Every view stays mounted in a single layer and is only positioned over its pane,
 * so moving a tab to the other pane keeps its state (query results, scroll, edits).
 */
export function Workspace() {
  const { tabs, layout, focusPane } = useStore()
  const isSplit = layout.panes.length === 2
  const workspaceRef = useRef<HTMLDivElement>(null)
  const { size: leftWidth, handleProps } = useResizable({
    storageKey: 'squirrel.splitWidth', axis: 'x', initialSize: 600, minSize: MIN_PANE_WIDTH,
    maxSize: () => (workspaceRef.current?.clientWidth ?? window.innerWidth) - MIN_PANE_WIDTH,
  })

  return (
    <div ref={workspaceRef} className="flex-1 min-w-0 flex flex-col" style={{ '--split': splitPosition(leftWidth) } as CSSProperties}>
      <div className="flex">
        {layout.panes.map((_, i) => {
          const pane = i as PaneIndex
          return (
            <div key={pane} className={`min-w-0 ${isSplit && pane === 0 ? 'shrink-0 border-r border-line' : 'flex-1'}`} style={isSplit && pane === 0 ? { width: 'var(--split)' } : undefined}>
              <TabBar pane={pane} isFocused={!isSplit || layout.focusedPane === pane} />
            </div>
          )
        })}
      </div>
      <div className="flex-1 min-h-0 relative">
        {tabs.map((t) => {
          const pane = paneOf(layout, t.id)
          if (pane === -1) return null
          const isVisible = layout.panes[pane].activeTabId === t.id
          return (
            <div key={t.id} className={`absolute inset-y-0 ${isVisible ? '' : 'hidden'}`} style={paneBox(layout, pane)} onMouseDownCapture={() => focusPane(pane)}>
              <TabContent tab={t} />
            </div>
          )
        })}
        {isSplit && (
          <div className="absolute inset-y-0 w-px bg-line" style={{ left: 'var(--split)' }}>
            <ResizeHandle {...handleProps} />
          </div>
        )}
        {tabs.length === 0 && <Welcome />}
        <SplitDropZones />
      </div>
    </div>
  )
}

function TabContent({ tab }: { tab: Tab }) {
  switch (tab.kind) {
    case 'table': return <TableView tab={tab} />
    case 'query': return <QueryView tab={tab} />
    case 'diagram': return <DiagramView tab={tab} />
    case 'roles': return <RolesView tab={tab} />
    case 'types': return <TypesView tab={tab} />
  }
}

/** Area of the workspace a dragged tab can be dropped on, and what dropping does. */
interface DropZone {
  id: string
  style: CSSProperties
  drop(tabId: string): void
}

/** Drop targets for the dragged tab: split halves with a single pane, the other pane when split. */
function dropZonesFor(layout: Layout, draggedTabId: string, actions: { splitTab(id: string, side: SplitSide): void; moveTab(id: string, pane: PaneIndex, position: number): void }): DropZone[] {
  const source = paneOf(layout, draggedTabId)
  if (source === -1) return []
  if (layout.panes.length === 1) {
    // Splitting away a pane's only tab would leave the other side empty.
    if (layout.panes[0].tabIds.length < 2) return []
    return (['left', 'right'] as const).map((side) => ({
      id: side,
      style: side === 'left' ? { left: 0, width: '50%' } : { left: '50%', right: 0 },
      drop: (id) => actions.splitTab(id, side),
    }))
  }
  const target: PaneIndex = source === 0 ? 1 : 0
  return [{ id: `pane-${target}`, style: paneBox(layout, target), drop: (id) => actions.moveTab(id, target, layout.panes[target].tabIds.length) }]
}

/** Overlay shown while a tab is dragged; it sits above the views so editors do not swallow the drag. */
function SplitDropZones() {
  const { layout, splitTab, moveTab } = useStore()
  const { draggedTabId, setDraggedTabId } = useTabDrag()
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null)
  if (!draggedTabId) return null

  const zones = dropZonesFor(layout, draggedTabId, { splitTab, moveTab })
  return (
    <>
      {zones.map((zone) => (
        <div key={zone.id} className="absolute inset-y-0 z-30 p-1" style={zone.style}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setHoveredZoneId(zone.id) }}
          onDragLeave={() => setHoveredZoneId(null)}
          onDrop={(e) => { e.preventDefault(); zone.drop(draggedTabId); setHoveredZoneId(null); setDraggedTabId(null) }}>
          <div className={`pointer-events-none h-full rounded-lg border-2 border-dashed transition-colors ${hoveredZoneId === zone.id ? 'border-accent bg-accent-soft' : 'border-transparent'}`} />
        </div>
      ))}
    </>
  )
}
