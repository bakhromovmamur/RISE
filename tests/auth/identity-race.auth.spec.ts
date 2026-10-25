import {test,expect} from '../support/browser.ts';
import {seedSyncGuest,accountSheet,browserLogin} from '../support/syncBrowser.ts';
test.use({serviceWorkers:'block'});

for(const {latestFails,olderLast} of [{latestFails:false,olderLast:false},{latestFails:true,olderLast:false},{latestFails:true,olderLast:true}])test(`opening Account during a background identity refresh ${latestFails?'reports the latest failure and retries':'keeps a usable sign-in form'}${olderLast?' after the newer failure has settled':''}`,async({page})=>{
  // Start paused before navigation; a running install could advance beyond this target.
  const now=new Date();await page.clock.pauseAt(now);
  const pending:(()=>void)[]=[];let hold=true;
  await page.route('**/api/v1/session',async route=>{
    const response=await route.fetch();
    if(hold){const position=pending.length;await new Promise<void>(resolve=>pending.push(resolve));if(latestFails&&position===2){await route.fulfill({status:503,json:{error:{code:'unavailable'}}});return;}}
    await route.fulfill({response});
  });
  try{
    await seedSyncGuest(page);expect(await page.evaluate(()=>Date.now())).toBe(now.getTime());
    await expect.poll(()=>pending.length).toBe(1);
    // Start the form's read just before the existing background timer fires;
    // its own fifteen-second network deadline must not expire in this test.
    await page.clock.fastForward(14000);
    const opened=accountSheet(page).catch(error=>{if(!latestFails)throw error;});
    await expect.poll(()=>pending.length).toBe(2);
    await page.clock.fastForward(1000);
    await expect.poll(()=>pending.length).toBeGreaterThan(2);
    if(olderLast){const failed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/session'&&response.status()===503);pending[2]();await failed;}
    else pending[1]();
    await page.clock.runFor(100);
    hold=false;for(const release of pending)release();
    if(latestFails){await expect(page.getByRole('alert')).toContainText('Account sign-in is unavailable');await page.getByRole('button',{name:'Try again',exact:true}).click();}
    await opened;
    await expect(page.getByRole('button',{name:'Send a sign-in code',exact:true})).toBeEnabled();
    await browserLogin(page);
  }finally{hold=false;for(const release of pending)release();await page.unrouteAll({behavior:'wait'});}
});
