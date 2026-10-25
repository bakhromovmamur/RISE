import {expect,stored,type Page}from"./browser.ts";
import {syncGuest}from"./syncData.ts";
import {localCode,syntheticEmail,authHarness}from"./auth.ts";
import {secrets}from"../../server/auth/crypto.ts";
import {accountText}from"../../src/auth/text.ts";
import {syncText}from"../../src/sync/text.ts";
import type {Language}from"../../src/i18n.ts";
import {createTranslator}from"../../src/i18n.ts";
const mails=new Map<string,string[]>();
export async function seedSyncGuest(page:Page,language:Language="en"){
  const state=syncGuest();state.life.language=language;const raw=JSON.stringify(state);
  await page.addInitScript(raw=>{if(!localStorage.getItem("rise.local.v1"))localStorage.setItem("rise.local.v1",raw);},raw);await page.goto("/");await expect(page.locator('[data-storage-status="saved"]')).toBeVisible();
  // Wait for the existing startup calendar/device observation, not just the
  // initial migration acknowledgment, before taking a preservation baseline.
  await expect.poll(async()=>{const value=await stored(page);return !!value.life.deviceTimezone?.observed&&Object.keys(value.prayers.days).length>=30;}).toBe(true);return raw;
}
export async function accountSheet(page:Page,language:Language="en"){
  const t=createTranslator(language),text=accountText(language);
  await page.getByRole("tab",{name:t("You","Siz"),exact:true}).click();
  await page.getByRole("button",{name:`${t("Settings","Sozlamalar")} ${t("Appearance, language, habits & data","Ko‘rinish, til, odatlar va ma’lumotlar")}`,exact:true}).click();
  await page.locator("summary").filter({hasText:t("Your data","Ma’lumotlaringiz")}).click();await page.getByRole("button",{name:new RegExp(`^${text("account")} `)}).click();
  await expect(page.getByLabel(text("email"),{exact:true})).toBeVisible();
}
export async function browserLogin(page:Page,remember=true,email=syntheticEmail()){
  const t=accountText("en");await page.getByLabel(t("email"),{exact:true}).fill(email);if(remember)await page.getByRole("checkbox",{name:t("remember"),exact:false}).check();
  await page.getByRole("button",{name:t("send"),exact:true}).click();const mail=await localCode(email,mails.get(email)??[]);mails.set(email,[...(mails.get(email)??[]),mail.id]);
  try{await page.getByLabel(t("code"),{exact:true}).fill(mail.code);await page.getByRole("button",{name:t("verify"),exact:true}).click();await expect(page.getByText(t("signedIn"),{exact:true})).toBeVisible();}
  finally{const input=page.getByLabel(t("code"),{exact:true});if(await input.count())await input.fill("").catch(()=>{});}
  return email;
}
export async function allowSecondSyntheticSession(email:string){
  if(!/^auth-[a-z0-9-]+@example\.invalid$/.test(email))throw new Error("synthetic_email_required");
  const harness=await authHarness();try{const crypto=secrets(harness.config.sessionKey,harness.config.installationId);await harness.admin.query("delete from rise_private.auth_limits where subject_hash=$1 and window_seconds=60",[crypto.rate(`send-email:${email}`)]);}finally{await harness.close();}
  await new Promise(resolve=>setTimeout(resolve,1100));
}
export async function expireSyntheticSession(email:string){
  if(!/^auth-[a-z0-9-]+@example\.invalid$/.test(email))throw new Error("synthetic_email_required");
  const harness=await authHarness();try{await harness.admin.query("update rise_private.server_sessions set absolute_expires_at=now()-interval '1 second' where user_id in(select id from auth.users where email=$1)",[email]);}finally{await harness.close();}
}
export async function syncNetwork(page:Page,mode:"online"|"offline"|"lost-once"){
  const session=await(await page.request.get("/api/v1/session")).json();if(!session.signedIn)throw new Error("synthetic_session_required");
  const response=await page.request.post("/__infra_test__/sync-network",{headers:{Origin:new URL(page.url()).origin,"X-Rise-CSRF":session.csrfToken},data:{mode}});expect(response.status()).toBe(200);
}
export async function chooseImport(page:Page){const t=syncText("en");await page.getByRole("button",{name:t("choose"),exact:true}).click();await page.getByRole("checkbox",{name:"Synthetic reading",exact:true}).check();for(const key of ["goals","prayers","reflections","settings"]as const)await page.getByRole("checkbox",{name:t(key),exact:true}).check();await page.getByRole("button",{name:t("prepare"),exact:true}).click();await expect(page.getByRole("checkbox",{name:t("consent"),exact:true})).toBeVisible();}
export async function finishImport(page:Page){const t=syncText("en");await page.getByRole("checkbox",{name:t("consent"),exact:true}).check();await page.getByRole("button",{name:t("upload"),exact:true}).click();await expect(page.getByRole("button",{name:t("confirm"),exact:true})).toBeVisible();await page.getByRole("button",{name:t("confirm"),exact:true}).click();await expect(page.getByRole("tab",{name:"Today",exact:true})).toBeVisible();await expect(page.getByText("Synced",{exact:true}).first()).toBeVisible({timeout:30000});}
export async function accountCache(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("rise-accounts",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise<import("../../src/sync/store.ts").AccountCache[]>((resolve,reject)=>{const r=db.transaction("accounts").objectStore("accounts").getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}});}
export async function reflection(page:Page,value:string){await page.getByRole("tab",{name:"Progress",exact:true}).click();await page.getByRole("button",{name:/^(A moment to reflect|Read your reflection)/}).click();await page.getByLabel("What felt manageable?",{exact:false}).fill(value);await page.getByRole("button",{name:"Save reflection",exact:true}).click();}
