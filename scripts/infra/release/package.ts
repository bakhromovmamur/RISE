import {createHash,randomUUID} from 'node:crypto';
import {cp,mkdir,mkdtemp,readFile,readdir,readlink,realpath,lstat,writeFile,rename,rm,chmod} from 'node:fs/promises';
import {resolve,join,sep,dirname,basename} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {root} from '../local.ts';
import {PWA_CONTRACT} from '../../../src/pwa/protocol.ts';
const exec=promisify(execFile);
export const releases=resolve(root,'.rise-infra/releases');
export const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const contracts={pwa:PWA_CONTRACT,accountCache:'1/2',pushDevice:1,accountApi:1};
/** Only the freshly owned mkdtemp stage, never a retained release. Sealing makes
 * directories read-only, so restore their owner write bit before discarding. */
export async function discardBuildStage(directory:string){
  if(!/^rise-release-build-[A-Za-z0-9]{6}$/.test(basename(directory))||await realpath(dirname(directory))!==await realpath(tmpdir()))throw new Error('invalid_release_build_stage');
  try{await lstat(directory);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  async function writable(path:string){
    const info=await lstat(path);
    if(!info.isDirectory()||info.isSymbolicLink()||process.getuid&&info.uid!==process.getuid())throw new Error('invalid_release_build_stage');
    await chmod(path,0o700);
    for(const entry of await readdir(path,{withFileTypes:true}))if(entry.isDirectory())await writable(join(path,entry.name));
  }
  await writable(directory);
  await rm(directory,{recursive:true,force:true});
}
export interface ReleaseManifest {format:1;id:string;createdAt:string;node:string;platform:string;arch:string;webRelease:string;contracts:typeof contracts;migrations:Record<string,string>;files:Record<string,string>}
export function releaseDirectory(id:string){if(!/^[a-f0-9]{64}$/.test(id))throw new Error('invalid_release_id');return join(releases,id);}
/** Include dependencies and link targets: running a sealed release never resolves the mutable checkout's dependencies. */
export async function inventory(directory:string,relative=''):Promise<Record<string,string>>{
  const files:Record<string,string>={};
  for(const name of (await readdir(join(directory,relative))).sort()){
    const path=relative?`${relative}/${name}`:name;
    if(path==='release.json')continue;
    const full=join(directory,path),info=await lstat(full);
    if(info.isSymbolicLink()){
      const target=await realpath(full);
      if(!path.startsWith('node_modules/')||!target.startsWith(await realpath(directory)+sep))throw new Error('release_link_escape');
      files[path]=`link:${await readlink(full)}`;
    }else if(info.isDirectory())Object.assign(files,await inventory(directory,path));
    else if(info.isFile())files[path]=digest(await readFile(full));
    else throw new Error('release_special_file');
  }
  return files;
}
export async function migrations(directory=resolve(root,'supabase/migrations')){
  const result:Record<string,string>={};
  for(const name of (await readdir(directory)).filter(n=>n.endsWith('.sql')).sort())result[name]=digest(await readFile(join(directory,name)));
  return result;
}
export async function inspectWeb(directory:string){
  const html=await readFile(join(directory,'dist/index.html'),'utf8');
  if(!html.includes('<meta name="rise-build" content="production"')||html.includes('content="review"'))throw new Error('production_build_required');
  const worker=await readFile(join(directory,'dist/notifications-sw.js'),'utf8');
  const match=worker.match(/const BUILD = (.*);/);if(!match)throw new Error('worker_build_required');
  const build:unknown=JSON.parse(match[1]);
  if(!build||typeof build!=='object'||!('release'in build)||typeof build.release!=='string'||!/^[a-f0-9]{20}$/.test(build.release)||!('contract'in build)||build.contract!==PWA_CONTRACT||!('assets'in build)||!Array.isArray(build.assets)||!html.includes(`name="rise-release" content="${build.release}"`))throw new Error('incompatible_web_build');
  for(const asset of build.assets){
    if(!asset||typeof asset.url!=='string'||!/^\/(?:index\.html|manifest\.webmanifest|favicon\.svg|(?:assets|icons)\/[\w.-]+)$/.test(asset.url)||typeof asset.sha256!=='string'||digest(await readFile(join(directory,'dist',asset.url)))!==asset.sha256)throw new Error('incomplete_web_build');
  }
  return build.release;
}
export async function verifyRelease(id:string):Promise<ReleaseManifest>{
  const directory=releaseDirectory(id),info=await lstat(directory);
  if(!info.isDirectory()||info.isSymbolicLink())throw new Error('invalid_release_directory');
  const raw=await readFile(join(directory,'release.json'),'utf8');if(raw.length>8*1024*1024)throw new Error('release_manifest_too_large');
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object'||!('id'in value)||!('format'in value)||!('node'in value)||!('platform'in value)||!('arch'in value)||!('contracts'in value)||!('files'in value)||!('migrations'in value)||!('webRelease'in value)||!('createdAt'in value)||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt)))throw new Error('invalid_release_manifest');
  const {id:stored,...body}=value;
  if(stored!==id||digest(JSON.stringify(body))!==id||value.format!==1||value.node!==process.version||value.platform!==process.platform||value.arch!==process.arch||JSON.stringify(value.contracts)!==JSON.stringify(contracts))throw new Error('incompatible_release');
  const files=await inventory(directory);
  if(JSON.stringify(files)!==JSON.stringify(value.files))throw new Error('release_integrity_failed');
  const webRelease=await inspectWeb(directory),schema=await migrations(join(directory,'supabase/migrations'));
  if(webRelease!==value.webRelease||JSON.stringify(schema)!==JSON.stringify(value.migrations))throw new Error('release_metadata_mismatch');
  return {format:1,id,createdAt:value.createdAt,node:process.version,platform:process.platform,arch:process.arch,webRelease,contracts,migrations:schema,files};
}
/** Conservative first rollout contract: schema changes require a separately reviewed compatibility expansion. */
export function compatible(candidate:ReleaseManifest,current:ReleaseManifest|null,expected:Record<string,string>,applied:string[]){
  if(JSON.stringify(candidate.migrations)!==JSON.stringify(expected)||JSON.stringify(Object.keys(expected).map(n=>n.split('_')[0]).sort())!==JSON.stringify([...applied].sort()))throw new Error('release_schema_mismatch');
  if(current&&(JSON.stringify(candidate.contracts)!==JSON.stringify(current.contracts)||JSON.stringify(candidate.migrations)!==JSON.stringify(current.migrations)))throw new Error('rollback_compatibility_required');
}
export async function buildRelease(){
  await mkdir(releases,{recursive:true,mode:0o700});
  const directory=await mkdtemp(join(tmpdir(),'rise-release-build-'));
  try{
    // An allowlist excludes all protected configuration, saved profiles, fixtures and generated native bundles.
    const sources=['src','server','public','supabase/migrations','scripts/pwa-build.ts','scripts/build-boundary.ts','scripts/infra/release/entry.ts','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.npmrc'];
    const before:Record<string,string>={};
    for(const path of sources){
      const source=join(root,path);const info=await lstat(source);if(info.isSymbolicLink())throw new Error('source_link_not_allowed');
      before[path]=info.isDirectory()?digest(JSON.stringify(await inventory(source))):digest(await readFile(source));
      await mkdir(resolve(directory,path,'..'),{recursive:true});await cp(source,join(directory,path),{recursive:true,dereference:false});
      const copied=info.isDirectory()?digest(JSON.stringify(await inventory(join(directory,path)))):digest(await readFile(join(directory,path)));
      if(before[path]!==copied)throw new Error('source_changed_during_snapshot');
    }
    for(const path of sources){const source=join(root,path);const current=(await lstat(source)).isDirectory()?digest(JSON.stringify(await inventory(source))):digest(await readFile(source));if(current!==before[path])throw new Error('source_changed_during_snapshot');}
    const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,CI:'true',RISE_BUILD_ID:randomUUID().replaceAll('-','')};
    // Offline, pinned lockfile. No inherited VITE values, Node hooks, database keys or user npm configuration.
    await exec('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund','--userconfig=/dev/null'],{cwd:directory,env,timeout:120000,maxBuffer:2*1024*1024});
    await exec('npm',['run','build'],{cwd:directory,env,timeout:120000,maxBuffer:2*1024*1024});
    await rm(join(directory,'tsconfig.tsbuildinfo'),{force:true});
    const body={format:1 as const,createdAt:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,webRelease:await inspectWeb(directory),contracts,migrations:await migrations(join(directory,'supabase/migrations')),files:await inventory(directory)};
    const manifest:ReleaseManifest={id:digest(JSON.stringify(body)),...body};
    await writeFile(join(directory,'release.json'),JSON.stringify(manifest)+'\n',{mode:0o400});
    // Refuse ordinary accidental edits; integrity is also rechecked before every activation/start.
    async function seal(path:string){for(const entry of await readdir(path,{withFileTypes:true})){const full=join(path,entry.name);if(entry.isDirectory())await seal(full);else if(entry.isFile())await chmod(full,(await lstat(full)).mode&0o111?0o500:0o400);}await chmod(path,0o500);}
    await seal(directory);await chmod(directory,0o700);await rename(directory,releaseDirectory(manifest.id));await chmod(releaseDirectory(manifest.id),0o500);return manifest;
  }catch(error){
    try{await discardBuildStage(directory);}
    catch(cleanup){throw new Error('release_build_cleanup_failed',{cause:new AggregateError([error,cleanup],'release_build_and_cleanup_failed')});}
    throw new Error('release_build_failed',{cause:error});
  }
}
