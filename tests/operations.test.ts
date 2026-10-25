import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RequestMetrics, requestArea, type RequestDiagnostic } from '../server/operations/requests.ts';
import { backupSummary, evaluate, transition, readJournal, requestSummary, queueSummary, type QueueSummary } from '../server/operations/monitor.ts';
import { routeAlerts } from '../scripts/infra/ops.ts';
import { diagnosticReport } from '../src/diagnostics/report.ts';
import { operationsDatabase } from '../server/operations/database.ts';
const now=Date.parse('2026-10-24T18:00:00Z');
const request:RequestDiagnostic={event:'request',requestId:'00000000-0000-4000-8000-000000000001',area:'sync',status:503,durationMs:2200,release:'synthetic',webRelease:'a'.repeat(20),at:new Date(now).toISOString()};
const queue:QueueSummary={sampledAt:new Date(now).toISOString(),senderReady:true,pending:0,due:0,oldestDueSeconds:0,staleLeases:0,expiredPending:0,failed24h:0,retired24h:0,deletionOverdue:0,deletionRetrying:0};
test('bounded operational metrics expire and classify only route templates, never request details',()=>{
  const metrics=new RequestMetrics('synthetic','a'.repeat(20));
  metrics.record(request,now);metrics.record({...request,status:409},now);metrics.record({...request,area:'health'},now);metrics.record({...request,area:'auth',status:429},now);
  const sample=metrics.snapshot(now);assert.equal(sample.requests,3);assert.equal(sample.syncFailures,1);assert.equal(sample.syncConflicts,1);assert.equal(sample.rateLimited,1);
  assert.equal(requestArea('/api/v1/groups/:id/content'),'groups');assert.equal(requestArea(undefined),'other');assert.equal(requestArea('private-canary'),'other');
  assert.equal(metrics.snapshot(now+300000).requests,0);metrics.record(request,now);assert.equal(metrics.snapshot(now-60000).requests,0);
});
test('health, sync and queue alerts fail closed on stale or missing samples and resolve',()=>{
  const metrics=new RequestMetrics('synthetic','a'.repeat(20));
  assert.deepEqual(evaluate({healthy:true,requests:metrics.snapshot(now),queue},now),[]);
  assert.deepEqual(evaluate({healthy:false,requests:null,queue:null},now),['health_unavailable','database_unavailable','diagnostics_stale']);
  metrics.record(request,now);
  assert.deepEqual(evaluate({healthy:true,requests:metrics.snapshot(now),queue:{...queue,pending:1,senderReady:false,oldestDueSeconds:31,staleLeases:1,expiredPending:1,failed24h:1,deletionOverdue:1,deletionRetrying:1}},now),['sender_unavailable','queue_backlog','queue_stale_lease','queue_expired','delivery_failed','deletion_overdue','deletion_retrying','sync_failures']);
  assert.deepEqual(evaluate({healthy:true,requests:metrics.snapshot(now),queue},now+21000),['database_unavailable','diagnostics_stale']);
  assert.ok(evaluate({healthy:true,requests:metrics.snapshot(now+60000),queue},now).includes('diagnostics_stale'));
});
test('unknown diagnostic input cannot carry profile text, identities or secrets into reports',()=>{
  const canary='PRIVATE_PROFILE_CANARY';
  const report=diagnosticReport({release:canary,storageStatus:'attention',storageError:canary,syncPhase:'offline',syncError:canary,pending:true,persistent:false,online:false,worker:false});
  assert.equal(diagnosticReport({release:null,storageStatus:'saving',storageError:null,syncPhase:'guest',syncError:null,pending:false,persistent:true,online:true,worker:false}).pendingChanges,true);
  assert.equal(report.storageError,'unknown');assert.equal(report.release,'unavailable');assert.equal(JSON.stringify(report).includes(canary),false);
  assert.equal(JSON.stringify(requestSummary({...new RequestMetrics('synthetic','a'.repeat(20)).snapshot(now),private:canary})).includes(canary),false);
  assert.equal(JSON.stringify(queueSummary({...queue,private:canary})).includes(canary),false);
  for(const invalid of [-1,NaN,'2',Infinity])assert.throws(()=>queueSummary({...queue,pending:invalid}));
  assert.throws(()=>readJournal({version:1,checkedAt:new Date(now).toISOString(),active:[canary],events:[]}));
});
test('alert routing persists raise/recovery once, prunes seven-day/200-event history and protects failures',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'rise-ops-route-'));t.after(()=>rm(dir,{recursive:true,force:true}));const path=join(dir,'alerts.json');
  const first=await routeAlerts(path,['test_alert'],now);assert.equal(first.events.length,1);
  const original=await readFile(path,'utf8');await assert.rejects(routeAlerts(path,[],now-1000),{message:'operations_clock_moved_back'});assert.equal(await readFile(path,'utf8'),original);
  assert.equal((await routeAlerts(path,['test_alert'],now+1000)).events.length,1);
  const resolved=await routeAlerts(path,[],now+2000);assert.equal(resolved.events.at(-1)?.state,'resolved');assert.equal((await stat(path)).mode&0o777,0o600);
  assert.equal(transition(resolved,[],now+8*86400000).events.length,0);
  let journal=first;for(let i=1;i<300;i++)journal=transition(journal,i%2?[]:['test_alert'],now+i*1000);assert.equal(journal.events.length,200);
  await writeFile(path,'corrupt retained evidence');await assert.rejects(routeAlerts(path,[],now));assert.equal(await readFile(path,'utf8'),'corrupt retained evidence');
  await mkdir(join(dir,'directory'));await assert.rejects(routeAlerts(join(dir,'directory'),['test_alert'],now));
});
test('operations credentials reject cloud, admin, cross-installation and extra secrets before connecting',()=>{
  const env={DEPLOY_ENV:'test',INSTALLATION_ID:'00000000-0000-4000-8000-000000000001',DATABASE_OPS_URL:`postgresql://rise_ops_login:${'a'.repeat(64)}@127.0.0.1:55422/postgres`};
  for(const changed of [{...env,SUPABASE_SECRET_KEY:'canary'},{...env,DEPLOY_ENV:'production'},{...env,DATABASE_OPS_URL:env.DATABASE_OPS_URL.replace('55422','55322')},{...env,DATABASE_OPS_URL:env.DATABASE_OPS_URL.replace('rise_ops_login','postgres')},{...env,DATABASE_OPS_URL:env.DATABASE_OPS_URL+'?sslmode=disable'}])assert.throws(()=>operationsDatabase(changed,'test'));
});

test('backup monitoring reports missing, old, future and failed maintenance without private metadata',()=>{
 const requests=new RequestMetrics('synthetic','a'.repeat(20)).snapshot(now),base={healthy:true,requests,queue};
 assert.deepEqual(evaluate({...base,backup:null},now),['backup_stale','maintenance_stale']);
 const backup=backupSummary({version:1,checkedAt:now,latestBackupAt:now-1000,purge:{failed:0},private:'CANARY'});
 assert.equal(JSON.stringify(backup).includes('CANARY'),false);assert.deepEqual(evaluate({...base,backup},now),[]);
 assert.ok(evaluate({...base,backup:{...backup,latestBackupAt:now-86400000}},now).includes('backup_stale'));
 for(const change of [{checkedAt:now-120001},{checkedAt:now+1},{purgeFailed:true}])assert.ok(evaluate({...base,backup:{...backup,...change}},now).includes('maintenance_stale'));
 assert.throws(()=>backupSummary({version:1,checkedAt:now,latestBackupAt:'wrong',purge:{failed:0}}));
});
