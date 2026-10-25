import type { Plugin } from "vite";

export function validatePublicEnvironment(values: Record<string, string>, mode: string) {
  for (const [name, value] of Object.entries(values)) {
    if (!name.startsWith("VITE_")) continue;
    if (name === "VITE_API_BASE" && value === "/api/v1") continue;
    if (name === "VITE_BUILD_MODE" && value === (mode === "review" ? "review" : "production")) continue;
    throw new Error("unapproved_public_build_variable");
  }
}
/** Both production and reviewer bundles must remain independent of backend code and credentials. */
export function backendBoundary(): Plugin {
  return { name: "rise-backend-boundary", enforce: "pre", load(id) {
    if (/\/(server|infra|supabase|\.rise-infra)\//.test(id) || /\/scripts\/infra\//.test(id) || /\.env(?:[.?]|$)/.test(id)) this.error("Backend/private configuration cannot enter a browser bundle.");
    return null;
  } };
}
