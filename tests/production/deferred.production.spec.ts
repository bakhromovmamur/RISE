import {test,expect,stored} from '../support/browser';
import {makeFixture} from '../../src/review/fixtures';
import {ensurePriorities} from '../../src/developmentModel';
import {createTranslator} from '../../src/i18n';
import {groupText} from '../../src/groups/text';

test.use({serviceWorkers:'block'});
const copy={
  en:{loading:'Loading this screen…',failed:'This screen could not load. Check your connection and try again.',retry:'Try again'},
  ru:{loading:'Загружаем экран…',failed:'Не удалось загрузить экран. Проверьте подключение и попробуйте ещё раз.',retry:'Попробовать снова'},
  uz:{loading:'Sahifa yuklanmoqda…',failed:'Sahifa yuklanmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.',retry:'Qayta urinish'},
};
for(const language of ['en','ru','uz'] as const)test(`${language} deferred groups load only on demand and recover from an interrupted download`,async({page},info)=>{
  const state=makeFixture();state.life.language=language;
  const t=createTranslator(language),g=groupText(language),text=copy[language];
  await page.addInitScript(raw=>localStorage.setItem('rise.local.v1',raw),JSON.stringify(state));
  let release:()=>void=()=>{},requests=0;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/assets/GroupScreenBody-*.js',async route=>{
    requests++;
    if(requests===1){await held;await route.abort('failed');}else await route.continue();
  });
  await page.goto('/');
  // The initial migration save precedes Today's durable priority initialization.
  await expect.poll(async()=> (await stored(page)).dailyPriorities).toEqual(ensurePriorities(state).dailyPriorities);
  const original=await stored(page);
  expect(requests).toBe(0);
  await page.getByRole('tab',{name:language==='uz'?'Siz':t('You'),exact:true}).click();
  expect(requests).toBe(0);
  const opener=page.locator('.you-destinations').getByRole('button').filter({hasText:t('Family')});
  await opener.click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('status')).toHaveText(text.loading);
  release();
  await expect(dialog.getByRole('alert')).toHaveText(text.failed);
  for(const width of [320,375,393,430]){
    await page.setViewportSize({width,height:852});
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>{document.documentElement.style.fontSize='200%';document.querySelector('.app-shell')?.setAttribute('data-theme',theme);},theme);
      expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
      const button=dialog.getByRole('button',{name:text.retry,exact:true});
      const box=await button.boundingBox();expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  }
  if(info.project.name==='chromium')await page.screenshot({path:info.outputPath(`${language}-deferred-error-dark-200.png`)});
  await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  await page.setViewportSize({width:393,height:852});
  await dialog.getByRole('button',{name:text.retry,exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('button',{name:g('account'),exact:true})).toBeVisible();
  expect(requests).toBe(2);
  expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');await expect(opener).toBeFocused();
  await opener.click();await expect(dialog.getByRole('button',{name:g('account'),exact:true})).toBeVisible();
  expect(requests).toBe(2);
  expect(await stored(page)).toEqual(original);
});

test('closing a loading sheet cannot reopen it when the module arrives',async({page})=>{
  const state=makeFixture();
  await page.addInitScript(raw=>localStorage.setItem('rise.local.v1',raw),JSON.stringify(state));
  let release:()=>void=()=>{};
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/assets/GroupScreenBody-*.js',async route=>{await held;await route.continue();});
  await page.goto('/');
  await expect.poll(async()=> (await stored(page)).dailyPriorities).toEqual(ensurePriorities(state).dailyPriorities);
  const before=await stored(page);
  await page.getByRole('tab',{name:'You',exact:true}).click();
  const opener=page.locator('.you-destinations').getByRole('button').filter({hasText:'Family'});
  await opener.click();await expect(page.getByRole('dialog').getByRole('status')).toHaveText(copy.en.loading);
  await page.keyboard.press('Escape');await expect(opener).toBeFocused();
  const arrived=page.waitForResponse(response=>/\/GroupScreenBody-[^/]+\.js$/.test(new URL(response.url()).pathname));
  release();await arrived;
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await opener.click();await expect(page.getByRole('dialog').getByRole('button',{name:groupText('en')('account'),exact:true})).toBeVisible();
  expect(await stored(page)).toEqual(before);
});
