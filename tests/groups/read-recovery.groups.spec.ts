import {test,expect,stored} from '../support/browser.ts';
import {groupSetup,createFamily,openFamily,readGroups} from '../support/groupBrowser.ts';
import {sharedText} from '../../src/groups/sharedText.ts';
const t=sharedText('en');
test.use({serviceWorkers:'block'});

test('an unavailable family read recovers on the normal metadata timer without another edit or manual retry',async({page})=>{
 const {guest}=await groupSetup(page),group=await createFamily(page,'Automatic read recovery');
 await page.getByRole('button',{name:t('addTask'),exact:true}).click();await page.getByLabel(t('taskName'),{exact:true}).fill('Same revision task');await page.getByRole('button',{name:t('saveTask'),exact:true}).click();await expect(page.getByRole('heading',{name:'Same revision task',exact:true})).toBeVisible();
 const revision=(await readGroups(page)).find(g=>g.id===group.id)!.revision;
 let unavailable=true,failures=0,successfulReads=0;
 await page.route(`**/api/v1/groups/${group.id}/content?*`,async route=>{
  if(new URL(route.request().url()).searchParams.get('collection')!=='tasks')return route.continue();
  if(unavailable){failures++;return route.fulfill({status:503,json:{error:{code:'unavailable'}}});}
  successfulReads++;return route.continue();
 });
 const failed=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/groups/${group.id}/content`&&r.status()===503);
 await page.reload();await failed;await openFamily(page,group.name);
 await expect(page.getByRole('dialog').getByText(t('readFailed'),{exact:true})).toBeVisible();expect(failures).toBeGreaterThan(0);
 unavailable=false;
 // No focus/online event, edit, reload or retry click supplies the recovery.
 await expect(page.getByRole('checkbox',{name:t('complete',['Same revision task']),exact:true})).toBeEnabled({timeout:20000});
 expect(successfulReads).toBeGreaterThan(0);expect((await readGroups(page)).find(g=>g.id===group.id)!.revision).toBe(revision);
 expect(await stored(page)).toEqual(guest);expect((await(await page.request.get('/api/v1/personal')).json()).xp).toBe(0);
});
