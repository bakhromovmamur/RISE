import pg from "pg";
import type { ServerConfig } from "./config.ts";

export class ReadinessError extends Error { constructor() { super("environment_not_ready"); } }
export function database(config: ServerConfig) {
  const pool = new pg.Pool(config.database);
  pool.on("error", () => { /* Readiness reports failure; credentials and server error details never reach logs. */ });
  async function verify() {
    const result = await pool.query(`select e.environment, e.app_origin, e.provider_project_ref, e.installation_id::text, e.schema_version,
      r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole, r.rolreplication,
      current_user as role, pg_has_role(current_user, 'rise_bff', 'member') as bff,
      to_regclass('rise_private.deletion_ledger') is not null and to_regclass('rise_private.deletion_jobs') is not null and to_regclass('rise_private.deleted_sessions') is not null as lifecycle_schema,
      pg_has_role(current_user, 'rise_worker', 'member') as worker,
      pg_has_role(current_user, 'rise_lifecycle', 'member') as lifecycle,
      pg_has_role(current_user, 'postgres', 'member') as administrator,
      pg_has_role(current_user, 'service_role', 'member') as provider_admin,
      (select count(*) from pg_auth_members m where m.member = r.oid) as memberships,
      has_schema_privilege(current_user, 'rise', 'CREATE') or has_schema_privilege(current_user, 'rise_private', 'CREATE')
        or has_schema_privilege(current_user, 'public', 'CREATE') as schema_writer,
      has_table_privilege(current_user, (select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'auth' and c.relname = 'users'), 'SELECT')
        or has_table_privilege(current_user, 'rise_private.environment', 'UPDATE') as private_admin
      from rise_private.environment e cross join pg_roles r where e.singleton and r.rolname = current_user`);
    const row = result.rows[0];
    if (result.rowCount !== 1 || row.environment !== config.environment || row.app_origin !== config.installationOrigin || row.provider_project_ref !== config.projectRef
      || row.installation_id !== config.installationId || row.schema_version !== 1 || row.role !== "rise_bff_login" || !row.bff || row.worker || row.lifecycle
      || row.administrator || row.provider_admin || row.memberships !== "1" || row.schema_writer || row.private_admin || !row.lifecycle_schema
      || row.rolsuper || row.rolbypassrls || row.rolcreatedb || row.rolcreaterole || row.rolreplication) throw new ReadinessError();
    const response = await fetch(`${config.providerUrl}/auth/v1/health`, { headers: { apikey: config.publishableKey }, redirect: "error", signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new ReadinessError();
  }
  return { pool, verify, close: () => pool.end() };
}
