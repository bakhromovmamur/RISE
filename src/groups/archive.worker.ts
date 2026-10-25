import {AccountError,accountApi} from '../auth/client';
import {parseGroupArchive} from '../contracts/groupArchive';
export interface GroupArchiveJob {accountId:string;groupId:string;revision:number;memberId:string;csrf:string}
export type GroupArchiveReply={raw:string}|{error:string;retryAfter:number};
self.onmessage=async(event:MessageEvent<GroupArchiveJob>)=>{
 try{
  const job=event.data,value=await accountApi(`groups/${job.groupId}/export`,{body:{accountId:job.accountId,revision:job.revision},csrf:job.csrf});
  const raw=JSON.stringify(value),archive=await parseGroupArchive(raw);
  if(archive.group.id!==job.groupId||archive.group.revision!==job.revision||archive.group.members.find(m=>m.self)?.id!==job.memberId)throw new AccountError('unavailable');
  self.postMessage({raw} satisfies GroupArchiveReply);
 }catch(error){self.postMessage({error:error instanceof AccountError?error.code:'unavailable',retryAfter:error instanceof AccountError?error.retryAfter:0} satisfies GroupArchiveReply);}
};
