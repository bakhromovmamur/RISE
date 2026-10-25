import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Derive browser imports from source, then include their installed dependency closure.
// Node/build/native-tool dependencies remain in the separate lockfile inventory.
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const roots = new Set(), packages = new Map();
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.tsx?$/.test(path) && !path.endsWith('.d.ts')) {
      const source = await readFile(path, 'utf8');
      // Includes static, re-export and dynamic literal imports, conservatively
      // retaining type-only packages rather than omitting an attribution.
      for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g)) {
        const spec = match[1];
        if (/^@?[a-z][a-zA-Z0-9_./@-]*$/.test(spec)) roots.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
      }
    }
  }
}
async function collect(name, from = '') {
  const candidates = [];
  let directory = from;
  while (directory) { candidates.push(`${directory}/node_modules/${name}`); directory = dirname(directory); if (directory === '.') break; }
  candidates.push(`node_modules/${name}`);
  const path = candidates.find(candidate => lock.packages[candidate]);
  if (!path) throw new Error(`Unresolved notice dependency: ${name}`);
  if (packages.has(path)) return;
  const meta = JSON.parse(await readFile(`${path}/package.json`, 'utf8'));
  if (meta.version !== lock.packages[path].version) throw new Error(`Installed version mismatch: ${name}`);
  const names = (await readdir(path)).filter(file => /^(licen[cs]e|copying|copyright|notice)(\.[a-z]+)?$/i.test(file)).sort();
  if (!names.length || !meta.license) throw new Error(`Review missing license text: ${name}`);
  const texts = await Promise.all(names.map(async file => ({ file, text: await readFile(`${path}/${file}`, 'utf8') })));
  // tslib's separate copyright notice is part of its required attribution.
  if (name === 'tslib') texts.push({file: 'CopyrightNotice.txt', text: await readFile(`${path}/CopyrightNotice.txt`, 'utf8')});
  packages.set(path, { name: meta.name, version: meta.version, license: meta.license, texts });
  for (const dependency of Object.keys(meta.dependencies ?? {})) await collect(dependency, path);
}
await scan('src');
for (const root of [...roots].sort()) await collect(root);
const entries = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
const notice = 'RISE — third-party software notices\nGenerated from pinned browser dependency packages; original license text follows.\nThese licenses do not license the RISE application or artwork.\n\n' + entries.map(item => `${item.name}@${item.version} (${item.license})\n${item.texts.map(t => `${t.file}\n${t.text.trim()}\n`).join('\n')}`).join('\n----------------------------------------\n\n');
const destination = 'src/help/third-party-notices.txt';
if (process.argv.includes('--write')) await writeFile(destination, notice);
else if (await readFile(destination, 'utf8') !== notice) throw new Error('Notices differ. Review dependencies, then run node scripts/check-notices.mjs --write.');
const inventory = {
  lockSha256: createHash('sha256').update(await readFile('package-lock.json')).digest('hex'),
  browserRoots: [...roots].sort(),
  browser: entries.map(({texts, ...entry}) => ({...entry, notices: texts.map(t => ({file:t.file, sha256:createHash('sha256').update(t.text).digest('hex')}))})),
  lockPackages: Object.entries(lock.packages).filter(([path]) => path).map(([path, value]) => ({path, version:value.version, declaredLicense:value.license ?? 'UNRESOLVED', developmentOnly:!!value.dev, optional:!!value.optional})),
};
const inventoryIndex = process.argv.indexOf('--inventory');
if (inventoryIndex >= 0) {
  if (!process.argv[inventoryIndex + 1]) throw new Error('Inventory output path required');
  await writeFile(resolve(process.argv[inventoryIndex + 1]), JSON.stringify(inventory, null, 2) + '\n');
}
console.log(JSON.stringify({browserPackages:entries.length, lockPackages:inventory.lockPackages.length, noticesBytes:Buffer.byteLength(notice), status:'verified'}));
