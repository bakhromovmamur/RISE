import {test,expect,stored,reloadSaved,type Page} from './support/browser';
import {balancedFixture} from '../src/demo';
import {addLifeDemo} from '../src/lifeModel';
import {createTranslator} from '../src/i18n';
import {xpTotal,type State} from '../src/model';
const t=createTranslator('uz'), dialog=(p:Page)=>p.getByRole('dialog');
const button=(p:Page,key:string)=>dialog(p).getByRole('button',{name:t(key),exact:true});
async function seed(page:Page,language:'en'|'uz'='uz'){
 const s=addLifeDemo(balancedFixture(),'daily-life');s.life.language=language;s.prefs.reduceMotion=true;
 await page.addInitScript(s=>{if(!localStorage.getItem('rise.local.v1'))localStorage.setItem('rise.local.v1',JSON.stringify(s));},s);
 await page.goto('/?review=1');await stored(page);return s;
}
async function close(page:Page){while(await dialog(page).count())await page.keyboard.press('Escape');}
async function settings(page:Page){await page.locator('#tab-you').click();await page.locator('.you-destinations button').nth(3).click();}
function sameJourney(actual:State,original:State){expect({...actual,life:{...actual.life,language:original.life.language}}).toEqual(original);}

test('Uzbek language changes and reload retain authored content and the complete saved journey',async({page})=>{
 const original=await seed(page,'en');
 await settings(page);await dialog(page).getByRole('button',{name:'Language English',exact:true}).click();
 await dialog(page).getByRole('button',{name:'O‘zbekcha Lotin yozuvi',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('lang','uz');sameJourney(await stored(page),original);
 await reloadSaved(page);await expect(page.locator('#tab-journey')).toHaveText('Yo‘l');
 await page.locator('.priority-list .habit-main').first().click();
 await expect(dialog(page).getByRole('heading',{name:'Odatingiz',exact:true})).toBeVisible();
 await expect(dialog(page)).toContainText(original.habits[0].name);await expect(dialog(page)).toContainText('sahifa');
 await close(page);await settings(page);await dialog(page).getByRole('button',{name:'Til O‘zbekcha',exact:true}).click();
 await dialog(page).getByRole('button',{name:'English English',exact:true}).click();expect(await stored(page)).toEqual(original);
});

test('Uzbek habit actions preserve tiny/full/undo XP and expose translated validation',async({page})=>{
 const original=await seed(page),name=original.habits[0].name;
 await page.getByRole('button',{name:t('Log tiny {0}: {1}',undefined,[name,t.target({...original.habits[0],...original.habits[0].versions[0]},original.habits[0].versions[0].tiny)]),exact:true}).click();await close(page);
 expect(xpTotal(await stored(page))).toBe(xpTotal(original)+10);
 await page.getByRole('button',{name:t('View {0}',undefined,[name]),exact:true}).click();
 await dialog(page).getByRole('button',{name:new RegExp(t('Upgrade to full target'))}).click();await close(page);
 expect(xpTotal(await stored(page))).toBe(xpTotal(original)+20);
 await page.getByRole('button',{name:t('View {0}',undefined,[name]),exact:true}).click();await button(page,'Undo check-in').click();await close(page);
 expect(xpTotal(await stored(page))).toBe(xpTotal(original));
 await settings(page);await dialog(page).getByRole('button',{name:new RegExp('^'+t('Your habits'))}).click();await button(page,'Add a habit').click();
 await button(page,'Add habit').click();await expect(dialog(page).getByRole('alert')).toHaveText(t('Give your habit a name.'));
});

test('Uzbek goal and reward forms retain authored names and never award habit XP',async({page})=>{
 const original=await seed(page);await page.locator('#tab-progress').click();await page.getByRole('tab',{name:t('Goals'),exact:true}).click();
 await page.getByRole('button',{name:t('New goal'),exact:true}).click();await button(page,'Save goal').click();
 await expect(dialog(page).getByRole('alert')).toHaveText(t('Give your goal a name.'));
 await dialog(page).getByLabel(t('Goal name'),{exact:true}).fill('Today');await dialog(page).getByLabel(t('Milestone {0}',undefined,[1]),{exact:true}).fill('Save');await button(page,'Save goal').click();
 const goal=(await stored(page)).goals.at(-1)!;expect(goal.title).toBe('Today');expect(goal.milestones[0].title).toBe('Save');
 await page.locator('#tab-journey').click();await page.getByRole('button',{name:t('Add personal reward'),exact:true}).click();
 await dialog(page).getByLabel(t('Reward name'),{exact:true}).fill('My Reward · Моя награда');await dialog(page).getByLabel(t('Unlock this reward by'),{exact:true}).selectOption('goal');await dialog(page).getByLabel(t('Goal'),{exact:true}).selectOption(goal.id);await button(page,'Save reward').click();
 await page.locator('#tab-progress').click();await page.locator('#panel-progress .goal-row').filter({hasText:'Today'}).click();
 await dialog(page).getByRole('button',{name:`${t('Complete')} Save`,exact:true}).click();await close(page);
 await page.locator('#tab-today').click();await page.locator('.reward-cue').getByRole('button',{name:/My Reward/}).click();await button(page,'Mark as enjoyed').click();
 const after=await stored(page);expect(after.personalRewards.at(-1)?.enjoyedOn).toBeTruthy();expect(xpTotal(after)).toBe(xpTotal(original));expect(after.goals.at(-1)?.title).toBe('Today');
});

test('Uzbek four-tab navigation, progress panels and sheet headers reflow at phone widths and large text',async({page})=>{
 test.setTimeout(90000);const original=await seed(page);
 for(const scale of [100,200])for(const width of [320,375,393,430]){
  await page.setViewportSize({width,height:852});await page.evaluate(scale=>{document.documentElement.style.fontSize=`${scale}%`;},scale);
  for(const id of ['today','journey','progress','you']){
   await page.locator(`#tab-${id}`).click();await expect(page.locator(`#tab-${id}`)).toBeInViewport();
   expect(await page.locator('.app-shell').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  }
  await page.locator('#tab-progress').click();
  for(const view of ['Overview','Salah','Habits','Goals']){
   await page.getByRole('tab',{name:t(view),exact:true}).click();
   await expect(page.getByRole('tabpanel',{name:t('{0} progress',undefined,[t(view)]),exact:true})).toBeVisible();
  }
  await page.getByRole('button',{name:t('New goal'),exact:true}).click();
  await expect(button(page,'Close')).toBeInViewport({ratio:1});
  expect(await dialog(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await close(page);
  await page.locator('#tab-you').click();await page.locator('.you-destinations button').nth(1).click();
  await page.locator('.people-group').first().click();
  for(const control of await dialog(page).locator('.life-segments > button').all()){
   expect(await control.evaluate(el=>{
    const range=document.createRange();range.selectNodeContents(el);
    const text=range.getBoundingClientRect(),box=el.getBoundingClientRect();
    return text.left>=box.left-1&&text.right<=box.right+1&&text.top>=box.top-1&&text.bottom<=box.bottom+1;
   }),`Family control text fits at ${width}px/${scale}%`).toBe(true);
  }
  await button(page,'Lists').click();await expect(dialog(page)).toContainText(t('Lists for everyday life'));await close(page);
 }
 sameJourney(await stored(page),original);
});
