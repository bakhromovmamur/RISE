import { authHarness } from "../support/auth.ts";
import { secrets } from "../../server/auth/crypto.ts";

export default async function prepareAuthBrowserTests() {
  // All three engines share one loopback IP. Reset only its isolated test quota
  // for each sequential browser worker; never expose a runtime reset endpoint or touch users/data.
  const harness = await authHarness();
  try {
    const crypto = secrets(harness.config.sessionKey, harness.config.installationId);
    const subjects = ["context:127.0.0.1", "send-ip:127.0.0.1", "verify-ip:127.0.0.1"].map(subject => crypto.rate(subject));
    await harness.admin.query("delete from rise_private.auth_limits where subject_hash = any($1::bytea[])", [subjects]);
  } finally { await harness.close(); }
}
