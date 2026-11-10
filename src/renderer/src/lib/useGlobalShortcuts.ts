import { useEffect } from 'react'
import { useStore } from './store'
import { runFind } from './findScopes'
import { SHORTCUTS, matchesShortcut, type GlobalShortcutId } from './shortcuts'

const isInCodeEditor = (target: EventTarget | null): boolean => target instanceof Element && !!target.closest('.cm-editor')

/**
 * Registers the app-wide keyboard shortcuts.
 *
 * @param handlers - Callbacks for shortcuts that need UI state owned by the caller.
 */
export function useGlobalShortcuts(handlers: { onQuickOpen(): void }): void {
  useEffect(() => {
    const actions: Record<GlobalShortcutId, () => void> = {
      quickOpen: handlers.onQuickOpen,
      find: () => runFind(document.activeElement),
      newQuery: () => useStore.getState().newQueryOnActiveConnection(),
      closeTab: () => { const { activeTab, closeTab } = useStore.getState(); if (activeTab) closeTab(activeTab) },
      nextTab: () => useStore.getState().cycleTab(1),
      previousTab: () => useStore.getState().cycleTab(-1)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = SHORTCUTS.find((s) => s.id && matchesShortcut(event, s.keys))
      // Code editors keep their own search panel.
      if (shortcut?.id === 'find' && isInCodeEditor(event.target)) return
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
