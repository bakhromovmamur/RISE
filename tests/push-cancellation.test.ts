import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canceledEventKeys,pushEventKey,quietAt,affectsPush} from '../src/push/policy';
import {parsePushCancellation} from '../src/contracts/pushCancellation';
import {randomUUID} from 'node:crypto';
test('cancellation boundary accepts legacy and bounded intent but rejects forged generation/data fields',()=>{
 const request={accountId:randomUUID(),requestId:randomUUID(),keys:null};
 assert.deepEqual(parsePushCancellation(request),request);
 assert.equal(parsePushCancellation({...request,throughGeneration:0}).throughGeneration,0);
 for(const value of [-1,1.5,NaN,Infinity,2147483647,'1',null])assert.throws(()=>parsePushCancellation({...request,throughGeneration:value}));
 assert.throws(()=>parsePushCancellation({...request,keys:['private note']}));
 assert.throws(()=>parsePushCancellation({...request,owner:randomUUID()}));
});
test('quiet hours wrap midnight, use IANA clock and have exclusive end',()=>{
 const at=Date.parse('2026-10-23T00:00:00Z');assert.equal(quietAt(at,'Asia/Tashkent','22:00','08:00'),true);assert.equal(quietAt(at,'Asia/Tashkent','05:00','06:00'),true);assert.equal(quietAt(at,'Asia/Tashkent','04:00','05:00'),false);assert.equal(quietAt(at,'UTC','00:00','00:00'),false);
 // Repeated DST clocks receive the same civil quiet-hours decision.
 for(const at of ['2026-10-25T00:30:00Z','2026-10-25T01:30:00Z'])assert.equal(quietAt(Date.parse(at),'Europe/London','01:00','02:00'),true);
});
test('dated acknowledgment cancels only wake/backup; previews and ordinary settings do not cancel',async()=>{
 const date='2026-10-23',keys=await canceledEventKeys({kind:'fajr.acknowledge',date});assert.deepEqual(keys,await Promise.all(['wake','backup'].map(k=>pushEventKey(`rise:${date}:fajr:${k}`))));assert.ok(!keys?.includes(await pushEventKey(`rise:${date}:fajr:due`)));
 assert.equal(affectsPush({kind:'readiness.preview'}),false);assert.equal(affectsPush({kind:'fajr.alarm'}),false);assert.equal(affectsPush({kind:'preferences.set',changes:{appearance:'dark'}}),false);assert.equal(affectsPush({kind:'preferences.set',changes:{quietStart:'23:00'}}),true);
 assert.equal(await canceledEventKeys({kind:'account.timezone',timezone:'UTC'}),null);
});
