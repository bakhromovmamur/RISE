import type pg from 'pg';
import {parseSharedQuery,parseSharedPage,type SharedPage} from '../../src/contracts/sharedContent.ts';
import {StoredDataError} from '../../src/data/validation.ts';
import {AuthError} from '../auth/sessions.ts';
import {sharedProjection} from './projections.ts';

/** Every page is one database snapshot, including membership, revision and rows.
 * A subsequent page must assert that revision; clients restart on a conflict. */
export async function readSharedContent(c:pg.PoolClient,actor:string,value:unknown):Promise<SharedPage>{
 let q;try{q=parseSharedQuery(value);}catch(error){if(error instanceof StoredDataError)throw new AuthError(422,'invalid_input');throw error;}
 const params:unknown[]=[q.groupId],bind=(v:unknown)=>{params.push(v);return `$${params.length}`;};
 let table:string,fields:string,filter='',order:string,parent='true',cursor:string;

 switch(q.collection){
  case 'tasks':
   table='family_tasks';fields=sharedProjection.tasks;
   order='r.id';cursor='r.id::text';if(q.cursor)filter=`and r.id>${bind(q.cursor)}::uuid`;break;
  case 'lists':
   table='shared_lists';fields=sharedProjection.lists;order='r.id';cursor='r.id::text';if(q.cursor)filter=`and r.id>${bind(q.cursor)}::uuid`;break;
  case 'items':{
   table='shared_items';fields=sharedProjection.items;
   const id=bind(q.parentId);filter=`and r.list_id=${id}::uuid and not r.removed`;parent=`exists(select 1 from rise.shared_lists p where p.group_id=g.id and p.id=${id}::uuid)`;
   order='r.position';cursor='r.position::text';if(q.cursor)filter+=` and r.position>${bind(Number(q.cursor))}::integer`;break;
  }
  case 'occurrences':{
   table='task_occurrences';fields=sharedProjection.occurrences;
   order='r.date,r.task_id';cursor=`to_char(r.date,'YYYY-MM-DD')||'/'||r.task_id::text`;
   if(q.parentId){const id=bind(q.parentId);filter+=` and r.task_id=${id}::uuid`;parent=`exists(select 1 from rise.family_tasks p where p.group_id=g.id and p.id=${id}::uuid)`;}
   if(q.date)filter+=` and r.date=${bind(q.date)}::date`;
   if(q.cursor){const [date,id]=q.cursor.split('/');filter+=` and (r.date,r.task_id)>(${bind(date)}::date,${bind(id)}::uuid)`;}break;
  }
 }
 const result=await c.query<{revision:number;parent:boolean;rows:{value:unknown;cursor:string}[]}>(`select g.revision,${parent} as parent,
  (select coalesce(jsonb_agg(page),'[]'::jsonb) from (select jsonb_build_object(${fields}) as value,${cursor} as cursor
   from rise.${table} r where r.group_id=g.id ${filter} order by ${order} limit 51) page) as rows
  from rise.groups g where g.id=$1::uuid and g.kind='family'`,params);
 const head=result.rows[0];if(!head)throw new AuthError(404,'group_unavailable');
 if(q.revision!==undefined&&q.revision!==head.revision)throw new AuthError(409,'group_changed');
 if(!head.parent)throw new AuthError(404,'shared_unavailable');
 const rows=head.rows.slice(0,50);
 return parseSharedPage({accountId:actor,groupId:q.groupId,revision:head.revision,collection:q.collection,rows:rows.map(r=>r.value),next:head.rows.length>50?rows.at(-1)!.cursor:null});
}
