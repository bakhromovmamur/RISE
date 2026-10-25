import { readFile } from 'node:fs/promises';
import { test, expect, stored } from '../support/browser';
import { balancedFixture, localizeFixture } from '../../src/demo';
import { addLifeDemo } from '../../src/lifeModel';
import { helpText } from '../../src/help/text';
import { diagnosticsText } from '../../src/diagnostics/text';

for (const language of ['en', 'ru', 'uz'] as const) {
  test(`${language}: local help is readable, keyboard accessible and preserves private state`, async ({ page }, info) => {
    test.setTimeout(90000);
    const state = localizeFixture(addLifeDemo(balancedFixture(), 'daily-life'), language);
    state.name = 'OPS04_PRIVATE_CANARY'; state.prefs.reduceMotion = true;
    const source = JSON.stringify(state), t = helpText(language), dt = diagnosticsText(language);
    await page.addInitScript(value => { if (location.origin === 'http://127.0.0.1:4181' && !localStorage.getItem('rise.local.v1')) localStorage.setItem('rise.local.v1', value); }, source);
    await page.goto('/'); await stored(page);
    await page.locator('#tab-you').click();
    const opener = page.locator('.you-destinations button').nth(3);
    await opener.click();
    const dialog = page.getByRole('dialog'), help = dialog.locator('.help-settings'), summary = help.locator(':scope > summary');
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(help).toHaveAttribute('open', '');
    await expect(help).toContainText(t('status'));
    await expect(help.locator('.help-release')).toContainText((await page.locator('meta[name="rise-release"]').getAttribute('content'))!);
    const before = await stored(page);
    for (const key of ['privacy', 'retention', 'use', 'reminders', 'support', 'rights'] as const) {
      const section = help.locator(`[data-help="${key}"]`), control = section.locator('summary');
      await control.focus(); await page.keyboard.press('Space'); await expect(section).toHaveAttribute('open', '');
      for (const theme of ['light', 'dark']) for (const scale of [100, 200]) for (const width of [320, 375, 393, 430]) {
        await page.setViewportSize({ width, height: 852 });
        await page.evaluate(({theme, scale}) => { document.querySelector('.app-shell')?.setAttribute('data-theme', theme); document.documentElement.style.fontSize = scale === 200 ? '32px' : '16px'; }, {theme, scale});
        await control.scrollIntoViewIfNeeded();
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        if (width === 393 && scale === 200 && info.project.name === 'chromium') await page.screenshot({path: info.outputPath(`${language}-${theme}-${key}.png`)});
      }
      if (key === 'support') {
        const download = page.waitForEvent('download'); await section.getByRole('button', {name: new RegExp('^' + dt('download'))}).click();
        const report = await readFile((await (await download).path())!, 'utf8');
        expect(report).not.toContain('CANARY'); expect(JSON.parse(report).format).toBe('rise-diagnostics');
      }
      if (key === 'rights') { await expect(section.locator('pre')).toContainText('lucide-react@0.468.0'); await expect(section.locator('pre')).toContainText('Copyright'); }
      await control.focus(); await page.keyboard.press('Enter'); await expect(section).not.toHaveAttribute('open');
    }
    expect(await help.locator('a').count()).toBe(0); // No invented contact or automatic external destination.
    expect(await stored(page)).toEqual(before);
    expect(await page.evaluate(() => localStorage.getItem('rise.local.v1'))).toBe(source);
    await summary.focus(); await page.keyboard.press('Enter');
    await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
    await page.reload(); expect(await stored(page)).toEqual(before);
  });
}
