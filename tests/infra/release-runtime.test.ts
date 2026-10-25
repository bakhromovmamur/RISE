import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stat,readFile,lstat,readdir,readlink,mkdir,mkdtemp,rename,rm,rmdir,open,unlink,writeFile,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {buildRelease} from '../../scripts/infra/release/package.ts';
import {selectRelease,deploymentDirectory} from '../../scripts/infra/release/runtime.ts';

// Production compatibility deliberately rejects old migration fingerprints. This
// integration owns a temporary deployment selection, never the retained one.
const deployment=deploymentDirectory('test');
async function info(path:string){try{return await lstat(path);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
async function unlocked(directory=deployment){
  const root=await info(directory);if(root&&(!root.isDirectory()||root.isSymbolicLink()))throw new Error('invalid_test_deployment');
  for(const name of ['server.lock','selection.lock'])if(await info(join(directory,name)))throw new Error('test_deployment_locked');
}
async function deploymentSnapshot(){
  const result:Record<string,string>={};
  async function visit(path:string,key:string){const value=await info(path);if(!value)return;
    if(value.isSymbolicLink())result[key]=`link:${await readlink(path)}`;
    else if(value.isDirectory()){result[key]=`directory:${value.mode}`;for(const name of (await readdir(path)).sort())await visit(join(path,name),`${key}/${name}`);}
    else result[key]=`${value.mode}:${createHash('sha256').update(await readFile(path)).digest('hex')}`;
  }
  await visit(deployment,'deployment');return result;
}
async function isolatedDeployment(run:()=>Promise<void>){
  await unlocked();
  const guardPath=join(dirname(deployment),'release-runtime-test.lock'),guard=await open(guardPath,'wx',0o600);
  let workspace:string|undefined,moved=false,owned:Awaited<ReturnType<typeof lstat>>|undefined,restored=false;
  const restore=async()=>{
    try{
      if(moved||owned){
        const current=await info(deployment);
        if(current){
          if(!owned||current.dev!==owned.dev||current.ino!==owned.ino)throw new Error('test_deployment_changed');
          await unlocked();await rename(deployment,join(workspace!,'generated'));
        }
        if(moved)await rename(join(workspace!,'original'),deployment);
      }
      restored=true;if(workspace)await rm(workspace,{recursive:true,force:true});
    }catch(error){
      throw new Error(`test_deployment_restore_failed; preserved workspace: ${workspace??'not created'}`,{cause:error});
    }finally{await guard.close();if(restored)await unlink(guardPath);}
    // On unsafe restoration, retain the guard/workspace for explicit recovery.
  };
  try{
    await unlocked();workspace=await mkdtemp(join(dirname(deployment),'release-runtime-test-'));
    if(await info(deployment)){await rename(deployment,join(workspace,'original'));moved=true;await unlocked(join(workspace,'original'));}
    await mkdir(deployment,{mode:0o700});owned=await lstat(deployment);
    await run();
  }finally{await restore();}
}

test('release runtime isolation refuses deployment locks without modifying retained metadata',async()=>{
  await unlocked();const before=await deploymentSnapshot(),exists=!!await info(deployment);
  if(!exists)await mkdir(deployment,{mode:0o700});
  try{for(const name of ['server.lock','selection.lock'])for(const link of [false,true]){
    const path=join(deployment,name),lock=link?undefined:await open(path,'wx',0o600);
    if(link)await symlink('missing-lock-target',path);
    try{await assert.rejects(isolatedDeployment(async()=>{assert.fail('locked deployment must not run');}),/test_deployment_locked/);}
    finally{await lock?.close();await unlink(path);}
  }}finally{if(!exists)await rmdir(deployment);}
  assert.deepEqual(await deploymentSnapshot(),before);
});

test('release runtime isolation restores every retained deployment file after callback failure',async()=>{
  const before=await deploymentSnapshot();
  await assert.rejects(isolatedDeployment(async()=>{
    for(const name of ['state.json','desired.json','record-synthetic.json'])await writeFile(join(deployment,name),'Synthetic temporary metadata\n',{mode:0o600});
    throw new Error('injected_release_test_failure');
  }),/injected_release_test_failure/);
  assert.deepEqual(await deploymentSnapshot(),before);
});

test('real rollout fences stale rollback choices and drains repeated interrupts without leaving its lock',async()=>{
  const before=await deploymentSnapshot();
  await isolatedDeployment(async()=>{
  const release=await buildRelease(),selected=await selectRelease('test',release.id);
  const child=spawn(process.execPath,['--import','tsx','scripts/infra/release.ts','serve','test'],{stdio:'ignore'});
  const exited=new Promise<number|null>(resolve=>child.once('exit',resolve));
  try{
    let ready=false;
    for(let i=0;i<150;i++){
      if(child.exitCode!==null)throw new Error('release_start_failed');
      try{const response=await fetch('http://127.0.0.1:4191/api/v1/health/ready',{signal:AbortSignal.timeout(1000)}),health:unknown=await response.json();ready=response.ok&&!!health&&typeof health==='object'&&'release'in health&&health.release===release.id&&JSON.parse(await readFile(join(deploymentDirectory('test'),'state.json'),'utf8')).active.request===selected.request;}catch{/* Only this fixed test listener is starting. */}
      if(ready)break;await delay(200);
    }
    assert.ok(ready,'sealed runtime must become ready');
    const paused=await selectRelease('test',release.id,false);
    await assert.rejects(selectRelease('test',release.id,true,selected.request),/release_changed_review_required/);
    assert.equal(JSON.parse(await readFile(join(deploymentDirectory('test'),'desired.json'),'utf8')).request,paused.request);
    child.kill('SIGINT');await delay(1);child.kill('SIGINT');
    const result=await Promise.race([exited,delay(15000,undefined,{ref:false}).then(()=> 'timeout')]);assert.equal(result,0);
    await assert.rejects(stat(join(deploymentDirectory('test'),'server.lock')),{code:'ENOENT'});
    await assert.rejects(fetch('http://127.0.0.1:4191/api/v1/health/ready',{signal:AbortSignal.timeout(1000)}));
  }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await Promise.race([exited,delay(15000,undefined,{ref:false})]);if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}}}
  });
  assert.deepEqual(await deploymentSnapshot(),before);
});
