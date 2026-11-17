import { useEffect, useRef, type RefObject } from 'react'

/** A part of the UI that handles Ctrl+F while it is visible. */
interface FindScope {
  elementRef: RefObject<HTMLElement | null>
  /** Breaks ties when focus is outside every scope; the main content outranks the sidebar. */
  priority: number
  onFind(): void
}

const scopes = new Set<FindScope>()

/** Hidden tabs and panes stay mounted with `display: none`, which leaves them without client rects. */
const isVisible = (element: HTMLElement | null): element is HTMLElement => !!element && element.getClientRects().length > 0

/**
 * Runs the Ctrl+F handler of the most relevant visible scope: the innermost one
 * holding the keyboard focus, else the one with the highest priority.
 *
 * @param focused - Element that received the keyboard event.
 * @returns Whether a scope handled the shortcut.
 */
export function runFind(focused: Element | null): boolean {
  const visible = [...scopes].filter((scope) => isVisible(scope.elementRef.current))
  const containing = visible.filter((scope) => focused && scope.elementRef.current!.contains(focused))
  // The innermost scope is the one contained by all the others.
  const innermost = containing.find((scope) => containing.every((other) => other.elementRef.current!.contains(scope.elementRef.current)))
  const target = innermost ?? visible.sort((a, b) => b.priority - a.priority)[0]
  target?.onFind()
  return !!target
}

/**
 * Makes an element answer Ctrl+F while it is visible.
 *
 * @param elementRef - Root of the searchable area.
 * @param onFind - Usually focuses the area's search field.
 * @param priority - See {@link FindScope.priority}; defaults to `1`, the main content.
 */
export function useFindScope(elementRef: RefObject<HTMLElement | null>, onFind: () => void, priority = 1): void {
  const onFindRef = useRef(onFind)
  onFindRef.current = onFind
  useEffect(() => {
    const scope: FindScope = { elementRef, priority, onFind: () => onFindRef.current() }
    scopes.add(scope)
    return () => { scopes.delete(scope) }
  }, [elementRef, priority])
}
