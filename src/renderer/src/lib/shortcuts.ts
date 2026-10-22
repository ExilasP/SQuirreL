/** Identifiers of the shortcuts handled globally by the app shell. */
export type GlobalShortcutId = 'quickOpen' | 'newQuery' | 'closeTab' | 'nextTab' | 'previousTab'

export interface Shortcut {
  /** Set for shortcuts handled by `useGlobalShortcuts`; others are bound locally (e.g. in the editor) and only listed. */
  id?: GlobalShortcutId
  /** `+`-separated combo, `Mod` being Ctrl (Cmd on macOS). */
  keys: string
  label: string
}

/** Single source of truth for the shortcuts, used both for matching and for the welcome screen. */
export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'quickOpen', keys: 'Mod+P', label: 'Search a table or saved query' },
  { id: 'newQuery', keys: 'Mod+N', label: 'New query' },
  { keys: 'Mod+Enter', label: 'Run query (or selection)' },
  { keys: 'Mod+S', label: 'Save query' },
  { id: 'closeTab', keys: 'Mod+W', label: 'Close tab' },
  { id: 'nextTab', keys: 'Mod+Tab', label: 'Next tab' },
  { id: 'previousTab', keys: 'Mod+Shift+Tab', label: 'Previous tab' },
  { keys: 'Mod+1…9', label: 'Go to tab 1…9' }
]

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

/** Whether a keyboard event matches a `Mod+Shift+K`-style combo. */
export function matchesShortcut(event: KeyboardEvent, keys: string): boolean {
  const parts = keys.split('+')
  const key = parts[parts.length - 1]
  const modifiers = parts.slice(0, -1)
  const hasMod = event.ctrlKey || event.metaKey
  return hasMod === modifiers.includes('Mod')
    && event.shiftKey === modifiers.includes('Shift')
    && !event.altKey
    && event.key.toLowerCase() === key.toLowerCase()
}

/** Splits a combo into display parts, e.g. `Mod+P` → `['Ctrl', 'P']`. */
export function displayKeys(keys: string): string[] {
  return keys.split('+').map((part) => (part === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : part))
}
