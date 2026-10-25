import {test, expect, stored} from '../support/browser';
import {createEmptyState} from '../../src/data/initialState';
import {ensurePriorities} from '../../src/developmentModel';
import {pwaText} from '../../src/pwa/messages';
import {helpText} from '../../src/help/text';

for (const language of ['en','ru','uz'] as const) test(`${language}: help and original notices survive a real-worker offline cold start`, async ({page,context,browserName}) => {
  await page.request.post('/__pwa_test__/version',{data:{version:'A'}});
  const state = createEmptyState(); state.onboarded = true; state.life.language = language;
  await page.addInitScript(value => {if(location.origin === 'http://127.0.0.1:4181'&&!localStorage.getItem('rise.local.v1'))localStorage.setItem('rise.local.v1',JSON.stringify(value));},state);
  await page.goto('/');
  // A migrated onboarded fixture first saves, then Today initializes priorities.
  await expect.poll(async()=> (await stored(page)).dailyPriorities).toEqual(ensurePriorities(state).dailyPriorities);
  await page.locator('#tab-you').click(); await page.locator('.you-destinations button').nth(3).click();
  await page.locator('summary').filter({hasText:pwaText(language).title}).click();
  await expect(page.locator('[data-offline-ready="true"]')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  const before = await stored(page);
  if(browserName==='firefox')await page.request.post('/__pwa_test__/network?offline=true');else await context.setOffline(true);
  try {
    await page.reload(); await stored(page);
    await page.locator('#tab-you').click(); await page.locator('.you-destinations button').nth(3).click();
    const help=page.locator('.help-settings'); await help.locator(':scope > summary').click();
    await expect(help).toContainText(helpText(language)('status'));
    await help.locator('[data-help="rights"] summary').click();
    await expect(help.locator('pre')).toContainText('tz-lookup@6.1.25');
    await help.locator('[data-help="support"] summary').click();
    await expect(help).toContainText(helpText(language)('contact'));
    expect(await stored(page)).toEqual(before);
  } finally {if(browserName==='firefox')await page.request.post('/__pwa_test__/network?offline=false');else await context.setOffline(false);}
});
