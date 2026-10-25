import type pg from "pg";
import type { Installation } from "./provision.ts";

export const fixtureNames = ["infra-owner", "infra-unrelated", "infra-removed"] as const;
/** Confirmed synthetic identities only. No invitations, email dispatch or personal journey records. */
export async function seedSynthetic(client: pg.Client, installation: Installation, credentials: { url: string; publishableKey: string; adminKey: string; password: string }) {
  if (installation.environment === "production") throw new Error("production_fixtures_forbidden");
  const marker = await client.query("select environment, installation_id::text from rise_private.environment where singleton");
  if (marker.rows[0]?.environment !== installation.environment || marker.rows[0]?.installation_id !== installation.installationId) throw new Error("fixture_environment_mismatch");
  const expected = installation.environment === "staging" ? `https://${installation.projectRef}.supabase.co` : `http://127.0.0.1:${installation.environment === "local" ? 55321 : 55421}`;
  if (credentials.url !== expected || !/^[0-9a-f]{64}$/.test(credentials.password)) throw new Error("invalid_fixture_configuration");
  const identities: Record<string, string> = {};
  for (const fixture of fixtureNames) {
    const email = `${fixture}-${installation.installationId}@example.invalid`;
    const existing = await client.query("select id from auth.users where email = $1", [email]);
    let id: string = existing.rows[0]?.id;
    if (!id) {
      const response = await fetch(`${credentials.url}/auth/v1/admin/users`, { method: "POST", headers: { apikey: credentials.publishableKey, Authorization: `Bearer ${credentials.adminKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: credentials.password, email_confirm: true, app_metadata: { synthetic_fixture: true } }), redirect: "error", signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("synthetic_user_creation_failed");
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string") throw new Error("invalid_synthetic_user_response");
      id = body.id;
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) throw new Error("invalid_synthetic_user_response");
    }
    await client.query("insert into rise_private.synthetic_fixtures (fixture_key, auth_user_id) values ($1, $2) on conflict (fixture_key) do nothing", [fixture, id]);
    const record = await client.query("select auth_user_id from rise_private.synthetic_fixtures where fixture_key = $1", [fixture]);
    if (record.rows[0]?.auth_user_id !== id) throw new Error("synthetic_fixture_conflict");
    identities[fixture] = id;
  }
  return identities;
}
