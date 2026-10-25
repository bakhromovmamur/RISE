import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('notice verification includes transitive attribution and rejects stale, missing and mismatched packages', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rise-notices-'));
  const script = resolve('scripts/check-notices.mjs');
  try {
    await mkdir(join(dir, 'src/help'), {recursive:true});
    await writeFile(join(dir, 'src/main.ts'), 'import {a} from "parent"; import("child");');
    await writeFile(join(dir, 'package-lock.json'), JSON.stringify({packages:{'node_modules/parent':{version:'1.0.0'},'node_modules/child':{version:'2.0.0'}}}));
    for (const name of ['parent','child']) {
      await mkdir(join(dir,'node_modules',name),{recursive:true});
      await writeFile(join(dir,'node_modules',name,'package.json'), JSON.stringify({name,version:name==='parent'?'1.0.0':'2.0.0',license:'MIT',dependencies:name==='parent'?{child:'2.0.0'}:{}}));
      await writeFile(join(dir,'node_modules',name,'LICENSE'), `Synthetic ${name} copyright and permission notice.`);
    }
    const run = (...args:string[]) => spawnSync(process.execPath,[script,...args],{cwd:dir,encoding:'utf8'});
    assert.equal(run('--write').status,0);
    const notice = await readFile(join(dir,'src/help/third-party-notices.txt'),'utf8');
    assert.match(notice,/Synthetic child copyright/); assert.equal(run().status,0);
    await writeFile(join(dir,'src/help/third-party-notices.txt'),'stale'); assert.notEqual(run().status,0);
    await writeFile(join(dir,'src/help/third-party-notices.txt'),notice);
    await writeFile(join(dir,'node_modules/child/package.json'),JSON.stringify({name:'child',version:'3.0.0',license:'MIT'})); assert.match(run().stderr,/Installed version mismatch/);
    await writeFile(join(dir,'node_modules/child/package.json'),JSON.stringify({name:'child',version:'2.0.0',license:'MIT'}));
    await rm(join(dir,'node_modules/child/LICENSE')); assert.match(run().stderr,/missing license text/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
