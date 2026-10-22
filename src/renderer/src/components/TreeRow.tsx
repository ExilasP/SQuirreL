import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  /** Nesting level, 0 for the top of the tree. */
  depth: number
  icon: LucideIcon
  label: string
  /** `undefined` for a leaf, otherwise whether the node is currently unfolded. */
  isExpanded?: boolean
  /** Small dimmed number next to the label, e.g. a table count. */
  count?: number
  /** Dot shown before the label (connection status colour). */
  dotColor?: string
  tag?: string
  /** Buttons revealed on hover. */
  actions?: ReactNode
  onClick(): void
  onContextMenu?(e: React.MouseEvent): void
}

const INDENT_PX = 16

/** One row of the sidebar tree; connections, databases, schemas and tables all share it so they look alike. */
export function TreeRow({ depth, icon: Icon, label, isExpanded, count, dotColor, tag, actions, onClick, onContextMenu }: Props) {
  return (
    <div className="group flex items-center gap-2 h-8 pr-2 rounded-md hover:bg-raised cursor-pointer"
      style={{ paddingLeft: 8 + depth * INDENT_PX }} onClick={onClick} onContextMenu={onContextMenu}>
      <ChevronRight size={14} className={`shrink-0 text-dim transition-transform ${isExpanded ? 'rotate-90' : ''} ${isExpanded === undefined ? 'invisible' : ''}`} />
      {dotColor && <span className="size-2 rounded-full shrink-0" style={{ background: dotColor }} />}
      <Icon size={14} className="shrink-0 text-dim" />
      <span className="truncate">{label}</span>
      {count !== undefined && <span className="text-[10px] text-dim">{count}</span>}
      {tag && <span className="text-[10px] uppercase text-dim ml-1">{tag}</span>}
      {actions && <span className="ml-auto hidden group-hover:flex gap-0.5" onClick={(e) => e.stopPropagation()}>{actions}</span>}
    </div>
  )
}
