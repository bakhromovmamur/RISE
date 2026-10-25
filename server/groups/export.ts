import type pg from 'pg';
import {createGroupArchive,parseGroupArchiveRequest,type ArchiveGroup} from '../../src/contracts/groupArchive.ts';
import {sharedId} from '../../src/contracts/sharedContent.ts';
import {MAX_BYTES,StoredDataError} from '../../src/data/validation.ts';
import {AuthError} from '../auth/sessions.ts';
import {lock} from '../personal/repository.ts';
import {recentAuthentication} from '../lifecycle/repository.ts';
import {sharedProjection,squadProjection} from './projections.ts';

const PAGE_SIZE=200;
interface ArchivePage {revision:number;rows:{value:unknown;cursor:string}[]}
const collections={
 tasks:{table:'family_tasks',fields:sharedProjection.tasks,alias:'r',order:'r.id',cursor:'r.id::text',after:'r.id>$3::uuid',filter:'',records:1},
 lists:{table:'shared_lists',fields:sharedProjection.lists,alias:'r',order:'r.id',cursor:'r.id::text',after:'r.id>$3::uuid',filter:'',records:1},
 items:{table:'shared_items',fields:sharedProjection.items,alias:'r',order:'r.id',cursor:'r.id::text',after:'r.id>$3::uuid',filter:'and not r.removed',records:1},
 occurrences:{table:'task_occurrences',fields:sharedProjection.occurrences,alias:'r',order:'r.date,r.task_id',cursor:"to_char(r.date,'YYYY-MM-DD')||'/'||r.task_id::text",after:"(r.date,r.task_id)>(split_part($3,'/',1)::date,split_part($3,'/',2)::uuid)",filter:'',records:2},
 posts:{table:'squad_posts',fields:squadProjection('$2'),alias:'p',order:'p.id',cursor:'p.id::text',after:'p.id>$3::uuid',filter:'',records:3},
};
async function head(c:pg.PoolClient,actor:string,id:string,expected:number){
 const row=(await c.query<{group:ArchiveGroup;time:string}>(`select jsonb_build_object('id',g.id,'kind',g.kind,'name',g.name,'timezone',g.timezone,'revision',g.revision,'archived',g.archived,
  'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name,'role',case when m.user_id=g.owner_id then 'owner' else 'member' end,'self',m.user_id=$2) order by m.joined_at,m.id),'[]'::jsonb) from rise.memberships m where m.group_id=g.id)) as "group",
  to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as time from rise.groups g where g.id=$1`,[id,actor])).rows[0];
 if(!row)throw new AuthError(404,'group_unavailable');if(row.group.revision!==expected)throw new AuthError(409,'group_changed');return row;
}
/** Complete, bounded, current-member snapshot. Every statement uses existing
 * RLS; monotonic revision checks reject intervening edits/removal. No elevated
 * role, group write grant, retained file, receipt or private-data read. */
export async function exportGroup(c:pg.PoolClient,actor:string,id:unknown,value:unknown):Promise<string>{
 let input;try{sharedId(id,'group');input=parseGroupArchiveRequest(value);}catch(error){if(error instanceof StoredDataError)throw new AuthError(422,'invalid_input');throw error;}
 if(input.accountId!==actor)throw new AuthError(409,'account_changed');
 await lock(c,actor,true);await recentAuthentication(c,actor);
 const first=await head(c,actor,String(id),input.revision),group=first.group;
 const content:Record<string,unknown>={kind:group.kind};
 const keys=group.kind==='family'?['tasks','lists','items','occurrences'] as const:['posts'] as const;
 for(const key of keys)content[key]=[];
 const payload={format:'rise.group-archive',version:1,exportedAt:first.time,group,content};
 let bytes=Buffer.byteLength(JSON.stringify({...payload,checksum:{algorithm:'SHA-256',value:'0'.repeat(64)}})),records=4+group.members.length;
 for(const key of keys){
  const projection=collections[key],rows:unknown[]=[];let cursor:string|null=null;
  while(true){
   // Keep the explicit group parameter inside the page. Correlating only on
   // g.id hides its distribution from the planner and can sort all history
   // before LIMIT; current RLS still applies to both the head and every row.
   const result:ArchivePage|undefined=(await c.query<ArchivePage>(`select g.revision,
    (select coalesce(jsonb_agg(page),'[]'::jsonb) from (select jsonb_build_object(${projection.fields}) as value,${projection.cursor} as cursor
     from rise.${projection.table} ${projection.alias} where ${projection.alias}.group_id=$1::uuid ${projection.filter}
      and ($3::text is null or ${projection.after}) order by ${projection.order} limit ${PAGE_SIZE}) page) as rows
    from rise.groups g where g.id=$1 and $2::uuid is not null`,[id,actor,cursor])).rows[0];
   if(!result)throw new AuthError(404,'group_unavailable');if(result.revision!==input.revision)throw new AuthError(409,'group_changed');
   for(const row of result.rows){
    bytes+=Buffer.byteLength(JSON.stringify(row.value))+(rows.length?1:0);records+=projection.records;
    if(bytes>MAX_BYTES||records>250000)throw new AuthError(422,'export_too_large');rows.push(row.value);
   }
   if(result.rows.length<PAGE_SIZE)break;cursor=result.rows.at(-1)!.cursor;
  }
  content[key]=rows;
 }
 let raw:string;
 try{raw=await createGroupArchive(payload);}catch(error){if(error instanceof StoredDataError&&['size limit','record limit'].includes(error.path))throw new AuthError(422,'export_too_large');throw error;}
 // Hashing/validation also takes time. Recheck after it, immediately before the
 // caller's final verified-session check and transaction completion.
 await head(c,actor,String(id),input.revision);await recentAuthentication(c,actor);return raw;
}
