import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parseGroupOperation,parseGroupPreviewRequest,parseGroups,parseGroupReceipt,parsePendingGroupIntent} from '../src/contracts/groups.ts';
test('group command boundary rejects authority/private extensions, invalid dates, IDs and unbounded names',()=>{
 const create={accountId:randomUUID(),operationId:randomUUID(),issuedAt:Date.now(),expectedRevision:0,command:{kind:'group.create',groupId:randomUUID(),groupKind:'family',name:'Семья · Oila',timezone:'Asia/Tashkent',nickname:'Shared name'}};
 assert.deepEqual(parseGroupOperation(create),create);
 for(const value of [{...create,ownerId:randomUUID()},{...create,issuedAt:NaN},{...create,issuedAt:-1},{...create,expectedRevision:1},
  ...[{name:' '},{name:'x'.repeat(81)},{name:'Private\nname'},{timezone:'Not/AZone'},{groupId:'demo-family'},{role:'owner'},{coordinates:[1,2]}].map(x=>({...create,command:{...create.command,...x}}))])assert.throws(()=>parseGroupOperation(value));
 const input={accountId:create.accountId,token:'a'.repeat(43)};assert.deepEqual(parseGroupPreviewRequest(input),input);
 for(const value of [{...input,token:'https://example.invalid/link'},{...input,token:'a'.repeat(64)},{...input,groupId:randomUUID()}])assert.throws(()=>parseGroupPreviewRequest(value));
 const preferences={...create,expectedRevision:4,command:{kind:'group.preferences',groupId:create.command.groupId,muted:true,quietStart:'22:00',quietEnd:'07:00'}};
 assert.deepEqual(parseGroupOperation(preferences),preferences);
 for(const x of [{quietStart:'24:00'},{muted:'yes'},{groupId:randomUUID(),userId:randomUUID()}])assert.throws(()=>parseGroupOperation({...preferences,command:{...preferences.command,...x}}));
});
test('group response and recovery boundaries reject cross-owner intent, private extensions and unsafe links',()=>{
 const owner=randomUUID(),id=randomUUID(),member=randomUUID();const group={id,kind:'family',name:'A group',timezone:'UTC',revision:1,archived:false,members:[{id:member,name:'Shared nickname',role:'owner',self:true}],preferences:{muted:false,quietStart:'22:00',quietEnd:'07:00'},invitations:[]};
 assert.deepEqual(parseGroups({accountId:owner,groups:[group]}).groups,[group]);
 for(const input of [{...group,privateRecords:[]},{...group,members:[{...group.members[0],self:false}]},{...group,members:[...group.members,...group.members]},{...group,revision:0}])assert.throws(()=>parseGroups({accountId:owner,groups:[input]}));
 const receipt={operationId:randomUUID(),groupId:id,revision:1,invitation:{id:randomUUID(),expiresAt:new Date().toISOString(),link:'https://rise.example/#invite='+'a'.repeat(43)}};
 assert.deepEqual(parseGroupReceipt(receipt,'https://rise.example'),receipt);
 for(const link of ['https://foreign.invalid/#invite='+'a'.repeat(43),'https://rise.example/path#invite='+'a'.repeat(43),'https://rise.example/?token=a#invite='+'a'.repeat(43)])assert.throws(()=>parseGroupReceipt({...receipt,invitation:{...receipt.invitation,link}},'https://rise.example'));
 const operation={accountId:owner,operationId:randomUUID(),issuedAt:Date.now(),expectedRevision:0,command:{kind:'group.accept',token:'a'.repeat(43),nickname:'Shared nickname'}};
 assert.throws(()=>parsePendingGroupIntent({type:'command',operation},owner));assert.throws(()=>parsePendingGroupIntent({type:'join',accountId:randomUUID(),operationId:randomUUID(),groupId:id},owner));
});
