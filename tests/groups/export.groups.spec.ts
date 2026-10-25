import {readFile} from 'node:fs/promises';
import {test,expect,stored,type Page} from '../support/browser.ts';
import {groupSetup,createFamily,openFamily,readGroups,groupCommand,groupFault,closeGroupSheets} from '../support/groupBrowser.ts';
import {accountCache,allowSecondSyntheticSession} from '../support/syncBrowser.ts';
import {authHarness,localCode} from '../support/auth.ts';
import {groupText} from '../../src/groups/text.ts';
import {archiveText} from '../../src/groups/archiveText.ts';
import {lifecycleText} from '../../src/account/text.ts';
import {parseGroupArchive} from '../../src/contracts/groupArchive.ts';
const t=archiveText('en'),g=groupText('en');
test.use({actionTimeout:15000});
async function review(page:Page){await page.getByRole('button',{name:g('settings'),exact:true}).click();await page.getByRole('button',{name:t('title'),exact:true}).click();await expect(page.getByRole('heading',{name:t('review'),exact:true})).toBeFocused();}
async function download(page:Page){await page.getByRole('checkbox',{name:t('confirm'),exact:true}).check();const waiting=page.waitForEvent('download');await page.getByRole('button',{name:t('download'),exact:true}).click();const file=await waiting;expect(file.suggestedFilename()).toBe('rise-group-archive.json');const path=await file.path();expect(path).not.toBeNull();const archive=await parseGroupArchive(await readFile(path!,'utf8'));await file.delete();return archive;}

test('explicit shared download uses the real worker/API and preserves private, guest and account data',async({page})=>{
 const {guest}=await groupSetup(page),group=await createFamily(page),taskId=crypto.randomUUID();
 const saved=await groupCommand(page,{kind:'task.create',groupId:group.id,taskId,title:'Only shared export text',notes:'Chosen shared note',assignee:null,date:'2026-10-24',time:null,weekdays:[]},group.revision);expect(saved.status()).toBe(200);
 await openFamily(page,group.name);const before=await accountCache(page),personal=await(await page.request.get('/api/v1/personal')).json();let downloads=0;page.on('download',()=>downloads++);
 await review(page);await expect(page.getByRole('button',{name:t('download'),exact:true})).toBeDisabled();expect(downloads).toBe(0);
 const archive=await download(page);expect(archive.group.id).toBe(group.id);expect(archive.content.kind).toBe('family');if(archive.content.kind!=='family')throw new Error('family');expect(archive.content.tasks.map(row=>row.title)).toEqual(['Only shared export text']);expect(downloads).toBe(1);
 await expect(page.getByText(t('started'),{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:t('title'),exact:true})).toBeFocused();
 expect(await stored(page)).toEqual(guest);expect((await accountCache(page)).map(row=>row.state)).toEqual(before.map(row=>row.state));expect(await(await page.request.get('/api/v1/personal')).json()).toEqual(personal);expect(JSON.stringify(await accountCache(page))).not.toContain('Only shared export text');
});

test('expired authentication requires a new code and a second explicit download decision',async({page})=>{
 const {email}=await groupSetup(page);await createFamily(page);await review(page);const owner=(await accountCache(page))[0].owner,h=await authHarness();try{await h.admin.query("update rise_private.server_sessions set authenticated_at=now()-interval '11 minutes' where user_id=$1",[owner]);}finally{await h.close();}
 let downloads=0;page.on('download',()=>downloads++);await page.getByRole('checkbox',{name:t('confirm'),exact:true}).check();await page.getByRole('button',{name:t('download'),exact:true}).click();await expect(page.getByText(t('recent'),{exact:true})).toBeVisible();
 const a=lifecycleText('en'),previous=await localCode(email);await allowSecondSyntheticSession(email);await page.getByRole('button',{name:a('send'),exact:true}).click();const mail=await localCode(email,[previous.id]);await page.getByLabel(a('code'),{exact:true}).fill(mail.code);await page.getByRole('button',{name:a('verify'),exact:true}).click();
 await expect(page.getByText(t('verified'),{exact:true})).toBeVisible();expect(downloads).toBe(0);await expect(page.getByRole('checkbox',{name:t('confirm'),exact:true})).not.toBeChecked();await expect(page.getByRole('button',{name:t('download'),exact:true})).toBeDisabled();await download(page);expect(downloads).toBe(1);
});

test('stale review and lost export reply require review or explicit retry, with no partial file or membership change',async({page})=>{
 await groupSetup(page);const group=await createFamily(page);await review(page);const renamed=await groupCommand(page,{kind:'group.rename',groupId:group.id,name:'Changed while reviewing'},group.revision);expect(renamed.status()).toBe(200);
 let downloads=0;page.on('download',()=>downloads++);await page.getByRole('checkbox',{name:t('confirm'),exact:true}).check();await page.getByRole('button',{name:t('download'),exact:true}).click();await expect(page.getByRole('button',{name:t('latest'),exact:true})).toBeVisible();expect(downloads).toBe(0);
 await page.getByRole('button',{name:t('latest'),exact:true}).click();await expect(page.getByRole('checkbox',{name:t('confirm'),exact:true})).not.toBeChecked();await groupFault(page,'lost-once');await page.getByRole('checkbox',{name:t('confirm'),exact:true}).check();await page.getByRole('button',{name:t('download'),exact:true}).click();await expect(page.getByText(t('failed'),{exact:true})).toBeVisible();expect(downloads).toBe(0);
 await groupFault(page,'online');const file=await download(page);expect(file.group.name).toBe('Changed while reviewing');expect(downloads).toBe(1);expect((await readGroups(page)).find(row=>row.id===group.id)?.revision).toBe(renamed.status()===200?(await renamed.json()).revision:0);
});

test('closing a pending shared download terminates its worker and restores focus without a late file',async({page})=>{
 await groupSetup(page);await createFamily(page);await review(page);const owner=(await accountCache(page))[0].owner,h=await authHarness(),lock=await h.admin.connect();let downloads=0;page.on('download',()=>downloads++);
 try{
  await lock.query('begin');await lock.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`rise-personal:${owner}`]);
  await page.getByRole('checkbox',{name:t('confirm'),exact:true}).check();await page.getByRole('button',{name:t('download'),exact:true}).click();await expect(page.getByText(t('working'),{exact:true})).toBeVisible();
  await page.getByRole('button',{name:t('cancel'),exact:true}).click();await expect(page.getByRole('button',{name:t('title'),exact:true})).toBeFocused();await lock.query('commit');
  await page.getByRole('button',{name:t('title'),exact:true}).click();await expect(page.getByRole('checkbox',{name:t('confirm'),exact:true})).not.toBeChecked();await page.getByRole('button',{name:t('cancel'),exact:true}).click();await closeGroupSheets(page);await expect(page.getByRole('tab',{name:'You',exact:true})).toBeVisible();expect(downloads).toBe(0);
 }finally{await lock.query('rollback');lock.release();await h.close();}
});
