import { Erd } from '@/components/Erd'
import type { Tab } from '@/lib/store'

export function DiagramView({ tab }: { tab: Extract<Tab, { kind: 'diagram' }> }) {
  return <Erd connId={tab.connId} schema={tab.schema} focusTable={tab.focusTable} />
}
