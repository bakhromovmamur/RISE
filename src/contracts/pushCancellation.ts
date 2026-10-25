import {pushObject,pushOnly,pushUUID} from './push';
export interface PushCancellation {
 accountId:string;requestId:string;keys:string[]|null;
 /** Immutable upper bound captured from an authorized plan read before POST. */
 throughGeneration?:number;
}
export function parsePushCancellation(v:unknown):PushCancellation{
 if(!pushObject(v)||!pushOnly(v,['accountId','requestId','keys','throughGeneration'])||!pushUUID(v.accountId)||!pushUUID(v.requestId)
  ||v.keys!==null&&(!Array.isArray(v.keys)||v.keys.length>84||!v.keys.every(pushUUID))
  ||v.throughGeneration!==undefined&&(!Number.isSafeInteger(v.throughGeneration)||Number(v.throughGeneration)<0||Number(v.throughGeneration)>=2147483647))throw new Error('invalid_cancellation');
 return {accountId:v.accountId,requestId:v.requestId,keys:v.keys as string[]|null,...(v.throughGeneration!==undefined?{throughGeneration:Number(v.throughGeneration)}:{})};
}
