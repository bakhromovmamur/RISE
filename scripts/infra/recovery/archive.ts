import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {lstat,readFile,open,mkdir,chmod,readdir,unlink} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
export const DAY=86400000, MAX_ARCHIVE=128*1024*1024;
const magic=Buffer.from('RISEBA01');
export interface RecoveryArchive {
 version:1; environment:'local'|'test'; installationId:string; capturedAt:number; completedAt:number;
 migrations:string; roles:string[]; dump:string;
}
export function validateArchive(value:unknown,environment:'local'|'test',installationId:string,now=Date.now()):RecoveryArchive{
 if(!value||typeof value!=='object')throw new Error('backup_invalid');
 const a=value as Partial<RecoveryArchive>;
 if(a.version!==1||a.environment!==environment||a.installationId!==installationId||!Number.isSafeInteger(a.capturedAt)||!Number.isSafeInteger(a.completedAt)||a.capturedAt!>now||a.completedAt!>now+5000||a.completedAt!<a.capturedAt!||now-a.capturedAt!>=30*DAY||!/^[a-f0-9]{64}$/.test(a.migrations??'')||!Array.isArray(a.roles)||a.roles.length>200||a.roles.some(r=>typeof r!=='string'||! /^[a-z][a-z0-9_]{0,62}$/.test(r))||typeof a.dump!=='string'||a.dump.length>96*1024*1024||!/^UEdETVA[A-Za-z0-9+/]*={0,2}$/.test(a.dump))throw new Error('backup_invalid_expired_or_wrong_installation');
 return a as RecoveryArchive;
}
export function seal(value:RecoveryArchive,key:Buffer){
 if(key.length!==32)throw new Error('backup_key_invalid');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(magic);
 const bytes=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
 return Buffer.concat([magic,iv,cipher.getAuthTag(),bytes]);
}
export function unseal(bytes:Buffer,key:Buffer):unknown{
 if(bytes.length>MAX_ARCHIVE||bytes.length<37||!bytes.subarray(0,8).equals(magic)||key.length!==32)throw new Error('backup_invalid');
 const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(8,20));decipher.setAAD(magic);decipher.setAuthTag(bytes.subarray(20,36));
 return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(36)),decipher.final()]).toString('utf8'));
}
export async function privateBytes(path:string){
 const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)!==0||info.size>MAX_ARCHIVE)throw new Error('private_backup_file_required');
 return readFile(path);
}
export async function backupKey(path:string,create=false){
 try{const key=await privateBytes(path);if(key.length!==32)throw new Error('backup_key_invalid');return key;}
 catch(error){if(!create||(error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 await mkdir(dirname(path),{recursive:true,mode:0o700});await chmod(dirname(path),0o700);
 const key=randomBytes(32),file=await open(path,'wx',0o600);try{await file.writeFile(key);await file.sync();}finally{await file.close();}return key;
}
/** Authenticate even expired archives before considering removal. Corrupt files remain for review. */
export async function expireBackups(directory:string,key:Buffer,environment:'local'|'test',installationId:string,now=Date.now()){
 let removed=0;
 for(const name of await readdir(directory)){
  if(!/^[0-9]{13}-[a-f0-9-]{36}\.risebackup$/.test(name))continue;
  const path=resolve(directory,name),value=unseal(await privateBytes(path),key);
  if(!value||typeof value!=='object'||!('capturedAt'in value)||typeof value.capturedAt!=='number')throw new Error('backup_invalid');
  // Validate at capture time so only the age rule is relaxed for expiry.
  const archive=validateArchive(value,environment,installationId,Math.max(value.capturedAt,('completedAt'in value&&typeof value.completedAt==='number'?value.completedAt:0))); 
  if(now<archive.capturedAt)throw new Error('backup_clock_moved_back');
  if(now-archive.capturedAt>=30*DAY){await unlink(path);removed++;}
 }
 return removed;
}
