import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {stat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {buildRelease} from '../../scripts/infra/release/package.ts';
import {selectRelease,deploymentDirectory} from '../../scripts/infra/release/runtime.ts';

test('real rollout fences stale rollback choices and drains repeated interrupts without leaving its lock',async()=>{
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
  }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await Promise.race([exited,delay(15000,undefined,{ref:false})]);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}}
});
