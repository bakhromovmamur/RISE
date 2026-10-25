import { randomBytes } from "node:crypto";
import type pg from "pg";
import type { Environment } from "../server/config.ts";

export interface Installation {
  environment: Environment;
  origin: string;
  projectRef: string;
  installationId: string;
}
export type RuntimePasswords = Record<"bff" | "worker" | "lifecycle" | "ops", string>;
export const newPasswords = (): RuntimePasswords => ({ ops: randomBytes(32).toString("hex"), bff: randomBytes(32).toString("hex"), worker: randomBytes(32).toString("hex"), lifecycle: randomBytes(32).toString("hex") });

/** Administrative setup only. Never import this module into the BFF or the browser. */
export async function provision(client: pg.Client, installation: Installation, passwords: RuntimePasswords) {
  await client.query("begin");
  try {
    await client.query("select pg_advisory_xact_lock(734022101)");
    const { environment, origin, projectRef, installationId } = installation;
    await client.query(`insert into rise_private.environment (environment, app_origin, provider_project_ref, installation_id)
      values ($1, $2, $3, $4) on conflict (singleton) do nothing`, [environment, origin, projectRef, installationId]);
    const { rows } = await client.query("select environment, app_origin, provider_project_ref, installation_id::text from rise_private.environment where singleton");
    if (rows.length !== 1 || rows[0].environment !== environment || rows[0].app_origin !== origin || rows[0].provider_project_ref !== projectRef || rows[0].installation_id !== installationId) throw new Error("installation_identity_mismatch");
    for (const name of ["bff", "worker", "lifecycle", "ops"] as const) {
      const login = `rise_${name}_login`, group = `rise_${name}`, password = passwords[name];
      // Fixed identifiers and generated hex only: credentials never become SQL text from untrusted input.
      if (!/^[0-9a-f]{64}$/.test(password)) throw new Error("invalid_runtime_password");
      const exists = await client.query("select 1 from pg_roles where rolname = $1", [login]);
      if (!exists.rowCount) {
        await client.query(`create role ${login} login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '${password}'`);
        await client.query(`grant ${group} to ${login}`);
      }
      const check = await client.query(`select rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
        pg_has_role($1, $2, 'member') as expected,
        (select count(*) from pg_auth_members m join pg_roles r on r.oid = m.member where r.rolname = $1) as memberships
        from pg_roles where rolname = $1`, [login, group]);
      const role = check.rows[0];
      if (!role || !role.expected || role.memberships !== "1" || role.rolsuper || role.rolcreatedb || role.rolcreaterole || role.rolreplication || role.rolbypassrls) throw new Error("unsafe_runtime_role");
    }
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
}
