import {createTranslator} from "../../src/i18n";
import {mkdirSync,writeFileSync} from "node:fs";
import { createHash } from "node:crypto";
import { test, expect, stored, type Page } from "../support/browser";
import { balancedFixture, localizeFixture } from "../../src/demo";
import { addLifeDemo } from "../../src/lifeModel";
import { STORAGE_KEY } from "../../src/model";

const viewports = [320,375,393,430,1440].map(width=>({width,height:width===1440?1000:852}));
mkdirSync("/tmp/rise-quality02-confirmation",{recursive:true});

async function closeSheets(page: Page) {
  while (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
}

for (const language of ["en", "ru", "uz"] as const) {
  for (const appearance of ["light", "dark"] as const) {
    for (const textScale of [100, 200]) {
      for (const viewport of viewports) {
        
        const variant = `${language}-${appearance}-${viewport.width}x${viewport.height}-${textScale}`;
        test(variant, async ({ page, browser, baseURL }, testInfo) => {
          // Never seed an origin chosen by a caller, an existing user profile, or production.
          expect(baseURL).toBe("http://127.0.0.1:4182");
          await page.setViewportSize(viewport);
          const state = localizeFixture(addLifeDemo(balancedFixture(), "daily-life"), language);
          state.prefs.appearance = appearance;
          state.prefs.reduceMotion = true;
          const fixtureJson = JSON.stringify(state);
          await page.addInitScript(({ key, value }) => {
            if (location.origin === "http://127.0.0.1:4182" && !localStorage.getItem(key)) {
              localStorage.setItem(key, value);
            }
          }, { key: STORAGE_KEY, value: fixtureJson });
          await page.goto(textScale === 200 ? "/?text=large" : "/");
          await expect(page.locator(".app-shell")).toHaveAttribute("data-theme", appearance);
          await expect(page.locator("html")).toHaveAttribute("lang", language);
          expect(await page.locator("html").evaluate(el => getComputedStyle(el).fontSize)).toBe(textScale === 200 ? "32px" : "16px");

          const capture = async (name: string) => {
            await page.evaluate(async () => {
              await document.fonts.ready;
              await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => undefined)));
            });
            const audit = await page.locator('.app-shell').evaluate(root => {
  const visible = (el: Element) => {
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    for(let p:Element|null=el;p;p=p.parentElement)if(p.matches('details:not([open])')&&!p.querySelector(':scope > summary')?.contains(el))return false;
    return r.width>0&&r.height>0&&s.visibility==='visible'&&!el.closest('[hidden],[inert],[aria-hidden="true"]');
  };
  const identity=(el:Element)=>({tag:el.tagName.toLowerCase(),id:el.id,class:el.getAttribute('class'),text:(el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,180)});
  const controls=Array.from(root.querySelectorAll('button,a[href],input,select,textarea,summary,[role="button"],[role="tab"],[role="switch"]')).filter(visible).map(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el),before=getComputedStyle(el,'::before');
    const label=el instanceof HTMLInputElement ? el.labels?.[0] : null;
    const lr=label&&visible(label)?label.getBoundingClientRect():null;
    return {...identity(el),width:r.width,height:r.height,labelWidth:lr?.width,labelHeight:lr?.height,labelText:label?.textContent?.trim(),disabled:el.matches(':disabled'),before:{content:before.content,width:before.width,height:before.height,position:before.position},tabIndex:(el as HTMLElement).tabIndex,color:s.color};
  });
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const ctx=canvas.getContext('2d')!;
  const rgba=(color:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).map((v,i)=>i===3?v/255:v);};
  const blend=(fg:number[],bg:number[])=>[0,1,2].map(i=>fg[i]*fg[3]+bg[i]*(1-fg[3])).concat(1);
  const luminance=(rgb:number[])=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const contrast=[];
  for(const el of Array.from(root.querySelectorAll('*')).filter(visible)){
    const text=Array.from(el.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();
    if(!text||el.closest(':disabled,svg'))continue;
    let bg=[255,255,255,1],complex=false;const ancestors:Element[]=[];
    for(let parent:Element|null=el;parent;parent=parent.parentElement)ancestors.unshift(parent);
    for(const parent of ancestors){const s=getComputedStyle(parent);if(s.backgroundImage!=='none'||Number(s.opacity)<1)complex=true;bg=blend(rgba(s.backgroundColor),bg);}
    if(complex)continue;
    const s=getComputedStyle(el),fg=blend(rgba(s.color),bg),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const min=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700)?3:4.5;
    if(ratio<min-.01)contrast.push({...identity(el),text:text.slice(0,180),ratio,min,color:s.color,background:bg,fontSize:s.fontSize,fontWeight:s.fontWeight});
  }
  const images=Array.from(root.querySelectorAll('img')).filter(visible).filter(el=>!el.hasAttribute('alt')).map(identity);
  const motion=Array.from(root.querySelectorAll('*')).filter(visible).filter(el=>{const s=getComputedStyle(el);return s.animationName!=='none'&&s.animationDuration!=='0s';}).map(identity);
  return {controls,contrast,images,motion,htmlLanguage:document.documentElement.lang,shellWidth:root.clientWidth,shellScrollWidth:root.scrollWidth};
});
await page.locator('.app-shell').screenshot({path:`/tmp/rise-quality02-confirmation/${variant}-${name}.png`,animations:'disabled'});
writeFileSync(`/tmp/rise-quality02-confirmation/${variant}-${name}.json`,JSON.stringify(audit,null,2));

          };

          for (const tab of ["today", "journey", "progress", "you"]) {
            await page.locator(`#tab-${tab}`).click();
            await expect(page.locator(`#panel-${tab}`)).toBeVisible();
            await capture(tab);
          }
          await page.locator("#tab-today").click();
          await page.locator(".today-focus .section-title button").click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await capture("priorities");
          await closeSheets(page);
          await page.locator(".priority-list .habit-main").first().click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await capture("habit-detail");
          await closeSheets(page);
          await page.locator("#tab-journey").click();
          await page.locator(".personal-spotlight").click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await capture("personal-reward");
          await closeSheets(page);
          await page.locator("#tab-progress").click();
          await page.locator(".progress-views [role=tab]").last().click();
          await page.locator("#panel-progress .goal-row").first().click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await capture("goal-detail");
          await closeSheets(page);
          await page.locator("#tab-you").click();
          await page.locator(".you-destinations button").nth(0).click();
          await capture("prayer-preferences");
          for (const [index, name] of [[0, "prayer-setup"], [2, "fajr-plan"], [4, "private-pause"]] as const) {
            await page.locator(".preferences-hub .group-row").nth(index).click();
            await capture(name);
            await page.keyboard.press("Escape");
          }
          await closeSheets(page);
          for (const [index, name] of [[1, "family"], [2, "squad"]] as const) {
            await page.locator(".you-destinations button").nth(index).click();
            await page.locator(".people-group").first().click();
            await capture(name);
            await closeSheets(page);
          }
          await page.locator(".you-destinations button").nth(3).click();
          await capture("settings");
          const t=createTranslator(language),dialog=page.getByRole('dialog');
          for(const [i,scene] of ['appearance','reminders','data'].entries()){
            const summary=dialog.locator('.settings-disclosure > summary').nth(i);
            await summary.click();await capture(`settings-${scene}`);
            if(scene==='data'){
              const nested=dialog.locator('.settings-disclosure .settings-disclosure > summary');
              await nested.click();await capture('data-recovery');await nested.click();
            }
            await summary.click();
          }
          await dialog.getByRole('button',{name:new RegExp('^'+t('Your habits'))}).click();
          await dialog.getByRole('button',{name:t('Add a habit'),exact:true}).click();await capture('habit-form');
          await closeSheets(page);
          await page.locator('#tab-progress').click();await page.getByRole('button',{name:t('New goal'),exact:true}).click();await capture('goal-form');
          await closeSheets(page);
          await page.locator('#tab-journey').click();await page.getByRole('button',{name:t('Add personal reward'),exact:true}).click();await capture('reward-form');
          await closeSheets(page);
          await page.locator('#tab-you').click();await page.locator('.you-destinations button').nth(0).click();
          await page.locator('.preferences-hub .group-row').nth(1).click();await capture('prayer-reminders');
          await closeSheets(page);

          const after = await stored(page);
          expect(after.days).toEqual(state.days);
          expect(after.prayers.days).toEqual(state.prayers.days);
          expect(after.goals).toEqual(state.goals);
          expect(after.personalRewards).toEqual(state.personalRewards);
          await testInfo.attach("capture-metadata", {
            contentType: "application/json",
            body: JSON.stringify({
              fixture: "daily-life", fixtureSha256: createHash("sha256").update(fixtureJson).digest("hex"),
              fixtureDate: state.demoDate, viewport, language, appearance, textScale,
              browser: browser.version(), platform: process.platform, deviceScaleFactor: 1,
              reducedMotion: true, origin: baseURL,
            }, null, 2),
          });
        });
      }
    }
  }
}
