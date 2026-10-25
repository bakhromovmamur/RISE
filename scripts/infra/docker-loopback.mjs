#!/usr/bin/env node
// CLI 2.121.0 publishes unqualified ports. Scope this adapter to our labeled local containers.
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2), project = process.env.RISE_DOCKER_PROJECT;
if (["create", "run"].includes(args[0]) && project && args.includes(`com.supabase.cli.project=${project}`)) {
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] !== "-p" && args[i] !== "--publish") continue;
    if (!/^\d+:\d+(?:\/(?:tcp|udp))?$/.test(args[i + 1])) { process.stderr.write("Unexpected local port syntax; refusing container creation.\n"); process.exit(1); }
    args[i + 1] = `127.0.0.1:${args[i + 1]}`;
  }
}
if (!process.env.RISE_DOCKER_BINARY || process.env.RISE_DOCKER_BINARY === process.argv[1]) process.exit(1);
const child = spawnSync(process.env.RISE_DOCKER_BINARY, args, { stdio: "inherit" });
process.exit(child.status ?? 1);
