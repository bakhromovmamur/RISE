import {expect,stored,type Page} from './browser.ts';
import {seedSyncGuest,accountSheet,browserLogin} from './syncBrowser.ts';
import {groupText} from '../../src/groups/text.ts';
import {syncText} from '../../src/sync/text.ts';
import {parseSharedPage,type SharedQuery} from '../../src/contracts/sharedContent.ts';
import type {AccountGroup,GroupCommand} from '../../src/contracts/groups.ts';
const t=groupText('en');
export async function closeGroupSheets(page:Page){for(let i=0;i<12&&await page.getByRole('button',{name:'Close',exact:true}).count();i++)await page.getByRole('button',{name:'Close',exact:true}).click();}
export async function groupHub(page:Page){await closeGroupSheets(page);await page.getByRole('tab',{name:'You',exact:true}).click();await page.getByRole('button',{name:'Family Tasks & shared lists',exact:true}).click();await expect(page.getByRole('heading',{name:t('title'),exact:true})).toBeVisible();}
export async function groupSetup(page:Page){
 await seedSyncGuest(page);const guest=await stored(page);await accountSheet(page);const email=await browserLogin(page);await page.getByRole('button',{name:syncText('en')('empty'),exact:true}).click();
 await page.getByRole('button',{name:'Choose other habits first',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Create my plan',exact:true}).click();await expect(page.getByText('Synced',{exact:true}).first()).toBeVisible();return{guest,email};
}
export async function createFamily(page:Page,name='Shared browser family',timezone?:string){
 await groupHub(page);await page.getByRole('button',{name:t('createFamily'),exact:true}).click();await page.getByLabel(t('name'),{exact:true}).fill(name);await page.getByLabel(t('nickname'),{exact:true}).fill('Owner shared name');if(timezone)await page.getByLabel(t('timezone'),{exact:true}).fill(timezone);await page.getByRole('button',{name:t('create'),exact:true}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();return(await readGroups(page)).find(g=>g.name===name)!;
}
export async function openFamily(page:Page,name:string){await groupHub(page);await page.locator('.people-group').filter({has:page.getByText(name,{exact:true})}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();}
export async function readGroups(page:Page):Promise<AccountGroup[]>{const r=await page.request.get('/api/v1/groups');expect(r.status()).toBe(200);return(await r.json()).groups;}
export async function readShared(page:Page,query:SharedQuery){const {groupId,...fields}=query,params=new URLSearchParams();for(const [key,value] of Object.entries(fields))params.set(key,String(value));const r=await page.request.get(`/api/v1/groups/${groupId}/content?${params}`);expect(r.status()).toBe(200);return parseSharedPage(await r.json());}
export async function groupFault(page:Page,mode:'online'|'offline'|'lost-once'){
 const identity=await(await page.request.get('/api/v1/session')).json();const r=await page.request.post('/__infra_test__/group-network',{headers:{Origin:'http://127.0.0.1:4191','X-Rise-CSRF':identity.csrfToken},data:{mode}});expect(r.status()).toBe(200);
}
export async function groupCommand(page:Page,command:Exclude<GroupCommand,{kind:'group.accept'}>,revision:number){
 const identity=await(await page.request.get('/api/v1/session')).json();return page.request.post('/api/v1/groups/commands',{headers:{Origin:'http://127.0.0.1:4191','X-Rise-CSRF':identity.csrfToken},data:{accountId:identity.account.id,operationId:crypto.randomUUID(),issuedAt:Date.now(),expectedRevision:revision,command}});
}
export async function familyInvitation(page:Page){await page.getByRole('button',{name:t('invite'),exact:true}).click();const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/groups/commands')&&r.request().postDataJSON()?.command?.kind==='group.invite');await page.getByRole('button',{name:t('makeLink'),exact:true}).click();const r=await response;expect(r.ok()).toBe(true);await expect(page.getByRole('button',{name:t('copy'),exact:true})).toBeVisible();return(await r.json()).invitation.link as string;}
