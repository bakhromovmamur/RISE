import * as v from '../data/validation';
import {exact} from '../contracts/personalCommands';
import {sharedId} from '../contracts/sharedContent';
import type {SquadChoices,SquadCommand} from '../contracts/squads';
import type {State} from '../model';

export interface SquadDraft {
 postId:string;postRevision:number;groupRevision:number;note:string;choices:SquadChoices;
 preview?:{id:string;hash:string};
}
export function squadDraft(value:unknown):SquadDraft {
 exact({postId:sharedId,postRevision:v.number(0,2147483647,true),groupRevision:v.number(1,2147483647,true),note:v.string(600),
  choices:exact({habits:v.bool,milestones:v.bool,prayers:v.bool}),preview:v.optional(exact({id:sharedId,hash:v.string(64,/^[0-9a-f]{64}$/)}))})(value,'squad-draft');
 return structuredClone(value) as SquadDraft;
}
/** Only the exact reviewed publish clears its authored form. Editing a draft
 * removes its preview reference; late receipts cannot erase newer private text. */
export function completedSquadDraft(state:State,command:SquadCommand,revision:number):string|null {
 if(command.kind!=='squad.publish')return null;
 for(const [key,value]of Object.entries(state.life.drafts))if(key.startsWith(`server-squad:${command.groupId}:`))try{
  const draft=squadDraft(value);if(draft.groupRevision===revision&&draft.postId===command.postId&&draft.preview?.id===command.previewId&&draft.preview.hash===command.hash)return key;
 }catch{/* Unknown recovery drafts are retained. */}
 return null;
}
