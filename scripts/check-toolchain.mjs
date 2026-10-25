import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const expectedNode = readFileSync(new URL("../.nvmrc", import.meta.url), "utf8").trim();
const expectedNpm = pkg.packageManager.replace("npm@", "");
const actualNpm = process.env.npm_config_user_agent?.match(/^npm\/(\S+)/)?.[1];
const errors = [];
if (process.versions.node !== expectedNode) errors.push(`Use Node ${expectedNode}; found ${process.versions.node}.`);
if (actualNpm !== expectedNpm) errors.push(`Run with npm ${expectedNpm}; found ${actualNpm ?? "no npm context"}.`);
if (pkg.engines.node !== expectedNode || pkg.engines.npm !== expectedNpm) errors.push("Runtime pins disagree.");
for (const group of ["dependencies", "devDependencies"]) {
  for (const [name, version] of Object.entries(pkg[group] ?? {})) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) errors.push(`${name} must have an exact reviewed version.`);
    if (lock.packages[""][group]?.[name] !== version || lock.packages[`node_modules/${name}`]?.version !== version) {
      errors.push(`${name} disagrees with the lockfile.`);
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Node ${expectedNode}, npm ${expectedNpm} and direct dependency pins match the lockfile.`);
}
