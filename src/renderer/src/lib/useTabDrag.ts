import { create } from 'zustand'

/** Tab currently dragged, shared by every tab strip and drop zone of the workspace. */
interface TabDragState {
  draggedTabId: string | null
  setDraggedTabId(id: string | null): void
}

/**
 * Tracks the tab being dragged.
 *
 * HTML drag events do not expose the payload during `dragover`, so drop targets read it here instead.
 */
export const useTabDrag = create<TabDragState>((set) => ({
  draggedTabId: null,
  setDraggedTabId: (id) => set({ draggedTabId: id }),
}))
