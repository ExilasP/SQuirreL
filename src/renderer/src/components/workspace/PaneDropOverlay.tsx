import { useState, type DragEvent } from 'react'
import { canSplitWith, findPane, paneOf } from '@/lib/panes'
import { dropPreviewRect, dropTargetAt, type PaneDropTarget } from '@/lib/paneDrop'
import { minPaneSizePx, remToPx } from '@/lib/paneSizeLimits'
import type { Rect } from '@/lib/paneGeometry'
import { useStore } from '@/lib/store'
import { useTabDrag } from '@/lib/useTabDrag'
import { rectStyle, TAB_STRIP_HEIGHT, TAB_STRIP_HEIGHT_REM } from './rectStyle'

/** Props of {@link PaneDropOverlay}. */
export interface PaneDropOverlayProps {
  paneId: string
  rect: Rect
}

/**
 * Drop target covering a pane's view while a tab is dragged: an edge splits the pane, the
 * middle moves the tab into it. It sits above the view so editors do not swallow the drag.
 */
export function PaneDropOverlay({ paneId, rect }: PaneDropOverlayProps) {
  const { layout, splitTab, moveTab } = useStore()
  const { draggedTabId, setDraggedTabId } = useTabDrag()
  const [target, setTarget] = useState<PaneDropTarget | null>(null)
  if (!draggedTabId) return null

  // Joining the pane the tab already belongs to would do nothing, so it is not a target.
  const isUseful = (candidate: PaneDropTarget) => candidate.kind === 'edge' || paneOf(layout, draggedTabId)?.id !== paneId

  const targetAt = (e: DragEvent<HTMLElement>): PaneDropTarget => {
    const bounds = e.currentTarget.getBoundingClientRect()
    const min = minPaneSizePx()
    return dropTargetAt({
      x: (e.clientX - bounds.left) / bounds.width, y: (e.clientY - bounds.top) / bounds.height,
      // The overlay stops below the tab strip, but a split halves the whole pane, strip included.
      widthPx: bounds.width, heightPx: bounds.height + remToPx(TAB_STRIP_HEIGHT_REM),
      minWidthPx: min.width, minHeightPx: min.height,
      canSplit: canSplitWith(layout, draggedTabId, paneId),
    })
  }

  const onDragOver = (e: DragEvent<HTMLElement>) => {
    const candidate = targetAt(e)
    if (!isUseful(candidate)) return setTarget(null)
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setTarget(candidate)
  }

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    const candidate = targetAt(e)
    if (candidate.kind === 'edge') splitTab(draggedTabId, paneId, candidate.edge)
    else moveTab(draggedTabId, paneId, findPane(layout, paneId)?.tabIds.length ?? 0)
    setTarget(null)
    setDraggedTabId(null)
  }

  return (
    <div className="absolute z-30" style={rectStyle(rect, TAB_STRIP_HEIGHT)} onDragOver={onDragOver} onDragLeave={() => setTarget(null)} onDrop={onDrop}>
      {target && (
        <div className="pointer-events-none absolute p-1 transition-all" style={rectStyle(dropPreviewRect(target))}>
          <div className="h-full rounded-lg border-2 border-dashed border-accent bg-accent-soft" />
        </div>
      )}
    </div>
  )
}
