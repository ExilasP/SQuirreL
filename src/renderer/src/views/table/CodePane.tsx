import { useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql as sqlLang, PostgreSQL, SQLite } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { Check, Copy } from 'lucide-react'
import type { DriverId } from '@shared/types'

interface Props {
  /** Source to display; `null` while loading. */
  code: string | null
  emptyMessage: string
  /** Enables SQL syntax highlighting for this engine's dialect; plain text when omitted. */
  sqlDriver?: DriverId
}

/** Read-only, copyable block of generated source (DDL, DBML). */
export function CodePane({ code, emptyMessage, sqlDriver }: Props) {
  const [isCopied, setCopied] = useState(false)
  const extensions = useMemo(() => [
    EditorView.editable.of(false),
    ...(sqlDriver ? [sqlLang({ dialect: sqlDriver === 'postgres' ? PostgreSQL : SQLite })] : [])
  ], [sqlDriver])

  if (code === null) return <div className="h-full grid place-items-center text-dim">Loading…</div>
  if (!code.trim()) return <div className="text-dim text-center py-10">{emptyMessage}</div>

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="h-full relative">
      {/* z-10: CodeMirror's positioned layers come later in the DOM and would otherwise cover the button. */}
      <button className="btn absolute top-3 right-5 z-10" onClick={copy}>{isCopied ? <Check size={14} /> : <Copy size={14} />} {isCopied ? 'Copied' : 'Copy'}</button>
      <CodeMirror value={code} theme={oneDark} height="100%" className="h-full" readOnly extensions={extensions}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }} />
    </div>
  )
}
