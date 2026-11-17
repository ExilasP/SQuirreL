import { useCallback, useEffect, useRef, useState } from 'react'

/** Direction in which a pane is resized: `x` changes its width, `y` its height. */
export type ResizeAxis = 'x' | 'y'

/** Options of {@link useResizable}. */
export interface ResizableOptions {
  /** `localStorage` key under which the size survives reloads; shared by every pane using the same key. */
  storageKey: string
  axis: ResizeAxis
  /** Size in pixels used on first launch and restored by a double-click on the handle. */
  initialSize: number
  minSize: number
  /** Upper bound in pixels, read at drag time so it can follow the window size. */
  maxSize: () => number
}

/** Props to spread on the drag handle element (see `ResizeHandle`). */
export interface ResizeHandleProps {
  axis: ResizeAxis
  isDragging: boolean
  onPointerDown(event: React.PointerEvent<HTMLElement>): void
  onDoubleClick(): void
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

// Storage may be unavailable (private mode, blocked site data); resizing must keep working without it.
function readStoredSize(key: string): number | null {
  try {
    const stored = Number(localStorage.getItem(key))
    return Number.isFinite(stored) && stored > 0 ? stored : null
  } catch { return null }
}

function writeStoredSize(key: string, size: number): void {
  try { localStorage.setItem(key, String(Math.round(size))) } catch { /* not persisted */ }
}

/**
 * Makes a pane resizable by dragging a handle, persisting its size in `localStorage`.
 *
 * The handle is expected to sit on the pane's trailing edge (right for `x`, bottom for `y`),
 * so dragging away from the pane grows it.
 *
 * @param options - Axis, storage key and size bounds.
 * @returns The current size in pixels and the props for the drag handle.
 */
export function useResizable({ storageKey, axis, initialSize, minSize, maxSize }: ResizableOptions): { size: number; handleProps: ResizeHandleProps } {
  const [size, setSize] = useState(() => readStoredSize(storageKey) ?? initialSize)
  const [isDragging, setDragging] = useState(false)
  const maxSizeRef = useRef(maxSize)
  maxSizeRef.current = maxSize

  useEffect(() => { if (!isDragging) writeStoredSize(storageKey, size) }, [storageKey, size, isDragging])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    const startPointer = axis === 'x' ? event.clientX : event.clientY
    const startSize = size
    handle.setPointerCapture(event.pointerId)
    setDragging(true)

    const onMove = (move: PointerEvent) => {
      const delta = (axis === 'x' ? move.clientX : move.clientY) - startPointer
      setSize(clamp(startSize + delta, minSize, maxSizeRef.current()))
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
  }, [axis, size, minSize])

  const onDoubleClick = useCallback(() => setSize(clamp(initialSize, minSize, maxSizeRef.current())), [initialSize, minSize])

  return { size, handleProps: { axis, isDragging, onPointerDown, onDoubleClick } }
}
