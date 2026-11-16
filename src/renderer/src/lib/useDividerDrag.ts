import { useCallback, useState } from 'react'
import { moveBoundary } from './panes'
import { minPaneSizePx } from './paneSizeLimits'
import { useStore } from './store'
import type { Divider } from './paneGeometry'
import type { ElementSize } from './useElementSize'
import type { ResizeHandleProps } from './useResizable'

/**
 * Lets a divider between two panes be dragged to resize them; double-click evens out the split.
 *
 * @param divider - Boundary being dragged.
 * @param workspaceSize - Workspace size in pixels, to convert the drag into shares of the split.
 * @returns Props for the `ResizeHandle` drawn on the divider.
 */
export function useDividerDrag(divider: Divider, workspaceSize: ElementSize): ResizeHandleProps {
  const resizeSplit = useStore((s) => s.resizeSplit)
  const equalizeSplit = useStore((s) => s.equalizeSplit)
  const [isDragging, setDragging] = useState(false)
  const axis = divider.direction === 'row' ? 'x' : 'y'

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    const pointerOf = (e: { clientX: number; clientY: number }) => (axis === 'x' ? e.clientX : e.clientY)
    const startPointer = pointerOf(event)
    const splitPx = axis === 'x' ? divider.splitRect.width * workspaceSize.width : divider.splitRect.height * workspaceSize.height
    const minPx = axis === 'x' ? minPaneSizePx().width : minPaneSizePx().height
    if (splitPx <= 0) return
    handle.setPointerCapture(event.pointerId)
    setDragging(true)

    const onMove = (move: PointerEvent) => {
      const delta = (pointerOf(move) - startPointer) / splitPx
      resizeSplit(divider.splitId, moveBoundary(divider.sizes, divider.boundary, delta, minPx / splitPx))
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      setDragging(false)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }, [axis, divider, workspaceSize, resizeSplit])

  const onDoubleClick = useCallback(() => equalizeSplit(divider.splitId), [equalizeSplit, divider.splitId])

  return { axis, isDragging, onPointerDown, onDoubleClick }
}
