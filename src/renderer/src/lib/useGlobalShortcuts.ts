import { useEffect } from 'react'
import { useStore } from './store'
import { SHORTCUTS, matchesShortcut, type GlobalShortcutId } from './shortcuts'

/**
 * Registers the app-wide keyboard shortcuts.
 *
 * @param handlers - Callbacks for shortcuts that need UI state owned by the caller.
 */
export function useGlobalShortcuts(handlers: { onQuickOpen(): void }): void {
  useEffect(() => {
    const actions: Record<GlobalShortcutId, () => void> = {
      quickOpen: handlers.onQuickOpen,
      newQuery: () => useStore.getState().newQueryOnActiveConnection(),
      closeTab: () => { const { activeTab, closeTab } = useStore.getState(); if (activeTab) closeTab(activeTab) },
      nextTab: () => useStore.getState().cycleTab(1),
      previousTab: () => useStore.getState().cycleTab(-1)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = SHORTCUTS.find((s) => s.id && matchesShortcut(event, s.keys))
      if (shortcut?.id) { event.preventDefault(); actions[shortcut.id](); return }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && /^[1-9]$/.test(event.key)) {
        event.preventDefault(); useStore.getState().goToTab(Number(event.key) - 1)
      }
    }
    // Capture phase: the code editor would otherwise swallow Ctrl+N / Ctrl+P.
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [handlers.onQuickOpen])
}
