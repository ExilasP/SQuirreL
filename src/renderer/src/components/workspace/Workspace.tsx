import { useRef } from 'react'
import { computeGeometry, type PaneBox } from '@/lib/paneGeometry'
import { paneOf } from '@/lib/panes'
import { useStore } from '@/lib/store'
import { useElementSize } from '@/lib/useElementSize'
import { Welcome } from '../Welcome'
import { PaneDivider } from './PaneDivider'
import { PaneDropOverlay } from './PaneDropOverlay'
import { TabBar } from './TabBar'
import { TabContent } from './TabContent'
import { rectStyle, TAB_STRIP_HEIGHT } from './rectStyle'

/**
 * Open tabs laid out as a tree of horizontal and vertical splits.
 *
 * Every view stays mounted in a single layer and is only positioned over its pane, so moving
 * a tab to another pane keeps its state (query results, scroll, edits).
 */
export function Workspace() {
  const { tabs, layout } = useStore()
  const workspaceRef = useRef<HTMLDivElement>(null)
  const workspaceSize = useElementSize(workspaceRef)
  const { panes, dividers } = computeGeometry(layout.root)
  const isSplit = panes.length > 1

  return (
    <div ref={workspaceRef} className="relative flex-1 min-w-0 overflow-hidden">
      {panes.map(({ pane, rect }) => (
        <div key={pane.id} className="absolute" style={{ ...rectStyle(rect), height: TAB_STRIP_HEIGHT }}>
          <TabBar paneId={pane.id} isFocused={!isSplit || layout.focusedPaneId === pane.id} />
        </div>
      ))}
      {tabs.map((tab) => {
        const box = panes.find((b) => b.pane.id === paneOf(layout, tab.id)?.id)
        return box && <TabView key={tab.id} tabId={tab.id} box={box} />
      })}
      {tabs.length === 0 && <div className="absolute inset-x-0 bottom-0" style={{ top: TAB_STRIP_HEIGHT }}><Welcome /></div>}
      {dividers.map((divider) => <PaneDivider key={`${divider.splitId}:${divider.boundary}`} divider={divider} workspaceSize={workspaceSize} />)}
      {panes.map(({ pane, rect }) => <PaneDropOverlay key={pane.id} paneId={pane.id} rect={rect} />)}
    </div>
  )
}

/** View of one tab, placed under its pane's tab strip and shown only while it is the pane's active tab. */
function TabView({ tabId, box }: { tabId: string; box: PaneBox }) {
  const tab = useStore((s) => s.tabs.find((t) => t.id === tabId))
  const focusPane = useStore((s) => s.focusPane)
  if (!tab) return null
  const isVisible = box.pane.activeTabId === tabId
  return (
    <div className={`absolute overflow-hidden ${isVisible ? '' : 'hidden'}`} style={rectStyle(box.rect, TAB_STRIP_HEIGHT)} onMouseDownCapture={() => focusPane(box.pane.id)}>
      <TabContent tab={tab} />
    </div>
  )
}
