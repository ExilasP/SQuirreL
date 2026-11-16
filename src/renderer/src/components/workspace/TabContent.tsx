import type { Tab } from '@/lib/store'
import { TableView } from '@/views/TableView'
import { QueryView } from '@/views/QueryView'
import { DiagramView } from '@/views/DiagramView'
import { RolesView } from '@/views/RolesView'
import { TypesView } from '@/views/TypesView'

/** View matching the kind of a tab. */
export function TabContent({ tab }: { tab: Tab }) {
  switch (tab.kind) {
    case 'table': return <TableView tab={tab} />
    case 'query': return <QueryView tab={tab} />
    case 'diagram': return <DiagramView tab={tab} />
    case 'roles': return <RolesView tab={tab} />
    case 'types': return <TypesView tab={tab} />
  }
}
