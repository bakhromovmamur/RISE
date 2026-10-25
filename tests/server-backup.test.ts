import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {backupKey,seal,unseal,validateArchive,expireBackups,DAY,type RecoveryArchive} from '../scripts/infra/recovery/archive.ts';
const sample=(now=Date.now()):RecoveryArchive=>({version:1,environment:'test',installationId:randomUUID(),capturedAt:now-10000,completedAt:now,migrations:'a'.repeat(64),roles:['rise_bff'],dump:Buffer.from('PGDMP synthetic private CANARY').toString('base64')});
test('encrypted recovery binds every byte; wrong keys, tampering, truncation and hostile archives fail closed',()=>{
 const a=sample(),key=randomBytes(32),bytes=seal(a,key);assert.equal(bytes.includes('CANARY'),false);assert.deepEqual(validateArchive(unseal(bytes,key),'test',a.installationId),a);
 assert.throws(()=>unseal(bytes,randomBytes(32)));for(const index of [0,9,22,bytes.length-1]){const bad=Buffer.from(bytes);bad[index]^=1;assert.throws(()=>unseal(bad,key));}assert.throws(()=>unseal(bytes.subarray(0,-1),key));
 for(const bad of [{...a,version:2},{...a,roles:['postgres; drop database postgres']},{...a,completedAt:a.capturedAt-1},{...a,dump:'unknown'},null])assert.throws(()=>validateArchive(bad,'test',a.installationId));
 assert.throws(()=>validateArchive(a,'local',a.installationId));assert.throws(()=>validateArchive(a,'test',randomUUID()));assert.throws(()=>validateArchive(a,'test',a.installationId,a.capturedAt+30*DAY));assert.throws(()=>validateArchive(a,'test',a.installationId,a.capturedAt-1));
});
test('separate keys persist; missing/corrupt keys are not silently replaced',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'rise-backup-key-'));t.after(()=>rm(dir,{recursive:true,force:true}));const path=join(dir,'key');
 await assert.rejects(backupKey(path));const key=await backupKey(path,true);assert.deepEqual(await backupKey(path),key);
 await writeFile(path,'corrupt',{mode:0o600});await assert.rejects(backupKey(path,true));assert.equal(await readFile(path,'utf8'),'corrupt');await chmod(path,0o644);await assert.rejects(backupKey(path));
});
test('rolling expiry deletes only authenticated installation archives; corruption is preserved for review',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'rise-backup-expiry-'));t.after(()=>rm(dir,{recursive:true,force:true}));const key=randomBytes(32),now=Date.now(),old=sample(now-30*DAY),fresh={...sample(now),installationId:old.installationId};
 const filename=(a:RecoveryArchive)=>join(dir,`${a.capturedAt}-${randomUUID()}.risebackup`),oldPath=filename(old),freshPath=filename(fresh);
 await writeFile(oldPath,seal(old,key),{mode:0o600});await writeFile(freshPath,seal(fresh,key),{mode:0o600});await writeFile(join(dir,'unrelated.json'),'preserve');
 assert.equal(await expireBackups(dir,key,'test',old.installationId,now),1);await assert.rejects(readFile(oldPath));assert.deepEqual(unseal(await readFile(freshPath),key),fresh);assert.equal(await readFile(join(dir,'unrelated.json'),'utf8'),'preserve');
 await assert.rejects(expireBackups(dir,key,'test',old.installationId,fresh.capturedAt-1));
 const corrupt=filename(old);await writeFile(corrupt,'corrupt',{mode:0o600});await assert.rejects(expireBackups(dir,key,'test',old.installationId,now));assert.equal(await readFile(corrupt,'utf8'),'corrupt');
});
