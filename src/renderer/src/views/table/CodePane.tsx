import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface Props {
  /** Source to display; `null` while loading. */
  code: string | null
  emptyMessage: string
}

/** Read-only, copyable block of generated source (DDL, DBML). */
export function CodePane({ code, emptyMessage }: Props) {
  const [isCopied, setCopied] = useState(false)
  if (code === null) return <div className="h-full grid place-items-center text-dim">Loading…</div>
  if (!code.trim()) return <div className="text-dim text-center py-10">{emptyMessage}</div>

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="h-full relative">
      <button className="btn absolute top-3 right-5" onClick={copy}>{isCopied ? <Check size={14} /> : <Copy size={14} />} {isCopied ? 'Copied' : 'Copy'}</button>
      <pre className="h-full overflow-auto p-4 font-mono text-[12.5px] whitespace-pre select-text">{code}</pre>
    </div>
  )
}
