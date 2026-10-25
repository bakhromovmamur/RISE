import * as v from '../data/validation';
import {exact} from './personalCommands';
import {sharedId} from './sharedContent';
import {weekday} from '../domain/calendar';

/** This is the entire shared payload. Account/source metadata never belongs here. */
export interface SquadSnapshot {week:string;note:string;habits?:number;milestones?:string[];prayers?:number}
export interface SquadChoices {habits:boolean;milestones:boolean;prayers:boolean}
export interface SquadPreviewRequest {
 accountId:string;groupId:string;postId:string;groupRevision:number;postRevision:number;personalRevision:number;
 week:string;note:string;choices:SquadChoices;
}
export interface SquadPreview {
 accountId:string;groupId:string;postId:string;previewId:string;groupRevision:number;postRevision:number;sourceRevision:number;
 expiresAt:string;hash:string;snapshot:SquadSnapshot;
}
export type SquadCommand=
 | {kind:'squad.publish';groupId:string;postId:string;previewId:string;hash:string}
 | {kind:'squad.withdraw'|'squad.remove';groupId:string;postId:string}
 | {kind:'squad.react';groupId:string;postId:string;encourage:boolean};
export interface SquadPost {
 id:string;groupId:string;authorMemberId:string;revision:number;publishedAt:string;updatedAt:string;
 snapshot:SquadSnapshot;reactions:{count:number;mine:boolean};
}
export interface SquadQuery {groupId:string;week:string;authorMemberId?:string;cursor?:string;revision?:number}
export interface SquadPage {accountId:string;groupId:string;revision:number;week:string;rows:SquadPost[];next:string|null}
const revision=v.number(1,2147483647,true),postRevision=v.number(0,2147483647,true);
const personalRevision=v.number(1,Number.MAX_SAFE_INTEGER,true),hash=v.string(64,/^[0-9a-f]{64}$/);
const week:v.Check=(x,p)=>{v.date(x,p);if(typeof x!=='string'||x.startsWith('0000-')||weekday(x)!==1)throw new v.StoredDataError(p);};
const plain=(maximum:number):v.Check=>(x,p)=>{v.string(maximum)(x,p);if(typeof x!=='string'||[...x].some(c=>(c.charCodeAt(0)<32&&!['\n','\t'].includes(c))||c.charCodeAt(0)===127))throw new v.StoredDataError(p);};
const title:v.Check=(x,p)=>{plain(160)(x,p);if(typeof x!=='string'||!x.trim())throw new v.StoredDataError(p);};
const snapshot:v.Check=(x,p)=>{
 exact({week,note:plain(600),habits:v.optional(v.number(0,1000000,true)),milestones:v.optional(v.array(title,100)),prayers:v.optional(v.number(0,35,true))})(x,p);
 const row=v.object(x,p);if(!String(row.note).trim()&&row.habits===undefined&&row.milestones===undefined&&row.prayers===undefined)throw new v.StoredDataError(p);
};
const choices=exact({habits:v.bool,milestones:v.bool,prayers:v.bool});
const ref={groupId:sharedId,postId:sharedId};
export const squadValidators:Record<SquadCommand['kind'],Record<string,v.Check>>={
 'squad.publish':{...ref,previewId:sharedId,hash},'squad.withdraw':ref,'squad.remove':ref,'squad.react':{...ref,encourage:v.bool},
};
export const isSquadCommand=(command:{kind:string}):command is SquadCommand=>Object.hasOwn(squadValidators,command.kind);
export function parseSquadSnapshot(value:unknown):SquadSnapshot {v.validateJson(value);snapshot(value,'squad-snapshot');return value as SquadSnapshot;}
export function parseSquadPreviewRequest(value:unknown):SquadPreviewRequest {
 v.validateJson(value);exact({accountId:sharedId,...ref,groupRevision:revision,postRevision,personalRevision,week,note:plain(600),choices})(value,'squad-preview');
 const row=value as SquadPreviewRequest;if(!row.note.trim()&&!Object.values(row.choices).some(Boolean))throw new v.StoredDataError('squad-preview.content');return row;
}
export function parseSquadPreview(value:unknown):SquadPreview {
 v.validateJson(value);exact({accountId:sharedId,...ref,previewId:sharedId,groupRevision:revision,postRevision,sourceRevision:personalRevision,expiresAt:v.instant,hash,snapshot})(value,'squad-preview');
 const row=value as SquadPreview;if(row.postRevision>row.groupRevision)throw new v.StoredDataError('squad-preview.revision');return row;
}
export function parseSquadQuery(value:unknown):SquadQuery {
 v.validateJson(value);exact({groupId:sharedId,week,authorMemberId:v.optional(sharedId),cursor:v.optional(sharedId),revision:v.optional(revision)})(value,'squad-query');
 const q=value as SquadQuery;if(q.cursor!==undefined&&q.revision===undefined)throw new v.StoredDataError('squad-query.revision');return q;
}
export const squadPostCheck=exact({id:sharedId,groupId:sharedId,authorMemberId:sharedId,revision,publishedAt:v.instant,updatedAt:v.instant,snapshot,reactions:exact({count:v.number(0,10000,true),mine:v.bool})});
export function parseSquadPage(value:unknown):SquadPage {
 v.validateJson(value);exact({accountId:sharedId,groupId:sharedId,revision,week,rows:v.array(squadPostCheck,20),next:v.nullable(sharedId)})(value,'squad-page');
 const page=value as SquadPage;
 if(new Set(page.rows.map(row=>row.id)).size!==page.rows.length||page.rows.some(row=>row.groupId!==page.groupId||row.snapshot.week!==page.week||row.revision>page.revision||row.reactions.mine&&row.reactions.count===0)
  ||page.next!==null&&(page.rows.length!==20||page.next!==page.rows.at(-1)?.id))throw new v.StoredDataError('squad-page.rows');
 return page;
}
