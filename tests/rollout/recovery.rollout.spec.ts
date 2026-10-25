import {readFile,writeFile,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {test,expect,stored,type Page} from '../support/browser.ts';
import {seedSyncGuest,accountSheet,browserLogin,chooseImport,finishImport,accountCache,reflection} from '../support/syncBrowser.ts';
import {selectRelease,rollbackRelease,deploymentDirectory} from '../../scripts/infra/release/runtime.ts';
import {releaseDirectory} from '../../scripts/infra/release/package.ts';

async function settings(page:Page){await page.getByRole('tab',{name:'You',exact:true}).click();await page.getByRole('button',{name:/^Settings Appearance/}).click();await page.getByRole('dialog').locator('summary').filter({hasText:'Install & offline'}).click();}
async function update(page:Page,expected:string){
  await settings(page);await page.getByRole('button',{name:'Check for updates',exact:true}).click();
  await expect.poll(()=>page.evaluate(async()=>{
    const worker=(await navigator.serviceWorker.getRegistration('/'))?.waiting;if(!worker)return null;
    return new Promise<string|null>(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve(null);},2000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data.offlineReady?e.data.release:null);};worker.postMessage({type:'RISE_STATUS'},[channel.port2]);});
  }),{timeout:20000}).toBe(expected);
  await page.getByRole('dialog').getByRole('button',{name:'Update RISE',exact:true}).click();
  await expect.poll(()=>page.locator('meta[name="rise-release"]').getAttribute('content'),{timeout:20000}).toBe(expected);
  await expect(page.getByRole('tab',{name:'Today',exact:true})).toBeVisible();
}
test('failed replacement startup restores the previous healthy runtime; malformed requests cannot stop it',async({request})=>{
  const directory=deploymentDirectory('test');
  const releases=JSON.parse(await readFile(join(directory,'test-releases.json'),'utf8')) as {a:string;failed:string};
  await selectRelease('test',releases.a);
  await expect.poll(async()=>{try{return (await(await request.get('/api/v1/health/ready')).json()).release;}catch{return null;}},{timeout:30000}).toBe(releases.a);
  const prepared=await selectRelease('test',releases.failed);
  await expect.poll(async()=>{try{return JSON.parse(await readFile(join(directory,`record-${prepared.request}-restored.json`),'utf8')).outcome;}catch{return null;}},{timeout:30000}).toBe('restored');
  expect((await(await request.get('/api/v1/health/ready')).json()).release).toBe(releases.a);
  const desired=join(directory,'desired.json'),before=await readFile(desired);
  try{await writeFile(desired,'{invalid');await new Promise(resolve=>setTimeout(resolve,1200));expect((await(await request.get('/api/v1/health/ready')).json()).release).toBe(releases.a);}
  finally{await writeFile(desired,before);}
});
test('compatible backend/frontend rollback preserves a real session, pending account outbox, guest source and newer worker',async({page,request})=>{
  const releases=JSON.parse(await readFile(join(deploymentDirectory('test'),'test-releases.json'),'utf8')) as {a:string;b:string;webA:string;webB:string};
  const waitActive=async(id:string,writes:boolean)=>{
    await expect.poll(async()=>{try{const state=JSON.parse(await readFile(join(deploymentDirectory('test'),'state.json'),'utf8'));const health=await request.get('/api/v1/health/ready',{timeout:3000});return state.active.id===id&&state.active.writes===writes&&health.ok()&&(await health.json()).release===id;}catch{return false;}},{timeout:30000}).toBe(true);
  };
  await selectRelease('test',releases.a);await waitActive(releases.a,true);
  const original=await seedSyncGuest(page),guest=await stored(page);
  await accountSheet(page);await browserLogin(page);await chooseImport(page);await finishImport(page);
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  const owner=(await accountCache(page))[0].owner;
  // Tamper only this test's generated candidate; failed admission leaves the running release/session intact.
  const asset=join(releaseDirectory(releases.b),'dist/favicon.svg'),originalAsset=await readFile(asset);
  await chmod(asset,0o600);await writeFile(asset,'synthetic corruption');
  try{await expect(selectRelease('test',releases.b)).rejects.toThrow('release_integrity_failed');await waitActive(releases.a,true);}
  finally{await writeFile(asset,originalAsset);await chmod(asset,0o400);}
  await selectRelease('test',releases.b);await waitActive(releases.b,true);await update(page,releases.webB);
  // This is the real server capability, not a route/mock. GET/session remain authorized.
  await selectRelease('test',releases.b,false);await waitActive(releases.b,false);
  await reflection(page,'Synthetic rollback pending reflection');
  await expect.poll(async()=>(await accountCache(page))[0].queue.length).toBeGreaterThan(0);
  const pending=(await accountCache(page))[0];
  expect((await(await page.request.get('/api/v1/session')).json()).signedIn).toBe(true);
  await rollbackRelease('test');await waitActive(releases.a,false);
  expect(await page.locator('meta[name="rise-release"]').getAttribute('content')).toBe(releases.webB);
  expect((await accountCache(page))[0].queue).toEqual(pending.queue);
  // The newer worker is replaced only through the existing explicit compatible-update lease.
  await update(page,releases.webA);
  expect((await accountCache(page))[0].owner).toBe(owner);
  expect((await accountCache(page))[0].queue).toEqual(pending.queue);
  expect(await stored(page)).toEqual(guest);expect(await page.evaluate(()=>localStorage.getItem('rise.local.v1'))).toBe(original);
  expect((await(await page.request.get('/api/v1/session')).json()).signedIn).toBe(true);
  await selectRelease('test',releases.a,true);await waitActive(releases.a,true);
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect.poll(async()=>(await accountCache(page))[0].queue.length,{timeout:30000}).toBe(0);
  const personal=await(await page.request.get('/api/v1/personal')).json();expect(personal.xp).toBe(20);
  expect(personal.records.reflections.filter((r:{data:{manageable:string}})=>r.data.manageable==='Synthetic rollback pending reflection')).toHaveLength(1);
  await page.reload();expect((await accountCache(page))[0].owner).toBe(owner);
  const keys=await page.evaluate(async()=>(await Promise.all((await caches.keys()).filter(k=>k.startsWith('rise-public-')).map(async k=>(await(await caches.open(k)).keys()).map(r=>new URL(r.url).pathname)))).flat());
  expect(keys.some(k=>k.startsWith('/api/'))).toBe(false);
});
