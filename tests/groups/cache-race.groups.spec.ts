import {test,expect} from '../support/browser.ts';
import {groupSetup,createFamily} from '../support/groupBrowser.ts';
import {accountCache} from '../support/syncBrowser.ts';
import {sharedText} from '../../src/groups/sharedText.ts';
const t=sharedText('en');
test('personal priority sync and shared receipt cleanup can overlap without a false cache conflict',async({page})=>{
 await groupSetup(page);await createFamily(page,'Concurrent private and shared saves');await page.getByRole('button',{name:t('addTask'),exact:true}).click();await page.getByLabel(t('taskName'),{exact:true}).fill('One concurrent task');await page.getByRole('button',{name:t('saveTask'),exact:true}).click();await expect(page.getByRole('button',{name:t('markDone'),exact:true})).toBeEnabled();
 for(let i=0;i<12;i++){
  const selected=i%2===0;await page.getByRole('button',{name:t(selected?'pin':'unpin'),exact:true}).click();await expect(page.getByRole('button',{name:t(selected?'unpin':'pin'),exact:true})).toBeVisible();await expect.poll(async()=>Object.values((await accountCache(page))[0].state.dailyPriorities).flat().some(p=>p.kind==='task')).toBe(selected);
  await page.getByRole('button',{name:t(selected?'markDone':'undo'),exact:true}).click();await expect(page.getByRole('button',{name:t(selected?'undo':'markDone'),exact:true})).toBeEnabled();await expect(page.getByRole('heading',{name:'Your saved data needs attention',exact:true})).toHaveCount(0);
 }
 await expect(page.getByText('Synced',{exact:true}).first()).toBeVisible();expect((await(await page.request.get('/api/v1/personal')).json()).xp).toBe(0);
});
