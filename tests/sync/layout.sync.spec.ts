import {test,expect}from"../support/browser.ts";
import {seedSyncGuest,accountSheet}from"../support/syncBrowser.ts";
import {syncText}from"../../src/sync/text.ts";
import {createTranslator}from"../../src/i18n.ts";
test.use({serviceWorkers:"block"});

// Visual-only metadata has no real challenge, session cookie or usable code.
// Real managed sessions and database behavior are exercised in account.sync.spec.ts.
for(const language of ["en","uz","ru"]as const)test(`sync consent reflows in ${language} with the existing design`,async({page},info)=>{
  const owner="11111111-1111-4111-8111-111111111111",t=syncText(language),translate=createTranslator(language);
  await page.route("**/api/v1/**",route=>{const path=new URL(route.request().url()).pathname;return path==="/api/v1/session"?route.fulfill({json:{signedIn:true,csrfToken:"0".repeat(64),delivery:"email",account:{id:owner,email:"visual-only@example.invalid",remembered:true,authenticatedAt:"2026-10-22T00:00:00Z",expiresAt:"2026-10-23T00:00:00Z"}}}):path==="/api/v1/sync/head"?route.fulfill({json:{accountId:owner,initialized:false,revision:0,xp:0}}):route.abort("blockedbyclient");});
  await seedSyncGuest(page,language);await accountSheet(page,language);await page.getByRole("button",{name:t("choose"),exact:true}).click();
  for(const stage of ["selection","preview"]as const){
    if(stage==="preview"){await page.getByRole("checkbox",{name:"Synthetic reading",exact:true}).check();for(const key of["goals","prayers","reflections","settings"]as const)await page.getByRole("checkbox",{name:t(key),exact:true}).check();await page.getByRole("button",{name:t("prepare"),exact:true}).click();await expect(page.getByRole("checkbox",{name:t("consent"),exact:true})).toBeVisible();}
    for(const appearance of ["light","dark"]as const)for(const width of [375,393,430,320,1440])for(const scale of(width===1440?[100]:[100,200])){
      await page.setViewportSize({width,height:width===1440?1000:852});await page.evaluate(({appearance,scale})=>{document.querySelector(".app-shell")?.setAttribute("data-theme",appearance);document.documentElement.style.fontSize=`${scale}%`;},{appearance,scale});
      const action=page.getByRole(stage==="preview"?"checkbox":"button",{name:t(stage==="preview"?"consent":"prepare"),exact:true});await action.scrollIntoViewIfNeeded();await expect(action).toBeInViewport();
      expect(await page.getByRole("dialog").evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);await expect(page.getByRole("button",{name:translate("Close","Yopish"),exact:true})).toBeInViewport();
      if(info.project.name==="chromium"&&(width===393&&scale===100||width===320&&scale===200||width===1440))await page.getByRole("dialog").screenshot({path:info.outputPath(`sync-${stage}-${language}-${appearance}-${width}-${scale}.png`)});
    }
    await page.evaluate(()=>document.documentElement.style.fontSize="100%");await page.setViewportSize({width:393,height:852});
  }
  await page.getByRole("checkbox",{name:t("consent"),exact:true}).focus();await page.keyboard.press("Tab");await expect(page.getByRole("dialog")).toContainText(t("excluded"));await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveAccessibleName(translate("Settings","Sozlamalar"));await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);
});
