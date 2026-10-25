import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {test,expect,stored} from '../support/browser.ts';
import {groupSetup,createFamily,openFamily,groupCommand,readGroups,closeGroupSheets} from '../support/groupBrowser.ts';
import {accountCache,accountSheet} from '../support/syncBrowser.ts';
import {authHarness} from '../support/auth.ts';
import {PersonalClient} from '../support/personal.ts';
import {groupText} from '../../src/groups/text.ts';
import {archiveText} from '../../src/groups/archiveText.ts';
import {lifecycleText} from '../../src/account/text.ts';
import {lifecycleDatabase,accountPurger,purgeAccounts} from '../../server/lifecycle/worker.ts';
import {parseGroups} from '../../src/contracts/groups.ts';
import {parseGroupArchive} from '../../src/contracts/groupArchive.ts';
const g=groupText('en'),a=archiveText('en'),l=lifecycleText('en');
test.use({actionTimeout:15000});

test('deletion dismisses shared forms across tabs and a restored stale account cache cannot recover membership',async({page,context})=>{
 test.setTimeout(120000);const {guest}=await groupSetup(page),group=await createFamily(page),owner=(await accountCache(page))[0].owner,h=await authHarness(),survivor=new PersonalClient(h);let second:Awaited<ReturnType<typeof context.newPage>>|undefined;
 try{
  await survivor.initialize();const invitation=await groupCommand(page,{kind:'group.invite',groupId:group.id},group.revision);expect(invitation.status()).toBe(200);const token=new URL((await invitation.json()).invitation.link).hash.slice(8);
  expect((await survivor.browser.request('groups/commands',{accountId:survivor.owner,operationId:crypto.randomUUID(),issuedAt:Date.now(),expectedRevision:0,command:{kind:'group.accept',token,nickname:'Remaining member'}})).statusCode).toBe(200);
  let head=(await readGroups(page)).find(row=>row.id===group.id)!;
  const taskId=crypto.randomUUID();expect((await groupCommand(page,{kind:'task.create',groupId:group.id,taskId,title:'Retained shared deletion task',notes:'Shared context stays with the family',assignee:head.members.find(m=>m.self)!.id,date:'2026-10-24',time:null,weekdays:[]},head.revision)).status()).toBe(200);
  head=(await readGroups(page)).find(row=>row.id===group.id)!;expect((await groupCommand(page,{kind:'group.transfer',groupId:group.id,memberId:head.members.find(m=>!m.self)!.id},head.revision)).status()).toBe(200);
  await openFamily(page,group.name);await page.getByRole('button',{name:g('settings'),exact:true}).click();await page.getByRole('switch',{name:g('notifications'),exact:true}).click();
  await expect.poll(async()=>!!(await accountCache(page))[0].state.life.drafts[`server-group-preferences:${group.id}`]).toBe(true);const stale=(await accountCache(page))[0];
  second=await context.newPage();await second.goto('/');await expect(second.getByText('Synced',{exact:true}).first()).toBeVisible({timeout:30000});await openFamily(second,group.name);await second.getByRole('button',{name:g('settings'),exact:true}).click();await second.getByRole('button',{name:a('title'),exact:true}).click();await second.getByRole('checkbox',{name:a('confirm'),exact:true}).check();let downloads=0;second.on('download',()=>downloads++);
  await closeGroupSheets(page);await accountSheet(page);await page.getByRole('button',{name:l('remove'),exact:true}).click();await page.getByRole('checkbox',{name:l('confirmDelete'),exact:true}).check();await page.getByRole('button',{name:l('confirm'),exact:true}).click();
  await second.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect.poll(async()=>(await accountCache(page)).some(row=>row.owner===owner),{timeout:30000}).toBe(false);await expect(second.getByText('Saved on this device',{exact:true}).first()).toBeVisible({timeout:30000});await expect(second.getByRole('heading',{name:a('review'),exact:true})).toHaveCount(0);expect(downloads).toBe(0);expect(await stored(page)).toEqual(guest);
  // A stale pre-deletion disk copy cannot override the retained deleted-owner
  // marker, even if an old writer also restores the selected-account pointer.
  await page.evaluate(async cache=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('rise-accounts',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['accounts','preferences'],'readwrite');tx.objectStore('accounts').put(cache,cache.owner);tx.objectStore('preferences').put(cache.owner,'active');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}},stale);
  await page.reload();await expect(page.getByText('Saved on this device',{exact:true}).first()).toBeVisible({timeout:30000});await expect(page.getByText('Retained shared deletion task',{exact:true})).toHaveCount(0);expect(await stored(page)).toEqual(guest);expect((await page.request.get('/api/v1/groups')).status()).toBe(401);
  const groups=parseGroups((await survivor.browser.request('groups')).json()),current=groups.groups.find(row=>row.id===group.id)!;expect(current.members).toHaveLength(1);expect(current.members[0].self).toBe(true);
  const response=await survivor.browser.request(`groups/${group.id}/export`,{accountId:survivor.owner,revision:current.revision});expect(response.statusCode).toBe(200);const archive=await parseGroupArchive(response.body);if(archive.content.kind!=='family')throw new Error('family');expect(archive.content.tasks.map(row=>row.title)).toEqual(['Retained shared deletion task']);expect(response.body).not.toContain('Owner shared name');
 }finally{
  await second?.close();const env=parseEnv(await readFile('.rise-infra/test/lifecycle.env','utf8')),worker=lifecycleDatabase({environment:'test',installationId:env.INSTALLATION_ID!,databaseUrl:env.DATABASE_LIFECYCLE_URL!});
  try{await worker.verify();for(let i=0;i<10;i++){const pending=(await h.admin.query('select count(*)::int as n from rise_private.deletion_jobs where user_id=$1 and purged_at is null',[owner])).rows[0].n;if(!pending)break;expect((await purgeAccounts(worker.pool,accountPurger('test',env.SUPABASE_URL!,env.SUPABASE_SECRET_KEY!))).failed).toBe(0);}}finally{await worker.close();}
  await h.admin.query('delete from rise.groups where id=$1',[group.id]);if(survivor.owner)await h.admin.query('delete from auth.users where id=$1',[survivor.owner]);await h.close();
 }
});
