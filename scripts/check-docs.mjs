import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";

const root = process.cwd();
const files = [
  "README.md", "PRD.md", "TASKS.md", "ARCHITECTURE.md", "SECURITY.md", "AGENTS.md",
  "PRODUCT.md", "DESIGN.md", "VERIFICATION.md", "BRIEF.md",
  "FULL-DAY-WALKTHROUGH.md", "DIFFICULT-DAY-WALKTHROUGH.md", "RUSSIAN-LANGUAGE.md",
  ...(await readdir("docs")).filter(name => name.endsWith(".md")).map(name => `docs/${name}`),
];
const failures = [], sources = new Map();
async function source(path) {
  if (!sources.has(path)) sources.set(path, await readFile(path, "utf8"));
  return sources.get(path);
}
function anchors(text) {
  const values = new Set(), counts = new Map();
  for (const match of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const slug = match[1].trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
    const count = counts.get(slug) ?? 0;
    values.add(slug + (count ? `-${count}` : "")); counts.set(slug, count + 1);
  }
  return values;
}
let links = 0, fragments = 0;
for (const file of files) {
  const path = resolve(file), text = await source(path);
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, "");
    if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("//")) continue;
    const [name, hash] = target.split("#"), destination = name ? resolve(dirname(path), decodeURIComponent(name)) : path;
    links++;
    try {
      const info = await stat(destination);
      if (hash && info.isFile() && destination.endsWith(".md")) {
        fragments++;
        if (!anchors(await source(destination)).has(decodeURIComponent(hash))) failures.push(`${file}: missing anchor ${target}`);
      }
    } catch { failures.push(`${file}: missing target ${target}`); }
  }
}
const register = await source(resolve("TASKS.md"));
const tasks = [...register.matchAll(/^#### ([A-Z]+-\d+) — (.+)\n\n- \[([ x])\] \*\*Status: ([A-Z ]+) ·.*Depends: ([^*]+)\*\*/gm)].map(match => ({
  id: match[1], status: match[4], checked: match[3] === "x", dependencies: match[5].trim() === "none" ? [] : match[5].trim().split(/,\s*/),
}));
const ids = new Set(tasks.map(task => task.id)), visited = new Set(), order = [];
if (tasks.length !== [...register.matchAll(/^#### [A-Z]+-\d+ —/gm)].length) failures.push("TASKS.md: malformed task metadata");
if (ids.size !== tasks.length) failures.push("TASKS.md: duplicate task IDs");
for (const task of tasks) {
  if (!["TODO", "IN PROGRESS", "REVIEW", "BLOCKED", "DONE"].includes(task.status)) failures.push(`${task.id}: unknown status`);
  if (task.checked !== (task.status === "DONE")) failures.push(`${task.id}: checkbox/status mismatch`);
  for (const id of task.dependencies) if (!ids.has(id)) failures.push(`${task.id}: unknown dependency ${id}`);
}
while (visited.size < tasks.length) {
  const next = tasks.find(task => !visited.has(task.id) && task.dependencies.every(id => visited.has(id)));
  if (!next) { failures.push("TASKS.md: dependency cycle or missing dependency"); break; }
  visited.add(next.id); order.push(next.id);
}
const requirements = [...(await source(resolve("PRD.md"))).matchAll(/^### (PRD-\d+) —/gm)].map(match => match[1]);
const traceability = register.split("## 5. Requirement traceability")[1]?.split("## 6.")[0] ?? "";
for (const id of requirements) if (!traceability.includes(`| ${id} `)) failures.push(`${id}: missing task mapping`);
console.log(JSON.stringify({ documents: files.length, links, anchors: fragments, tasks: tasks.length, requirements: requirements.length, order, failures, files: files.map(file => relative(root, resolve(file))) }, null, 2));
if (failures.length) process.exitCode = 1;
