import {readFile} from 'node:fs/promises';
import {test,expect,stored} from './support/browser';
import {balancedFixture,localizeFixture} from '../src/demo';
import {addLifeDemo} from '../src/lifeModel';
import {diagnosticsText} from '../src/diagnostics/text';

for(const language of ['en','ru','uz'] as const){
  const t=diagnosticsText(language);
  test(`${language}: explicit diagnostic download excludes private data and preserves saved state`,async({page},info)=>{
    const state=localizeFixture(addLifeDemo(balancedFixture(),'daily-life'),language);state.name='OPS_PRIVATE_NAME_CANARY';state.habits[0].name='OPS_PRIVATE_HABIT_CANARY';state.prefs.reduceMotion=true;
    const source=JSON.stringify(state);
    await page.addInitScript(value=>{if(!localStorage.getItem('rise.local.v1'))localStorage.setItem('rise.local.v1',value);},source);
    await page.goto('/');await stored(page);await page.locator('#tab-you').click();await page.locator('.you-destinations button').nth(3).click();
    const dialog=page.getByRole('dialog');await dialog.locator('.settings-disclosure > summary').nth(2).click();
    const control=dialog.getByRole('button',{name:new RegExp('^'+t('download'))});await expect(control).toBeVisible();
    const before=JSON.stringify(await stored(page));
    const downloading=page.waitForEvent('download');await control.focus();await page.keyboard.press('Enter');const file=await downloading;
    expect(file.suggestedFilename()).toBe('rise-diagnostics.json');const raw=await readFile((await file.path())!,'utf8'),report=JSON.parse(raw);
    expect(report.format).toBe('rise-diagnostics');expect(report.storageStatus).toBe('saved');expect(report.syncPhase).toBe('guest');expect(raw).not.toContain('CANARY');expect(raw).not.toContain('example.invalid');
    expect(Object.keys(report).sort()).toEqual(['format','version','createdAt','release','storageContract','storageStatus','storageError','syncPhase','syncError','pendingChanges','persistentStorage','online','serviceWorkerControlled'].sort());
    expect(JSON.stringify(await stored(page))).toBe(before);expect(await page.evaluate(()=>localStorage.getItem('rise.local.v1'))).toBe(source);
    for(const theme of ['light','dark'])for(const scale of [100,200])for(const width of [320,375,393,430]){
      await page.setViewportSize({width,height:852});await page.evaluate(({theme,scale})=>{document.querySelector('.app-shell')?.setAttribute('data-theme',theme);document.documentElement.style.fontSize=scale===200?'32px':'16px';},{theme,scale});
      await control.scrollIntoViewIfNeeded();
      const box=await control.boundingBox();expect(box!.width).toBeGreaterThan(44);expect(box!.height).toBeGreaterThanOrEqual(44);
      const bounds=await control.evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));expect(bounds.scroll).toBeLessThanOrEqual(bounds.width+1);
      expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
      if(width===393&&scale===200&&info.project.name==='chromium')await page.screenshot({path:info.outputPath(`${language}-${theme}-diagnostics.png`)});
    }
    expect(JSON.stringify(await stored(page))).toBe(before);
  });
  test(`${language}: diagnostic download failure stays visible and retry succeeds`,async({page})=>{
    const state=localizeFixture(addLifeDemo(balancedFixture(),'daily-life'),language);
    await page.addInitScript(value=>{if(!localStorage.getItem('rise.local.v1'))localStorage.setItem('rise.local.v1',value);},JSON.stringify(state));
    await page.goto('/');await stored(page);await page.locator('#tab-you').click();await page.locator('.you-destinations button').nth(3).click();
    const dialog=page.getByRole('dialog');await dialog.locator('.settings-disclosure > summary').nth(2).click();
    const control=dialog.getByRole('button',{name:new RegExp('^'+t('download'))});
    await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=()=>{URL.createObjectURL=original;throw new Error('synthetic_download_failure');};});
    await control.click();await expect(dialog.getByRole('alert')).toHaveText(t('failed'));
    const downloading=page.waitForEvent('download');await control.click();await downloading;await expect(dialog.getByRole('alert')).toHaveCount(0);
  });
}
