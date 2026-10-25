import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {authHarness,AuthBrowser} from '../support/auth.ts';
test('a verified receiving device can cancel without subscribing, while guest/forged/CSRF requests fail',async()=>{
 const h=await authHarness();try{const b=new AuthBrowser(h);await b.read();assert.equal((await b.request('push/cancel-plan',{accountId:randomUUID(),requestId:randomUUID(),keys:null})).statusCode,401);
 const session=await b.login(),accountId=session.session.json().account.id,body={accountId,requestId:randomUUID(),keys:null};
 assert.equal(b.cookies.has('rise_test_push'),false);assert.equal((await b.request('push/cancel-plan',body,{'x-rise-csrf':''})).statusCode,403);
 assert.equal((await b.request('push/cancel-plan',{...body,accountId:randomUUID()})).statusCode,409);
 assert.equal((await b.request('push/cancel-plan',{...body,keys:['unvalidated-note']})).statusCode,422);
 const accepted=await b.request('push/cancel-plan',body);assert.equal(accepted.statusCode,200);assert.deepEqual((await b.request('push/cancel-plan',body)).json(),accepted.json());
 assert.equal((await b.request('personal')).json().initialized,false);assert.equal((await h.admin.query('select count(*)::int as n from rise.push_subscriptions where user_id=$1',[accountId])).rows[0].n,0);
 await b.request('logout',{});
 }finally{await h.close();}
});
