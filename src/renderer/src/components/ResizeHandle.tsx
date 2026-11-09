import { useEffect } from 'react'
import type { ResizeHandleProps } from '@/lib/useResizable'

/**
 * Thin draggable separator between two panes; double-click restores the default size.
 *
 * Must be placed inside a `relative` container, on the edge of the pane it resizes.
 */
export function ResizeHandle({ axis, isDragging, onPointerDown, onDoubleClick }: ResizeHandleProps) {
  const cursor = axis === 'x' ? 'col-resize' : 'row-resize'
  // Keep the resize cursor while the pointer outruns the handle during a drag.
  useEffect(() => {
    if (!isDragging) return
    document.body.style.cursor = cursor
    return () => { document.body.style.cursor = '' }
  }, [isDragging, cursor])

  const placement = axis === 'x' ? 'top-0 bottom-0 -right-1 w-2 cursor-col-resize' : 'left-0 right-0 -bottom-1 h-2 cursor-row-resize'
  const line = axis === 'x' ? 'inset-y-0 left-1/2 w-0.5 -translate-x-1/2' : 'inset-x-0 top-1/2 h-0.5 -translate-y-1/2'
  return (
    <div role="separator" aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'} title="Drag to resize · double-click to reset"
      className={`group absolute z-20 touch-none ${placement}`} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
      <div className={`absolute ${line} transition-colors ${isDragging ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/60'}`} />
    </div>
  )
}
