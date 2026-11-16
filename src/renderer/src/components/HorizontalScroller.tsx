import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/** Props of {@link HorizontalScroller}. */
export interface HorizontalScrollerProps {
  /** Classes of the scrolling row itself (height, alignment, gap, padding). */
  className?: string
  children: ReactNode
}

/** Which sides still hide content. */
interface Overflow {
  hasLeft: boolean
  hasRight: boolean
}

/**
 * Single row that scrolls horizontally without a scrollbar, fading its edges where content is hidden.
 *
 * The vertical mouse wheel scrolls it sideways, since there is no scrollbar left to drag.
 */
export function HorizontalScroller({ className = '', children }: HorizontalScrollerProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState<Overflow>({ hasLeft: false, hasRight: false })

  const measure = useCallback(() => {
    const row = rowRef.current
    if (!row) return
    // One pixel of slack absorbs fractional scroll positions on scaled displays.
    const hasLeft = row.scrollLeft > 1
    const hasRight = row.scrollLeft + row.clientWidth < row.scrollWidth - 1
    setOverflow((o) => (o.hasLeft === hasLeft && o.hasRight === hasRight ? o : { hasLeft, hasRight }))
  }, [])

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    measure()
    // Content changes (counts loading, panes hidden for views) resize the children, not the row.
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    Array.from(row.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [measure, children])

  const scrollWithWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY
  }

  return (
    <div className="relative min-w-0">
      <div ref={rowRef} className={`flex overflow-x-auto no-scrollbar ${className}`} onScroll={measure} onWheel={scrollWithWheel}>
        {children}
      </div>
      <EdgeShadow side="left" isVisible={overflow.hasLeft} />
      <EdgeShadow side="right" isVisible={overflow.hasRight} />
    </div>
  )
}

function EdgeShadow({ side, isVisible }: { side: 'left' | 'right'; isVisible: boolean }) {
  const placement = side === 'left' ? 'left-0 bg-gradient-to-r' : 'right-0 bg-gradient-to-l'
  return <div aria-hidden className={`pointer-events-none absolute inset-y-0 w-8 from-black/60 to-transparent transition-opacity ${placement} ${isVisible ? 'opacity-100' : 'opacity-0'}`} />
}
