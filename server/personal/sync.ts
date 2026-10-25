import {cancelJobs} from "../push/cancellation.ts";
import { createHash } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../config.ts";
import { Sessions, AuthError } from "../auth/sessions.ts";
import { protectedSessionRoute, sessionInput } from "../auth/routes.ts";
import { exact } from "../../src/contracts/personalCommands.ts";
import { parseCursor, parseEntries, parseSyncBatch, parseSyncOperation, keyOf, type PageCursor } from "../../src/contracts/sync.ts";
import { uuid } from "../../src/contracts/accountCommands.ts";
import { personalTables, canonical } from "../../src/contracts/personalRecords.ts";
import { digest } from "../../src/data/migration.ts";
import { mergeGuestImport, recordsFromEntries, validateImportRecords } from "../../src/sync/importModel.ts";
import { receiptStatus, retention } from "./recovery.ts";
import { blockedIntent, applySyncIntent } from "../../src/sync/policy.ts";
import { hydrate } from "./records.ts";
import { localDate } from "../../src/model.ts";
import { applyPersonal, lock, revision, total } from "./repository.ts";
import { readRecords, writeRecords } from "./records.ts";
import * as v from "../../src/data/validation.ts";
import {authorizePriorityReferences,lockPriorityGroups} from '../groups/priorities.ts';

const hash=(value:unknown)=>createHash("sha256").update(canonical(value)).digest();
const id=v.string(36),integer=v.number(0,Number.MAX_SAFE_INTEGER,true),hashField=v.string(64,/^[a-f0-9]{64}$/);
function body(value:unknown,fields:Record<string,v.Check>,actor:string) {
  try{v.validateJson(value);exact({accountId:id,...fields})(value,"sync");const row=v.object(value,"sync");if(!uuid(row.accountId)||row.accountId!==actor)throw new AuthError(409,"account_changed");return row;}
  catch(error){if(error instanceof AuthError)throw error;throw new AuthError(422,"invalid_command");}
}
async function head(client:pg.PoolClient,actor:string){return{accountId:actor,initialized:(await revision(client,actor))>0,revision:await revision(client,actor),xp:await total(client,actor)};}
export async function pullPage(client:pg.PoolClient,actor:string,value:unknown){
  const row=body(value,{revision:integer,cursor:v.validateJson},actor);let cursor:PageCursor;
  try{cursor=parseCursor(row.cursor);}catch{throw new AuthError(422,"invalid_command");}
  await lock(client,actor,true);const current=await head(client,actor);if(current.revision!==row.revision)throw new AuthError(409,"cursor_stale");
  const t=personalTables[cursor.table],selection=t.columns.map(key=>`'${key}',t.${key}`).join(",");
  const available=(await client.query(`select jsonb_build_object(${selection}) as record from rise.${t.name} t where owner_id=$1 order by ${(t.order??t.keys).join(",")||"owner_id"} limit 200 offset $2`,[actor,cursor.offset])).rows.map(r=>r.record);
  const rows:unknown[]=[];let bytes=0;for(const record of available){const size=Buffer.byteLength(JSON.stringify(record))+1;if(rows.length&&bytes+size>256*1024)break;rows.push(record);bytes+=size;}
  const next:PageCursor|null=available.length===200||rows.length<available.length?{table:cursor.table,offset:cursor.offset+rows.length}:cursor.table+1<personalTables.length?{table:cursor.table+1,offset:0}:null;
  if(next&&next.offset>250000)throw new AuthError(422,"record_limit");
  return{...current,table:t.name,rows,next};
}
export async function pushBatch(client:pg.PoolClient,actor:string,value:unknown){
  let batch;try{batch=parseSyncBatch(value);}catch{throw new AuthError(422,"invalid_command");}
  if(batch.accountId!==actor)throw new AuthError(409,"account_changed");
  await lock(client,actor);await lockPriorityGroups(client,batch.operations.map(op=>op.command));const receipts=[];
  for(const operation of batch.operations){const{context,expected,observedRevision,predecessor,...command}=operation;receipts.push(await applyPersonal(client,actor,command,context,expected,{...(observedRevision!==undefined?{observedRevision}:{}),...(predecessor?{predecessor}:{})}));}
  return{accountId:actor,revision:await revision(client,actor),receipts};
}
export async function reviewIntent(client:pg.PoolClient,actor:string,value:unknown){
  const row=body(value,{revision:integer,operation:v.validateJson},actor);
  let operation;try{operation=parseSyncOperation(row.operation);}catch{throw new AuthError(422,"invalid_command");}
  await lock(client,actor);if(await revision(client,actor)!==row.revision)throw new AuthError(409,"cursor_stale");
  const prior=await receiptStatus(client,actor,operation),state=hydrate(await readRecords(client,actor));
  let permitted=prior==="unknown"&&!blockedIntent(state,operation.command),reason=prior;
  const now=Date.now(),context={now,date:localDate(state.timezone,new Date(now)),timezone:state.timezone};
  const command=operation.command.kind==="habit.check"?{...operation.command,kind:"habit.correct" as const}:operation.command;
  if(permitted)try{applySyncIntent(state,command,context,await authorizePriorityReferences(client,state,command));}catch{permitted=false;reason="invalid";}
  if(!permitted&&prior==="unknown")reason="unavailable";
  return{accountId:actor,revision:Number(row.revision),operationId:operation.operationId,canReapply:permitted,reason};
}
/** Compact deltas, pinned to a coherent head. Keys are safe fixed-table primary keys. */
export async function changePage(client:pg.PoolClient,actor:string,value:unknown){
  const row=body(value,{since:integer,revision:integer,offset:v.number(0,250000,true)},actor);
  await lock(client,actor);const floor=await retention(client,actor),current=await head(client,actor);
  if(row.revision!==current.revision)throw new AuthError(409,"cursor_stale");
  if(Number(row.since)<floor)throw new AuthError(409,"rebase_required");
  if(Number(row.since)>current.revision)throw new AuthError(422,"invalid_command");
  const rows=(await client.query("select table_name,record_key,revision,deleted from rise.sync_changes where owner_id=$1 and revision>$2 order by revision,table_name,record_key limit 200 offset $3",[actor,row.since,row.offset])).rows;
  const records=await readRecords(client,actor),entries=[];let bytes=0;
  for(const r of rows){const record=r.deleted?null:records[r.table_name].find(record=>keyOf(r.table_name,record)===r.record_key);if(record===undefined)throw new Error("invalid_change");const entry={table:r.table_name,key:r.record_key,revision:Number(r.revision),row:record},size=Buffer.byteLength(JSON.stringify(entry));if(entries.length&&bytes+size>256*1024)break;entries.push(entry);bytes+=size;}
  return{accountId:actor,revision:current.revision,entries,next:rows.length===200||entries.length<rows.length?Number(row.offset)+entries.length:null};
}
interface Plan{base_revision:string;source_hash:string;provenance:string;pages:number;committed_revision:string|null;active:boolean}
async function plan(client:pg.PoolClient,actor:string,importId:unknown){
  if(!uuid(importId))throw new AuthError(422,"invalid_command");
  const result=await client.query<Plan>("select *,expires_at>now() as active from rise.sync_imports where owner_id=$1 and id=$2 for update",[actor,importId]);
  const row=result.rows[0];if(!row||!row.active)throw new AuthError(409,"import_expired");return row;
}
export async function beginImport(client:pg.PoolClient,actor:string,value:unknown){
  const row=body(value,{importId:id,baseRevision:integer,sourceHash:hashField,provenance:v.oneOf("new","demo-or-mixed","unverified-legacy"),pages:v.number(1,2500,true),consent:v.oneOf(true)},actor);
  if(!uuid(row.importId))throw new AuthError(422,"invalid_command");
  await lock(client,actor);
  await client.query("delete from rise.sync_imports where owner_id=$1 and committed_revision is null and expires_at<=now()",[actor]);
  const existing=(await client.query<Plan>("select * from rise.sync_imports where owner_id=$1 and id=$2",[actor,row.importId])).rows[0];
  if(existing){if(existing.source_hash!==row.sourceHash||Number(existing.base_revision)!==row.baseRevision||existing.pages!==row.pages||existing.provenance!==row.provenance)throw new AuthError(409,"operation_reused");return{importId:row.importId};}
  if((await revision(client,actor))!==row.baseRevision)throw new AuthError(409,"revision_conflict");
  const count=Number((await client.query("select count(*) from rise.sync_imports where owner_id=$1 and committed_revision is null and expires_at>now()",[actor])).rows[0].count);if(count>=3)throw new AuthError(429,"import_limit",60);
  await client.query("insert into rise.sync_imports(owner_id,id,base_revision,source_hash,provenance,pages) values($1,$2,$3,$4,$5,$6)",[actor,row.importId,row.baseRevision,row.sourceHash,row.provenance,row.pages]);
  return{importId:row.importId};
}
export async function importPage(client:pg.PoolClient,actor:string,value:unknown){
  const row=body(value,{importId:id,page:v.number(0,2499,true),entries:v.validateJson},actor),current=await plan(client,actor,row.importId);
  let entries;try{entries=parseEntries(row.entries);}catch{throw new AuthError(422,"invalid_command");}
  if(!entries.length||Number(row.page)>=current.pages||current.committed_revision)throw new AuthError(409,"import_state");
  const old=(await client.query("select data from rise.sync_import_pages where owner_id=$1 and import_id=$2 and page=$3",[actor,row.importId,row.page])).rows[0];
  if(old){if(canonical(old.data)!==canonical(entries))throw new AuthError(409,"operation_reused");return{page:row.page};}
  const bytes=Number((await client.query("select coalesce(sum(octet_length(data::text)),0) as bytes from rise.sync_import_pages where owner_id=$1 and import_id=$2",[actor,row.importId])).rows[0].bytes);
  if(bytes+Buffer.byteLength(JSON.stringify(entries))>50*1024*1024)throw new AuthError(422,"import_limit");
  await client.query("insert into rise.sync_import_pages(owner_id,import_id,page,data) values($1,$2,$3,$4)",[actor,row.importId,row.page,JSON.stringify(entries)]);return{page:row.page};
}
async function imported(client:pg.PoolClient,actor:string,importId:unknown,current:Plan){
  const pages=await client.query("select page,data from rise.sync_import_pages where owner_id=$1 and import_id=$2 order by page",[actor,importId]);
  if(pages.rowCount!==current.pages||pages.rows.some((r,i)=>r.page!==i))throw new AuthError(409,"import_incomplete");
  try{const records=recordsFromEntries(pages.rows.flatMap(r=>parseEntries(r.data)));validateImportRecords(records);if(await digest(canonical(records))!==current.source_hash)throw new Error("import_hash");return records;}
  catch{throw new AuthError(422,"invalid_import");}
}
export async function previewImport(client:pg.PoolClient,actor:string,value:unknown){
  const row=body(value,{importId:id},actor);await lock(client,actor,true);const current=await plan(client,actor,row.importId),rev=await revision(client,actor);
  if(Number(current.base_revision)!==rev)throw new AuthError(409,"revision_conflict");
  const records=await imported(client,actor,row.importId,current),before=rev?await readRecords(client,actor):{};
  try{const merged=mergeGuestImport(before,records);return{accountId:actor,importId:row.importId,revision:rev,added:merged.added,kept:merged.kept,xpAdded:merged.xpAdded};}
  catch{throw new AuthError(422,"invalid_import");}
}
export async function commitImport(client:pg.PoolClient,actor:string,value:unknown){
  const row=body(value,{importId:id,baseRevision:integer,sourceHash:hashField,keepExisting:v.oneOf(true)},actor);if(!uuid(row.importId))throw new AuthError(422,"invalid_command");
  await lock(client,actor);const requestHash=hash(row),revisionNow=await revision(client,actor);
  const prior=(await client.query("select request_hash,result,revision from rise.personal_receipts where owner_id=$1 and operation_id=$2",[actor,row.importId])).rows[0];
  if(prior){if(!Buffer.from(prior.request_hash).equals(requestHash))throw new AuthError(409,"operation_reused");const result=v.object(prior.result,"receipt");exact({operationId:id,operationRevision:v.number(1,Number.MAX_SAFE_INTEGER,true),xp:integer})(result,"receipt");if(result.operationId!==row.importId||result.operationRevision!==Number(prior.revision)||Number(result.operationRevision)>revisionNow)throw new Error("invalid_import_receipt");return{operationId:result.operationId,operationRevision:result.operationRevision,xp:result.xp,replayed:true};}
  const current=await plan(client,actor,row.importId);if(current.source_hash!==row.sourceHash||Number(current.base_revision)!==row.baseRevision)throw new AuthError(409,"operation_reused");
  if(revisionNow!==row.baseRevision||revisionNow===Number.MAX_SAFE_INTEGER)throw new AuthError(409,"revision_conflict");
  const records=await imported(client,actor,row.importId,current),before=revisionNow?await readRecords(client,actor):{};
  let merged;try{merged=mergeGuestImport(before,records);}catch{throw new AuthError(422,"invalid_import");}
  await cancelJobs(client,actor,null);
  const nextRevision=revisionNow+1;await writeRecords(client,actor,nextRevision,before,merged.records);
  const result={operationId:row.importId,operationRevision:nextRevision,xp:await total(client,actor)};
  await client.query("insert into rise.personal_receipts(owner_id,operation_id,request_hash,result,revision) values($1,$2,$3,$4,$5)",[actor,row.importId,requestHash,result,nextRevision]);
  await client.query("update rise.sync_imports set committed_revision=$3,result=$4 where owner_id=$1 and id=$2",[actor,row.importId,nextRevision,result]);
  await client.query("delete from rise.sync_import_pages where owner_id=$1 and import_id=$2",[actor,row.importId]);return{...result,replayed:false};
}
export async function cancelImport(client:pg.PoolClient,actor:string,value:unknown){
  const row=body(value,{importId:id},actor);if(!uuid(row.importId))throw new AuthError(422,"invalid_command");
  await lock(client,actor);
  await client.query("delete from rise.sync_imports where owner_id=$1 and id=$2 and committed_revision is null",[actor,row.importId]);
  return{cancelled:true};
}
export function syncRoutes(app:FastifyInstance,config:ServerConfig,sessions:Sessions){
  app.get("/api/v1/sync/head",protectedSessionRoute(config,request=>sessions.asActor(sessionInput(request,config),false,async(client,actor)=>{await lock(client,actor,true);return head(client,actor);}),false,"sync"));
  const routes:[string,number,(c:pg.PoolClient,a:string,v:unknown)=>Promise<unknown>][]=[
    ["review",256*1024,reviewIntent],["changes",2048,changePage],["pull",2048,pullPage],["commands",512*1024,pushBatch],["imports",2048,beginImport],["imports/page",512*1024,importPage],["imports/preview",2048,previewImport],["imports/commit",2048,commitImport],["imports/cancel",2048,cancelImport],
  ];
  for(const[path,bodyLimit,run]of routes)app.post(`/api/v1/sync/${path}`,{bodyLimit},protectedSessionRoute(config,request=>sessions.asActor(sessionInput(request,config),true,(client,actor)=>run(client,actor,request.body)),true,"sync"));
}
