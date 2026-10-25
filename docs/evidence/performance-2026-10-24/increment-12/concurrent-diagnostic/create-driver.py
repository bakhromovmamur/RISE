from pathlib import Path
import shutil
root=Path.cwd(); old=Path('/tmp/rise-bff-session-wait-probe'); dest=Path('/tmp/rise-bff-concurrent-session-probe'); dest.mkdir()
for name in ['router.mjs','worker.mjs','gateway.mjs']:
 (dest/name).write_text((old/name).read_text().replace(str(old),str(dest)))
s=(old/'run.mts').read_text().replace('mixed=false,users=2','mixed=false,users=5')
a=s.index(' let operationIndex=0;'); b=s.index(' report.exactReplay=true;',a)
s=s[:a]+''' let operationIndex=0;
 for(let round=0;round<4;round++)for(const check of ['full','undo']){
  running(); const index=operationIndex++;
  const intentions=clients.map(c=>({c,body:{protocolVersion:1,operationId:randomUUID(),baseRevision:c.revision,command:check==='full'?{kind:'habit.check',habitId:state.habits[0].id,date,check:'full'}:{kind:'habit.correct',habitId:state.habits[0].id,date,check:null}}}));
  const at=performance.now();
  const mutations=Promise.all(intentions.map(async({c,body},user)=>{const response=await c.browser.request('personal/commands',body,{'x-rise-small-trial':String(index)});return{user,status:response.statusCode,ms:performance.now()-at,receipt:response.statusCode===200?response.json<AccountReceipt>():undefined};}));
  await new Promise(resolve=>setTimeout(resolve,25));
  const reads=await Promise.all(Array.from({length:10},async(_,i)=>{const user=i%users,begin=performance.now(),response=await clients[user].browser.request('groups',undefined,{'x-rise-small-trial':String(index)});if(response.statusCode===200){const result=response.json();assert.equal(result.accountId,clients[user].owner);assert.deepEqual(result.groups,[]);}return{user,status:response.statusCode,ms:performance.now()-begin};}));
  const results=await mutations;let recoveries=0;
  for(const result of results){const {c,body}=intentions[result.user];let receipt=result.receipt;
   if(!receipt){const retry=await c.browser.request('personal/commands',body);assert.equal(retry.statusCode,200,'exact_retry');receipt=retry.json<AccountReceipt>();recoveries++;}
   assert.equal(receipt.xp,expectedXp+(check==='full'?20:0));assert.equal(receipt.operationRevision,c.revision+1);c.revision=receipt.operationRevision;
   const replay=await c.browser.request('personal/commands',body);assert.equal(replay.statusCode,200);assert.deepEqual(replay.json(),{...receipt,replayed:true});
  }
  trials.push({index,round,check,mutations:results.map(({receipt,...rest})=>rest),reads,recoveries});process.stderr.write(`Concurrent trial ${index}: ${results.filter(s=>s.status===200).length}/5 mutations, ${reads.filter(s=>s.status===200).length}/10 reads, ${recoveries} recoveries\\n`);
 }
''' +s[b:]
(dest/'run.mts').write_text(s)
p=root/'docs/evidence/performance-2026-10-24/increment-12/diagnostic/prepare-source.py'
(dest/'prepare-source.py').write_text(p.read_text().replace('evidence=Path(__file__).parent',f'evidence=Path({str(p.parent)!r})').replace(str(old),str(dest)))
print(dest)
