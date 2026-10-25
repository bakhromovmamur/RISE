import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
/** Local checkouts have no required Git commit. Fingerprint only code and the pinned lockfile, never configuration. */
export async function localRuntimeRelease(){
  const root=fileURLToPath(new URL('../../',import.meta.url)),hash=createHash('sha256');
  async function visit(relative:string){
    const entries=(await readdir(resolve(root,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
    for(const entry of entries){const name=`${relative}/${entry.name}`;if(entry.isDirectory())await visit(name);else if(entry.isFile()&&/\.tsx?$/.test(name)){hash.update(name+'\0');hash.update(await readFile(resolve(root,name)));}}
  }
  await visit('server');await visit('src');hash.update(await readFile(resolve(root,'package-lock.json')));
  return `local-${hash.digest('hex').slice(0,20)}`;
}
