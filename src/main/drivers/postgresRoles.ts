import type pg from 'pg'
import type { RoleInfo } from '@shared/types'

/**
 * Lists the server roles with their attributes and memberships.
 * Reads `pg_roles` (not `pg_authid`) so it works without superuser rights;
 * built-in `pg_*` roles are skipped as they only add noise.
 */
export async function fetchRoles(pool: pg.Pool): Promise<RoleInfo[]> {
  const r = await pool.query(
    `SELECT r.rolname AS name, r.rolcanlogin AS can_login, r.rolsuper AS is_super, r.rolcreatedb AS can_create_db,
            r.rolcreaterole AS can_create_role, r.rolreplication AS is_replication, r.rolbypassrls AS bypass_rls,
            r.rolconnlimit AS conn_limit, r.rolvaliduntil::text AS valid_until,
            ARRAY(SELECT g.rolname::text FROM pg_auth_members m JOIN pg_roles g ON g.oid = m.roleid
                  WHERE m.member = r.oid ORDER BY g.rolname) AS member_of
     FROM pg_roles r WHERE r.rolname NOT LIKE 'pg\\_%' ORDER BY r.rolcanlogin DESC, r.rolname`)
  return r.rows.map((x): RoleInfo => ({
    name: x.name, canLogin: x.can_login, isSuperuser: x.is_super, canCreateDb: x.can_create_db,
    canCreateRole: x.can_create_role, isReplication: x.is_replication, bypassRls: x.bypass_rls,
    connectionLimit: x.conn_limit < 0 ? null : x.conn_limit, validUntil: x.valid_until, memberOf: x.member_of
  }))
}
