import { readFile } from "node:fs/promises";
import { reloadSaved } from "./support/browser";
import { stored } from "./support/browser";
import { test, expect, type Page } from "./support/browser";
import { balancedFixture, localizeFixture } from "../src/demo";
import { addLifeDemo } from "../src/lifeModel";
import { createTranslator } from "../src/i18n";
import { xpTotal, type State } from "../src/model";
const t=createTranslator("ru"), dialog=(p:Page)=>p.getByRole("dialog");
const button=(p:Page,name:string)=>dialog(p).getByRole("button",{name:t(name),exact:true});
test("animated long prayer sheets keep their header and exit controls inside the phone",async({page})=>{
 await page.emulateMedia({reducedMotion:"no-preference"});
 await seed(page);
 for(const large of [false,true])for(const width of [375,393,430]){
  await page.setViewportSize({width,height:852});
  await page.goto(large?"/?text=large":"/");
  await page.getByRole("button",{name:/^Время намаза: /}).click();
  await expect.poll(()=>page.locator(".sheet:visible").evaluate(async el=>{
   await Promise.all(el.getAnimations().map(a=>a.finished));
   const header=el.querySelector(".sheet-header")!.getBoundingClientRect();
   return header.top>=0&&header.bottom<=innerHeight&&document.querySelector(".app-shell")!.scrollTop===0;
  })).toBe(true);
  await expect(button(page,"Close")).toBeInViewport({ratio:1});
  await button(page,"Close").click();
  await expect(dialog(page)).toHaveCount(0);
 }
});
async function seed(p:Page,kind="daily-life",language:"en"|"ru"="ru") {
 const state=localizeFixture(addLifeDemo(balancedFixture(),kind),language);
 await p.addInitScript(s=>{if(!localStorage.getItem("rise.local.v1"))localStorage.setItem("rise.local.v1",JSON.stringify(s));},state);
 await p.goto("/?review=1"); return state;
}
async function close(p:Page){while(await dialog(p).count())await p.keyboard.press("Escape");}
async function tab(p:Page,name:string){await p.getByRole("tablist",{name:t("Main navigation")}).getByRole("tab",{name:t(name),exact:true}).click();}
async function settings(p:Page){await tab(p,"You");await p.getByRole("button",{name:/^Настройки Вид/}).click();}
async function prayers(p:Page){await tab(p,"You");await p.getByRole("button",{name:/^Настройки намаза /}).click();}
// Check visible copy and accessible names, excluding brand/device names and explicitly authored data.
async function noEnglish(p:Page,selector:string){
 const leaks=await p.locator(selector+":visible").evaluate(root=>{
  const out:string[]=[];const allowed=/\b(RISE|rise|XP|UTC|iPhone|Asia|Tashkent|Mamur|English|Lotin|yozuvi|O‘zbekcha)\b/g;
  const inspect=(s:string,help=false)=>{const copy=help?s.replace(/\b(cookie|push|Web Push|Pip|Lucide|Adhan|tz-lookup)\b/g,""):s;if(/[A-Za-z]{3}/.test(copy.replace(allowed,"")))out.push(s);};
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;
  // Original dependency licenses retain their language; surrounding help still gets scanned.
  while((node=walk.nextNode())){const parent=node.parentElement;if(parent&&!parent.closest(".help-notices")&&parent.getClientRects().length&&getComputedStyle(parent).visibility!=="hidden")inspect(node.textContent??"",!!parent.closest(".help-settings"));}
  for(const el of root.querySelectorAll<HTMLElement>("[aria-label], [placeholder], [title]"))if(el.getClientRects().length)for(const a of ["aria-label","placeholder","title"])if(el.hasAttribute(a))inspect(el.getAttribute(a)!);
  return [...new Set(out)];
 });expect(leaks,`Untranslated UI in ${selector}`).toEqual([]);
}
test("language switching and reload preserve all existing content and progress",async({page})=>{
 const original=await seed(page,"daily-life","en");
 await page.getByRole("tab",{name:"You",exact:true}).click();await page.getByRole("button",{name:/^Settings Appearance/}).click();
 await dialog(page).getByRole("button",{name:"Language English",exact:true}).click();await dialog(page).getByRole("button",{name:"Русский Кириллица",exact:true}).click();
 await expect(page.locator("html")).toHaveAttribute("lang","ru");
 expect(await stored(page)).toEqual({...original,life:{...original.life,language:"ru"}});
 await reloadSaved(page);await expect(page.getByRole("tab",{name:"Сегодня",exact:true})).toBeVisible();
 await settings(page);await dialog(page).getByRole("button",{name:"Язык Русский",exact:true}).click();
 await dialog(page).getByRole("button",{name:"O‘zbekcha Lotin yozuvi",exact:true}).click();await expect(page.locator("html")).toHaveAttribute("lang","uz");
 await dialog(page).getByRole("button",{name:"English English",exact:true}).click();expect(await stored(page)).toEqual(original);
});
test("all four tabs and their details contain Russian UI and preserve week selection",async({page})=>{
 await seed(page);await noEnglish(page,"#panel-today");
 for(const name of ["Journey","Progress","You"]){await tab(page,name);await noEnglish(page,name==="Journey"?"#panel-journey":name==="Progress"?"#panel-progress":"#panel-you");}
 await tab(page,"Progress");await page.getByRole("button",{name:t("Previous week"),exact:true}).click();const week=await page.locator(".shared-week strong").innerText();
 for(const view of ["Salah","Habits","Goals","Overview"]){await page.getByRole("tab",{name:t(view),exact:true}).click();await noEnglish(page,"#panel-progress");await expect(page.locator(".shared-week strong")).toHaveText(week);}
 await settings(page);await noEnglish(page,"[role=dialog]");await button(page,"Your habits").count();
});
test("Russian prayer setup, reminders, save-and-stop and Fajr stay functional",async({page})=>{
 const initial=await seed(page);
 await page.getByRole("button",{name:/^Время намаза: /}).click();await noEnglish(page,"[role=dialog]");
 await dialog(page).getByLabel(t("City"),{exact:true}).selectOption("Samarkand");await dialog(page).getByLabel(`${t("Asr")} ${t("planned offset")}`,{exact:true}).selectOption("15");
 await button(page,"Save sample prayer plan").click();await close(page);
 expect((await stored(page)).life.setup.city).toBe("Samarkand");expect(xpTotal(await stored(page))).toBe(xpTotal(initial));
 await prayers(page);await dialog(page).getByRole("button",{name:new RegExp('^'+t("Prayer reminders"))}).click();await noEnglish(page,"[role=dialog]");
 await button(page,"Preview preparation reminder").click();await noEnglish(page,"[role=dialog]");await close(page);
 await page.getByRole("combobox",{name:t("Day checkpoint"),exact:true}).selectOption("16:08");await tab(page,"Today");await page.getByRole("button",{name:t("Save & step away"),exact:true}).click();
 const note="Когда вернусь: проверить кнопку сохранения.";await dialog(page).getByLabel(t("When I come back, I’ll…"),{exact:true}).fill(note);await noEnglish(page,"[role=dialog]");
 await button(page,"Save & step away").click();await reloadSaved(page);expect((await stored(page)).prayers.work?.note).toBe(note);
 await prayers(page);await dialog(page).getByRole("button",{name:new RegExp('^'+t("Prepare for Fajr"))}).click();await noEnglish(page,"[role=dialog]");await button(page,"Save & preview wake-up").click();await noEnglish(page,"[role=dialog]");
 const before=(await stored(page)).prayers.days;await button(page,"Stop this alarm").click();await button(page,"Preview backup alarm").click();await noEnglish(page,"[role=dialog]");await button(page,"I’m up").click();await noEnglish(page,"[role=dialog]");expect((await stored(page)).prayers.days).toEqual(before);
});
test("Russian habit forms, tiny upgrade and corrections keep XP and rewards consistent",async({page})=>{
 await seed(page);const initial=await stored(page);
 await page.getByRole("button",{name:/^Отметить маленький шаг «Немного почитать»/}).click();await close(page);expect(xpTotal(await stored(page))).toBe(xpTotal(initial)+10);
 await page.getByRole("button",{name:'Открыть «Немного почитать»',exact:true}).click();await noEnglish(page,"[role=dialog]");
 await dialog(page).getByRole("button",{name:new RegExp(t("Upgrade to full target"))}).click();await close(page);expect(xpTotal(await stored(page))).toBe(xpTotal(initial)+20);
 await page.getByRole("button",{name:'Открыть «Немного почитать»',exact:true}).click();await button(page,"Undo check-in").click();await close(page);expect(xpTotal(await stored(page))).toBe(xpTotal(initial));
 await settings(page);await dialog(page).getByRole("button",{name:new RegExp('^'+t("Your habits"))}).click();await noEnglish(page,"[role=dialog]");await button(page,"Add a habit").click();await noEnglish(page,"[role=dialog]");
});
test("Russian family tasks, shopping lists and squad previews remain local",async({page})=>{
 const initial=await seed(page);await tab(page,"You");await page.getByRole("button",{name:/^Семья /}).click();await noEnglish(page,"[role=dialog]");
 await dialog(page).getByRole("button",{name:/^Наша семья /}).click();await noEnglish(page,"[role=dialog]");await button(page,"Add task").click();await noEnglish(page,"[role=dialog]");
 await dialog(page).getByLabel(t("Task name"),{exact:true}).fill("Подготовить пикник");await dialog(page).getByLabel(t("Assigned to"),{exact:true}).selectOption("amina");await button(page,"Save family task").click();
 expect((await stored(page)).life.tasks.at(-1)?.assignee).toBe("amina");expect(xpTotal(await stored(page))).toBe(xpTotal(initial));
 await button(page,"Lists").click();await dialog(page).getByRole("button",{name:/^На неделю /}).click();await noEnglish(page,"[role=dialog]");
 await dialog(page).getByLabel(t("Add an item"),{exact:true}).fill("Молоко");await button(page,"Add").click();await dialog(page).getByRole("checkbox",{name:"Отметить Молоко",exact:true}).check();await close(page);
 await tab(page,"You");await page.getByRole("button",{name:/^Группы /}).click();await dialog(page).getByRole("button",{name:/^Маленькие шаги вместе /}).click();await noEnglish(page,"[role=dialog]");
 await dialog(page).getByRole("button",{name:new RegExp(t("Cheering you on"))}).first().click();
 await button(page,"Share my week").click();await noEnglish(page,"[role=dialog]");await dialog(page).getByLabel(t("A little reflection"),{exact:true}).fill("Небольшая прогулка помогла начать снова.");await dialog(page).getByRole("switch",{name:t("Include habit count"),exact:true}).click();await button(page,"Preview my update").click();await noEnglish(page,"[role=dialog]");await button(page,"Publish to demo squad").click();
 expect((await stored(page)).life.updates.find(u=>u.memberId==="self")?.habits).toBe(1);await button(page,"Group settings").click();await noEnglish(page,"[role=dialog]");await button(page,"Preview an invitation").click();await noEnglish(page,"[role=dialog]");
});
test("Russian period pause, readiness and empty setup have translated working controls",async({page})=>{
 await seed(page);await prayers(page);await dialog(page).getByRole("button",{name:new RegExp('^'+t("Period mode"))}).click();await noEnglish(page,"[role=dialog]");
 await button(page,"Pause prayer tracking").click();await close(page);await tab(page,"Today");await noEnglish(page,"#panel-today");await tab(page,"Progress");await noEnglish(page,"#panel-progress");
 await prayers(page);await dialog(page).getByRole("button",{name:new RegExp('^'+t("Alarm readiness"))}).click();
 for(const state of ["permission","coverage","waiting","ready"]){await dialog(page).getByLabel(t("Preview device state"),{exact:true}).selectOption(state);await noEnglish(page,"[role=dialog]");}
 await page.getByRole("combobox",{name:t("Demo fixture"),exact:true}).selectOption("empty");await page.getByRole("button",{name:t("Load selected fixture"),exact:true}).click();await noEnglish(page,"#panel-today");expect((await stored(page)).life.language).toBe("ru");expect(xpTotal(await stored(page))).toBe(0);
});
test("Russian goals, rewards, reflection and settings expose translated forms and validation",async({page})=>{
 await seed(page);await tab(page,"Progress");await page.getByRole("tab",{name:t("Goals"),exact:true}).click();await page.getByRole("button",{name:t("New goal"),exact:true}).click();await noEnglish(page,"[role=dialog]");
 await button(page,"Save goal").click();await noEnglish(page,"[role=dialog]");await expect(dialog(page)).toContainText(t("Give your goal a name."));
 await dialog(page).getByLabel(t("Goal name"),{exact:true}).fill("Вырастить зелень");await dialog(page).getByLabel(t("Milestone {0}",undefined,[1]),{exact:true}).fill("Посадить семена");await button(page,"Save goal").click();
 const goal=(await stored(page)).goals.at(-1)!;await tab(page,"Journey");await page.getByRole("button",{name:t("Add personal reward"),exact:true}).click();await noEnglish(page,"[role=dialog]");
 await dialog(page).getByLabel(t("Reward name"),{exact:true}).fill("Новая книга");await dialog(page).getByLabel(t("Unlock this reward by"),{exact:true}).selectOption("goal");await dialog(page).getByLabel(t("Goal"),{exact:true}).selectOption(goal.id);await button(page,"Save reward").click();
 await tab(page,"Progress");await page.getByRole("button",{name:/^Вырастить зелень/}).click();await noEnglish(page,"[role=dialog]");await dialog(page).getByRole("button",{name:`${t("Complete")} Посадить семена`,exact:true}).click();await noEnglish(page,"[role=dialog]");await close(page);
 await tab(page,"Today");await page.locator(".reward-cue").getByRole("button",{name:/Новая книга/}).click();await noEnglish(page,"[role=dialog]");await button(page,"Mark as enjoyed").click();expect((await stored(page)).personalRewards.at(-1)?.enjoyedOn).toBeTruthy();await close(page);
 await tab(page,"Progress");await page.getByRole("tab",{name:t("Overview"),exact:true}).click();await page.getByRole("button",{name:new RegExp('^'+t("A moment to reflect"))}).click();await noEnglish(page,"[role=dialog]");await close(page);
 await settings(page);for(const selector of [".settings-disclosure"]){for(const summary of await dialog(page).locator(selector+" > summary").all())await summary.click();}expect(await dialog(page).locator(".help-notices").textContent()).toBe(await readFile("src/help/third-party-notices.txt","utf8"));await noEnglish(page,"[role=dialog]");await button(page,"Preview a reminder").count();
});
test("Russian onboarding, responsive navigation, large text and dark appearance remain usable",async({page})=>{
 await seed(page);for(const width of [375,393,430]){await page.setViewportSize({width,height:852});for(const name of ["Today","Journey","Progress","You"]){await tab(page,name);expect(await page.locator(".app-shell").evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await expect(page.getByRole("tab",{name:t(name),exact:true})).toBeInViewport();}}
 await settings(page);await dialog(page).locator(".settings-disclosure > summary").first().click();await button(page,"Dark").click();await close(page);await expect(page.locator(".app-shell")).toHaveAttribute("data-theme","dark");
 await page.goto("/?text=large&review=1");for(const name of ["Today","Journey","Progress","You"]){await tab(page,name);expect(await page.locator(".app-shell").evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}
 await settings(page);await page.keyboard.press("Tab");expect(await dialog(page).evaluate(el=>el.contains(document.activeElement))).toBe(true);await close(page);
 await page.getByRole("combobox",{name:t("Demo fixture"),exact:true}).selectOption("fresh");await page.getByRole("button",{name:t("Load selected fixture"),exact:true}).click();await noEnglish(page,".app-main");await page.getByRole("button",{name:t("Choose other habits first"),exact:true}).click();await noEnglish(page,".app-main");await page.getByRole("button",{name:t("Continue"),exact:true}).click();await noEnglish(page,".app-main");await page.getByRole("button",{name:t("Continue"),exact:true}).click();await noEnglish(page,".app-main");await page.getByRole("button",{name:t("Create my plan"),exact:true}).click();await noEnglish(page,"#panel-today");
});
