import type pg from 'pg';
import type {State} from '../../src/model.ts';
import type {AccountCommand} from '../../src/contracts/accountCommands.ts';
import {newSharedPriorities,requestedSharedPriorities} from '../../src/domain/priorityReferences.ts';
import {priorityKey} from '../../src/developmentModel.ts';
import {AuthError} from '../auth/sessions.ts';

/** Called under the actor lock, before any operation in a personal batch. */
export async function lockPriorityGroups(c:pg.PoolClient,commands:AccountCommand[]){
 const groups=[...new Set(commands.flatMap(requestedSharedPriorities).map(p=>p.groupId))].sort();
 if(groups.length)await c.query('select rise_private.lock_shared_priority_groups($1::uuid[])',[groups]);
}
/** Retained selections stay removable/reorderable after loss of access. Only
 * newly selected opaque references require current shared authorization. */
export async function authorizePriorityReferences(c:pg.PoolClient,state:State,command:AccountCommand):Promise<ReadonlySet<string>>{
 const fresh=newSharedPriorities(state,command);
 if(!fresh.length)return new Set();
 const refs=fresh.map(({groupId,taskId,date})=>({groupId,taskId,date}));
 const allowed=(await c.query<{allowed:boolean}>('select rise_private.authorize_shared_priorities($1::jsonb) as allowed',[JSON.stringify(refs)])).rows[0]?.allowed;
 if(!allowed)throw new AuthError(409,'entity_unavailable');
 return new Set(fresh.map(priorityKey));
}
