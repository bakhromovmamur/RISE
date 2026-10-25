import {test,expect} from "../support/browser.ts";
import {seedSyncGuest,accountSheet} from "../support/syncBrowser.ts";
import {lifecycleText} from "../../src/account/text.ts";
test.use({serviceWorkers:"block"});
for(const language of ["en","ru","uz"] as const)test(`account deletion and reauthentication layout · ${language}`,async({page},info)=>{
 test.setTimeout(90000);
 const owner="33333333-3333-4333-8333-333333333333",t=lifecycleText(language);
 await page.route("**/api/v1/**",async route=>{const path=new URL(route.request().url()).pathname;
 if(path==="/api/v1/session")return route.fulfill({json:{signedIn:true,csrfToken:"0".repeat(64),delivery:"email",account:{id:owner,email:"visual-only-long-address@example.invalid",remembered:true,authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()}}});
 if(path==="/api/v1/sync/head")return route.fulfill({json:{accountId:owner,initialized:true,revision:4,xp:20}});
 if(path==="/api/v1/account/deletion")return route.fulfill({status:403,json:{error:{code:"recent_auth_required"}}});
 if(path==="/api/v1/auth/reauth/code")return route.fulfill({status:202,json:{challenge:"1".repeat(64),resendAt:new Date(Date.now()+60000).toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),retryAfter:60}});
 return route.abort("blockedbyclient");});
 await seedSyncGuest(page,language);await accountSheet(page,language);await page.getByRole("button",{name:t("remove"),exact:true}).click();
 await expect(page.getByRole("button",{name:t("confirm"),exact:true})).toBeDisabled();
 for(const scene of["delete","reauth"]){
  if(scene==="reauth"){await page.getByRole("checkbox",{name:t("confirmDelete"),exact:true}).check();await page.getByRole("button",{name:t("confirm"),exact:true}).click();await page.getByRole("button",{name:t("send"),exact:true}).click();await expect(page.getByLabel(t("code"),{exact:true})).toBeVisible();}
  for(const appearance of["light","dark"])for(const width of[375,393,430,320,1440])for(const scale of(width===1440?[100]:[100,200])){
   await page.setViewportSize({width,height:width===1440?1000:852});await page.evaluate(({appearance,scale})=>{document.querySelector(".app-shell")?.setAttribute("data-theme",appearance);document.documentElement.style.fontSize=`${scale}%`;},{appearance,scale});
   const target=scene==="delete"?page.getByRole("heading",{name:t("review"),exact:true}):page.getByLabel(t("code"),{exact:true});await target.scrollIntoViewIfNeeded();await expect(target).toBeInViewport();expect(await page.getByRole("dialog").evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);
   if(info.project.name==="chromium"&&(width===393&&scale===100||width===320&&scale===200||width===1440))await page.getByRole("dialog").screenshot({path:info.outputPath(`lifecycle-${scene}-${language}-${appearance}-${width}-${scale}.png`)});
  }
 }
 await page.getByLabel(t("code"),{exact:true}).focus();await page.keyboard.press("Tab");await expect(page.getByRole("button",{name:t("verify"),exact:true})).toBeFocused();
});
