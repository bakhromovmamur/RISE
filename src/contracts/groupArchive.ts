import * as v from '../data/validation';
import {exact} from './personalCommands';
import {groupLabelCheck,groupMemberCheck,type AccountGroup} from './groups';
import {sharedId,sharedRowChecks,type SharedTask,type SharedList,type SharedItem,type SharedOccurrence} from './sharedContent';
import {squadPostCheck,type SquadPost} from './squads';
import {contentHash} from '../data/backup';

export type ArchiveGroup=Pick<AccountGroup,'id'|'kind'|'name'|'timezone'|'revision'|'archived'|'members'>;
export type ArchiveContent={kind:'family';tasks:SharedTask[];lists:SharedList[];items:SharedItem[];occurrences:SharedOccurrence[]}|{kind:'squad';posts:SquadPost[]};
export interface GroupArchivePayload {format:'rise.group-archive';version:1;exportedAt:string;group:ArchiveGroup;content:ArchiveContent}
export interface GroupArchive extends GroupArchivePayload {checksum:{algorithm:'SHA-256';value:string}}
const revision=v.number(1,2147483647,true);
const groupCheck=exact({id:sharedId,kind:v.oneOf('family','squad'),name:groupLabelCheck,timezone:v.zone,revision,archived:v.bool,members:v.array(groupMemberCheck,500)});
const contentCheck:v.Check=(value,path)=>{
 const row=v.object(value,path);
 if(row.kind==='family')exact({kind:v.oneOf('family'),tasks:v.array(sharedRowChecks.tasks,5000),lists:v.array(sharedRowChecks.lists,1000),items:v.array(sharedRowChecks.items),occurrences:v.array(sharedRowChecks.occurrences)})(value,path);
 else exact({kind:v.oneOf('squad'),posts:v.array(squadPostCheck)})(value,path);
};
const fields={format:v.oneOf('rise.group-archive'),version:v.oneOf(1),exportedAt:v.instant,group:groupCheck,content:contentCheck};
export function parseGroupArchiveRequest(value:unknown):{accountId:string;revision:number}{
 v.validateJson(value);exact({accountId:sharedId,revision})(value,'group-export');return value as {accountId:string;revision:number};
}
function references(archive:GroupArchivePayload){
 const {group,content}=archive,fail=()=>{throw new v.StoredDataError('group-archive.references');};
 const unique=(ids:string[])=>{if(new Set(ids).size!==ids.length)fail();};
 unique(group.members.map(m=>m.id));
 if(group.kind!==content.kind||group.members.filter(m=>m.self).length!==1||group.members.filter(m=>m.role==='owner').length!==1)fail();
 const rows=content.kind==='family'?[...content.tasks,...content.lists,...content.items,...content.occurrences]:content.posts;
 if(rows.some(row=>row.groupId!==group.id||row.revision>group.revision))fail();
 if(content.kind==='family'){
  unique(content.tasks.map(t=>t.id));unique(content.lists.map(l=>l.id));unique(content.items.map(i=>i.id));
  unique(content.items.map(i=>`${i.listId}/${i.position}`));unique(content.occurrences.map(o=>`${o.taskId}/${o.date}`));
  const tasks=new Map(content.tasks.map(t=>[t.id,t])),lists=new Set(content.lists.map(l=>l.id));
  if(content.items.some(i=>!lists.has(i.listId)))fail();
  for(const row of content.occurrences){const task=tasks.get(row.taskId);
   if(!task||row.snapshot.taskRevision>task.revision||row.snapshot.taskRevision>row.revision
    ||row.completed!==(row.byMemberId!==null&&row.at!==null)||!row.completed&&(row.byMemberId!==null||row.at!==null))fail();
  }
  // Historical assignment/completion IDs deliberately remain opaque when a
  // member has left or been deleted. Never expand current-member RLS for names.
 }else{
  unique(content.posts.map(p=>p.id));
  if(content.posts.some(p=>p.reactions.mine&&p.reactions.count===0||Date.parse(p.updatedAt)<Date.parse(p.publishedAt)))fail();
 }
}
export async function createGroupArchive(value:unknown):Promise<string>{
 v.validateJson(value);exact(fields)(value,'group-archive');const payload=value as GroupArchivePayload;references(payload);
 const raw=JSON.stringify({...payload,checksum:{algorithm:'SHA-256',value:await contentHash(payload)}});v.parseJson(raw);return raw;
}
export async function parseGroupArchive(raw:string):Promise<GroupArchive>{
 const value=v.parseJson(raw);exact({...fields,checksum:exact({algorithm:v.oneOf('SHA-256'),value:v.string(64,/^[a-f0-9]{64}$/)})})(value,'group-archive');
 const archive=value as GroupArchive;references(archive);const {checksum,...payload}=archive;
 if(await contentHash(payload)!==checksum.value)throw new v.StoredDataError('checksum mismatch');return archive;
}
