import {createECDH,randomBytes,randomUUID} from 'node:crypto';
import {test as base,expect} from './browser.ts';
import {AuthBrowser,authHarness} from './auth.ts';

// A sender browser case must coexist with another test's due work. The fixture
// owns only the fresh synthetic account below and removes it even on failure.
export const test=base.extend<{unrelatedPushWork:string}>({
 unrelatedPushWork:async({baseURL},use)=>{
  expect(baseURL).toBe('http://127.0.0.1:4191');
  const h=await authHarness(),browser=new AuthBrowser(h);let owner='',email='';
  try{
   const login=await browser.login();owner=login.session.json().account.id;email=login.email;
   const ec=createECDH('prime256v1');ec.generateKeys();
   await browser.request('push');
   expect((await browser.request('push',{accountId:owner,version:0,details:false,language:'en',subscription:{endpoint:`https://fcm.googleapis.com/fcm/send/synthetic-unrelated-${randomUUID()}`,expirationTime:null,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}})).statusCode).toBe(200);
   const at=Date.now()+60000;
   expect((await browser.request('push/plan',{accountId:owner,requestId:randomUUID(),expectedGeneration:0,sourceRevision:0,takeover:true,allowDuringQuiet:true,timezone:'UTC',events:[{key:randomUUID(),at:new Date(at).toISOString(),expiresAt:new Date(at+120000).toISOString()}]})).statusCode).toBe(200);
   expect((await browser.request('push/test',{accountId:owner,version:1,requestId:randomUUID()})).statusCode).toBe(200);
   await h.admin.query("update rise.push_jobs set fire_at=date_trunc('milliseconds',clock_timestamp())-interval '1 second',expires_at=date_trunc('milliseconds',clock_timestamp())+interval '90 seconds',next_attempt_at=clock_timestamp()-interval '1 second' where user_id=$1",[owner]);
   const snapshot=async()=>({jobs:(await h.admin.query('select id,status,attempts,lease_token,lease_until,completed_at from rise.push_jobs where user_id=$1 order by id',[owner])).rows,tests:(await h.admin.query('select id,status,completed_at from rise.push_tests where user_id=$1 order by id',[owner])).rows});
   const before=await snapshot();expect(before.jobs).toHaveLength(1);expect(before.tests).toHaveLength(1);
   try{await use(owner);}finally{expect(await snapshot(),'Unrelated queued work must remain unclaimed and unsent').toEqual(before);}
  }finally{
   try{if(owner&&/^auth-[a-z0-9-]+@example\.invalid$/.test(email))await h.admin.query('delete from auth.users where id=$1 and email=$2',[owner,email]);}
   finally{await h.close();}
  }
 }
});
export {expect,stored} from './browser.ts';
