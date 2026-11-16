import { useEffect, useState, type RefObject } from 'react'

/** Size of an element in pixels. */
export interface ElementSize {
  width: number
  height: number
}

/**
 * Tracks the rendered size of an element, updated whenever it is resized.
 *
 * @param ref - Element to observe; its size reads as zero until it is mounted.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}
