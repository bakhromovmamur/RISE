import {test,expect,stored,type Page} from '../support/browser';
import {createEmptyState} from '../../src/data/initialState';
import {saveHabit,emptyDraft,xpTotal} from '../../src/model';
import {habitText} from '../../src/habitText';
import {createTranslator,type Language} from '../../src/i18n';
const now=Date.parse('2026-10-23T08:59:00Z');
async function seed(page:Page,language:Language='en'){
 let s=createEmptyState();s.timezone='UTC';s.onboarded=true;s.life.language=language;s.prefs.reminders=true;s.prefs.quietStart=s.prefs.quietEnd='00:00';
 s=saveHabit(s,{...emptyDraft(),name:'Synthetic private habit',reminder:'09:00',days:[0,1,2,3,4,5,6]},'synthetic-habit','2026-10-23');
 // pauseAt installs the clock itself; install(now) first would let time advance past the pause target.
 await page.clock.pauseAt(now);
 await page.addInitScript(s=>{
  if(!localStorage.getItem('rise.local.v1'))localStorage.setItem('rise.local.v1',JSON.stringify(s));
  class N{static get permission(){return localStorage.getItem('__permission')??'default';}static async requestPermission(){localStorage.setItem('__permission','granted');localStorage.setItem('__asked','yes');return 'granted';}}
  Object.defineProperty(window,'Notification',{configurable:true,value:N});
  Object.defineProperty(ServiceWorkerRegistration.prototype,'showNotification',{configurable:true,value:async(title:string,options:NotificationOptions)=>{const shown=JSON.parse(localStorage.getItem('__shown')??'[]');shown.push({title,options});localStorage.setItem('__shown',JSON.stringify(shown));}});
 },s);
 await page.goto('/');await stored(page);expect(await page.evaluate(()=>Date.now())).toBe(now);
}
async function settings(page:Page,language:Language='en'){
 const t=createTranslator(language);await page.getByRole('tab',{name:t('You','Siz'),exact:true}).click();await page.getByRole('button',{name:`${t('Settings','Sozlamalar')} ${t('Appearance, language, habits & data','Ko‘rinish, til, odatlar va ma’lumotlar')}`,exact:true}).click();
 await page.locator('summary').filter({hasText:t('Habit reminders','Odat eslatmalari')}).click();
}
const shown=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('__shown')??'[]') as {title:string;options:NotificationOptions}[]);
test('foreground habit delivery requires explicit consent, survives reload, deduplicates and preserves saved data',async({page})=>{
 await seed(page);const baseline=await stored(page);await settings(page);const ht=habitText('en');
 expect(await page.evaluate(()=>localStorage.getItem('__asked'))).toBeNull();expect(await shown(page)).toEqual([]);
 await page.getByRole('button',{name:ht('enable'),exact:true}).click();await expect(page.getByText(ht('active'),{exact:true})).toBeVisible();
 await page.reload();await stored(page);await page.clock.fastForward(60001);
 await expect.poll(async()=>(await shown(page)).length).toBe(1);
 const alert=(await shown(page))[0];expect(alert.title).toBe('RISE');expect(alert.options.silent).toBe(true);expect(JSON.stringify(alert)).not.toContain('Synthetic private habit');
 expect(xpTotal(await stored(page))).toBe(0);expect((await stored(page)).habits).toEqual(baseline.habits);
 await page.clock.fastForward(30000);expect((await shown(page)).length).toBe(1);
 await settings(page);await page.getByRole('button',{name:ht('stop'),exact:true}).click();await expect(page.getByText(ht('inactive'),{exact:true})).toBeVisible();
});
test('completion before the reminder cancels foreground display and preview never asks permission',async({page})=>{
 await seed(page);await settings(page);const ht=habitText('en');
 await page.getByRole('button',{name:'Preview a reminder See how a gentle nudge would look',exact:true}).click();await expect(page.getByText(ht('preview'),{exact:true})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('__asked'))).toBeNull();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:ht('enable'),exact:true}).click();await expect(page.getByText(ht('active'),{exact:true})).toBeVisible();await page.keyboard.press('Escape');await page.getByRole('tab',{name:'Today',exact:true}).click();
 await page.getByRole('button',{name:'Log 1 time +20',exact:true}).click();await stored(page);expect(xpTotal(await stored(page))).toBe(20);
 await page.clock.fastForward(60001);await page.waitForTimeout(150);expect(await shown(page)).toEqual([]);expect(xpTotal(await stored(page))).toBe(20);
});
for(const language of ['en','ru','uz'] as const)test(`habit delivery controls preserve mobile reflow in ${language}`,async({page},info)=>{
 await seed(page,language);await settings(page,language);const ht=habitText(language);
 for(const theme of ["light","dark"])for(const width of [320,375,393,430])for(const scale of [100,200]){
  await page.setViewportSize({width,height:852});await page.evaluate(({scale,theme})=>{document.documentElement.style.fontSize=`${scale}%`;document.querySelector(".app-shell")?.setAttribute("data-theme",theme);},{scale,theme});await page.getByRole('button',{name:ht('enable'),exact:true}).scrollIntoViewIfNeeded();
  expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);
  if(info.project.name==="chromium"&&(theme==="light"&&width===393&&scale===100||theme==="dark"&&width===320&&scale===200))await page.getByRole("dialog").screenshot({path:info.outputPath(`habits-${language}-${theme}-${width}-${scale}.png`)});
 }
});
