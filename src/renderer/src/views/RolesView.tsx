import type { RoleInfo } from '@shared/types'
import { Badge, MetaTable, type MetaColumn } from '@/components/MetaTable'
import { useAsync } from '@/lib/useAsync'
import type { Tab } from '@/lib/store'

const flag = (isOn: boolean, label: string) => (isOn ? <Badge tone="accent">{label}</Badge> : null)

const columns: MetaColumn<RoleInfo>[] = [
  { header: 'Name', className: 'font-medium', render: (r) => r.name },
  { header: 'Type', render: (r) => (r.canLogin ? <Badge tone="ok">USER</Badge> : <Badge>GROUP</Badge>) },
  { header: 'Privileges', render: (r) => <>{flag(r.isSuperuser, 'SUPERUSER')}{flag(r.canCreateDb, 'CREATEDB')}{flag(r.canCreateRole, 'CREATEROLE')}{flag(r.isReplication, 'REPLICATION')}{flag(r.bypassRls, 'BYPASSRLS')}</> },
  { header: 'Member of', render: (r) => r.memberOf.join(', ') || '—' },
  { header: 'Conn. limit', render: (r) => r.connectionLimit ?? '∞' },
  { header: 'Password expires', render: (r) => r.validUntil ?? 'never' }
]

/** Server roles: users (can log in) and groups, with their privileges and memberships. */
export function RolesView({ tab }: { tab: Extract<Tab, { kind: 'roles' }> }) {
  const { data } = useAsync(() => window.api.db.roles(tab.connId), [tab.connId])
  if (!data) return <div className="h-full grid place-items-center text-dim">Loading roles…</div>
  return <MetaTable columns={columns} rows={data} emptyMessage="No roles" />
}
