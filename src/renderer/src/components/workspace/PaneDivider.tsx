import type { CSSProperties } from 'react'
import type { Divider } from '@/lib/paneGeometry'
import type { ElementSize } from '@/lib/useElementSize'
import { useDividerDrag } from '@/lib/useDividerDrag'
import { ResizeHandle } from '../ResizeHandle'
import { percent } from './rectStyle'

/** Line drawn along a divider; the resize handle is centred on it. */
function lineStyle({ direction, offset, splitRect }: Divider): CSSProperties {
  return direction === 'row'
    ? { left: percent(offset), top: percent(splitRect.y), height: percent(splitRect.height) }
    : { top: percent(offset), left: percent(splitRect.x), width: percent(splitRect.width) }
}

/** Props of {@link PaneDivider}. */
export interface PaneDividerProps {
  divider: Divider
  workspaceSize: ElementSize
}

/** Boundary between two neighbouring panes, draggable to resize them. */
export function PaneDivider({ divider, workspaceSize }: PaneDividerProps) {
  const handleProps = useDividerDrag(divider, workspaceSize)
  const thickness = divider.direction === 'row' ? 'w-px' : 'h-px'
  return (
    <div className={`absolute z-20 bg-line ${thickness}`} style={lineStyle(divider)}>
      <ResizeHandle {...handleProps} />
    </div>
  )
}
