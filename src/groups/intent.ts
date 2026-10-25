import type {State} from '../model';
import type {PendingGroupIntent} from '../contracts/groups';
import {isSharedCommand} from '../contracts/sharedContent';
import {completedSharedDraft} from './sharedDrafts';
import {isSquadCommand} from '../contracts/squads';
import {completedSquadDraft} from './squadDrafts';
/** Device-only operational draft. Unknown drafts are excluded from portable
 * backups; never place invitation tokens or received group content here. */
export const GROUP_INTENT_KEY='server-group-intent';
export const groupIntentPending=(state:Pick<State,'life'>|null|undefined)=>state&&Object.hasOwn(state.life.drafts,GROUP_INTENT_KEY)?1:0;
/** Clear only the form that produced this exact accepted action. Another tab's
 * newer form, or an unrelated notification preference draft, must survive. */
export function completedGroupDraft(state:State,intent:PendingGroupIntent|null):string|null{
 if(intent?.type!=='command')return null;const {command,expectedRevision}=intent.operation;
 if(isSharedCommand(command))return completedSharedDraft(state,command,expectedRevision);
 if(isSquadCommand(command))return completedSquadDraft(state,command,expectedRevision);
 const key=command.kind==='group.create'?`server-group-create:${command.groupKind}`:command.kind==='group.rename'?`server-group-name:${command.groupId}`:command.kind==='group.preferences'?`server-group-preferences:${command.groupId}`:null;
 if(!key)return null;const raw=state.life.drafts[key];if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const d=raw as Record<string,unknown>;
 if(command.kind==='group.create'&&Object.keys(d).length===3&&typeof d.name==='string'&&d.name.trim()===command.name&&typeof d.nickname==='string'&&d.nickname.trim()===command.nickname&&typeof d.timezone==='string'&&d.timezone.trim()===command.timezone)return key;
 if(command.kind==='group.rename'&&Object.keys(d).length===2&&typeof d.name==='string'&&d.name.trim()===command.name&&d.revision===expectedRevision)return key;
 if(command.kind==='group.preferences'&&d.muted===command.muted&&d.quietStart===command.quietStart&&d.quietEnd===command.quietEnd&&d.revision===expectedRevision){
  // Old immutable operations cannot erase a newer explicit notification choice.
  const legacy=Object.keys(d).length===4&&!Object.hasOwn(d,'notifications');
  if(command.notifications===undefined?legacy:legacy&&command.notifications===false||Object.keys(d).length===5&&d.notifications===command.notifications)return key;
 }
 return null;
}
