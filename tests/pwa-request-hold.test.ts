import test from 'node:test';
import assert from 'node:assert/strict';
import {beginPrivateRequest,holdPrivateRequests,releasePrivateRequests} from '../src/pwa/requestHold';
import {accountApi} from '../src/auth/client';
import {SyncClient} from '../src/sync/client';

const owner='11111111-1111-4111-8111-111111111111';
const sync=new SyncClient(owner,()=>({signedIn:true,csrfToken:'synthetic-csrf',delivery:'email',account:{id:owner,email:'synthetic@example.invalid',remembered:true,authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()}}));

test('approved replacement drains response bodies and blocks both API lanes without replaying requests',async()=>{
  const original=globalThis.fetch,calls:{url:string;options:RequestInit|undefined}[]=[];
  let body!:ReadableStreamDefaultController<Uint8Array>,started!:()=>void;
  const entered=new Promise<void>(resolve=>{started=resolve;});
  globalThis.fetch=async(input,options)=>{calls.push({url:String(input),options});started();return new Response(new ReadableStream({start(controller){body=controller;}}),{headers:{'Content-Type':'application/json'}});};
  try{
    const pending=accountApi('synthetic',{body:{operationId:'keep-this-id'},csrf:'synthetic-csrf'});await entered;
    let approved=false;const holding=holdPrivateRequests('first').then(ok=>{approved=ok;return ok;});
    await Promise.resolve();assert.equal(approved,false);
    await assert.rejects(accountApi('session'),/unavailable/);await assert.rejects(sync.api('head'),/unavailable/);
    assert.equal(calls.length,1);assert.equal(calls[0].options?.body,JSON.stringify({operationId:'keep-this-id'}));assert.equal(calls[0].options?.credentials,'same-origin');assert.equal(calls[0].options?.cache,'no-store');
    body.enqueue(new TextEncoder().encode('{"saved":true}'));body.close();
    assert.deepEqual(await pending,{saved:true});assert.equal(await holding,true);
    releasePrivateRequests('stale');await assert.rejects(sync.api('head'),/unavailable/);
    releasePrivateRequests('first');globalThis.fetch=async(input,options)=>{calls.push({url:String(input),options});return new Response('{"resumed":true}',{headers:{'Content-Type':'application/json'}});};
    assert.deepEqual(await sync.api('head'),{resumed:true});assert.equal(calls.length,2);assert.equal(calls[1].url,'/api/v1/sync/head');
  }finally{releasePrivateRequests('first');globalThis.fetch=original;}
});

test('refusal or expiry releases a pending drain; a stale release cannot reopen a newer hold',async()=>{
  const finish=beginPrivateRequest();assert.ok(finish);
  const old=holdPrivateRequests('old');assert.equal(await holdPrivateRequests('other'),false);
  releasePrivateRequests('old');assert.equal(await old,false);
  const current=holdPrivateRequests('new');releasePrivateRequests('old');assert.equal(beginPrivateRequest(),null);
  finish();finish();assert.equal(await current,true);
  releasePrivateRequests('new');const resumed=beginPrivateRequest();assert.ok(resumed);resumed();
});

test('network and response failures release the drain without changing cancellation or retry intent',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>{throw new Error('synthetic network loss');};
    await assert.rejects(accountApi('session'),/unavailable/);await assert.rejects(sync.api('head'),/unavailable/);
    globalThis.fetch=async()=>new Response('invalid JSON',{headers:{'Content-Type':'application/json'}});
    await assert.rejects(accountApi('session'),/unavailable/);await assert.rejects(sync.api('head'),/unavailable/);
    const abort=new AbortController();abort.abort();await assert.rejects(accountApi('session',{signal:abort.signal}),/unavailable/);await assert.rejects(sync.api('head',undefined,abort.signal),/cancelled/);
    assert.equal(await holdPrivateRequests('failure'),true);
  }finally{releasePrivateRequests('failure');globalThis.fetch=original;}
});
