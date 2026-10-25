import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {once} from 'node:events';
import {promisify} from 'node:util';
import {createServer} from 'node:net';
import {readFile} from 'node:fs/promises';
import {requestSummary,readJournal} from '../../server/operations/monitor.ts';
import {readPrivateJson} from '../../server/operations/files.ts';

test('real local entry publishes private diagnostics and the CLI routes live/unavailable health without sending', {timeout:30000},async()=>{
  const available=createServer();await new Promise<void>((resolve,reject)=>{available.once('error',reject);available.listen(4191,'127.0.0.1',resolve);});await new Promise<void>((resolve,reject)=>available.close(error=>error?reject(error):resolve()));
  const child=spawn(process.execPath,['--import','tsx','--env-file=.rise-infra/test/server.env','server/main.ts'],{stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
  const stopped=once(child,'exit');
  const run=async(action:string)=>{
    try{return {code:0,...await promisify(execFile)(process.execPath,['--import','tsx','scripts/infra/ops.ts',action,'test'])};}
    catch(error){const e=error as {code:number;stdout:string;stderr:string};return e;}
  };
  try{
    let ready=false;
    for(let i=0;i<100&&!ready;i++){
      assert.equal(child.exitCode,null,'BFF exited before readiness');
      try{const response=await fetch('http://127.0.0.1:4191/api/v1/health/ready',{signal:AbortSignal.timeout(500)});ready=response.ok;}catch{/* Bounded startup retry on the fixed test origin. */}
      if(!ready)await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal(ready,true);
    let snapshot;
    for(let i=0;i<30;i++){try{snapshot=requestSummary(await readPrivateJson('.rise-infra/test/operations/bff-4191.json'));if(snapshot.release.startsWith('local-')&&Date.now()-Date.parse(snapshot.sampledAt)<5000)break;}catch{/* First atomic snapshot may still be writing. */}await new Promise(resolve=>setTimeout(resolve,100));}
    assert.match(snapshot?.release??'',/^local-[a-f0-9]{20}$/);assert.match(snapshot?.webRelease??'',/^[a-f0-9]{20}$/);
    const canary='OPS_RUNTIME_PRIVATE_CANARY';await fetch('http://127.0.0.1:4191/'+canary+'?token='+canary,{headers:{'x-request-id':canary}});
    const check=await run('check');assert.ok([0,2].includes(check.code));
    const journal=readJournal(await readPrivateJson('.rise-infra/test/operations/alerts.json'));
    for(const code of ['health_unavailable','database_unavailable','diagnostics_stale'] as const)assert.equal(journal.active.includes(code),false);
    const drill=await run('drill');assert.equal(drill.code,0);assert.equal(readJournal(await readPrivateJson('.rise-infra/test/operations/drill.json')).events.at(-1)?.state,'resolved');
    assert.equal(output.includes(canary),false);assert.equal((await readFile('.rise-infra/test/operations/status.json','utf8')).includes(canary),false);
  }finally{child.kill('SIGTERM');await stopped;}
  const unavailable=await run('check');assert.equal(unavailable.code,2);
  assert.ok(readJournal(await readPrivateJson('.rise-infra/test/operations/alerts.json')).active.includes('health_unavailable'));
});
