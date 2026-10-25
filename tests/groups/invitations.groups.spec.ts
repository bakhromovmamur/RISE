import {test,expect,stored} from '../support/browser.ts';
import {groupSetup,createFamily,familyInvitation,readGroups} from '../support/groupBrowser.ts';
import {authHarness} from '../support/auth.ts';
import {groupText} from '../../src/groups/text.ts';
import {parseGroupInvitationPage} from '../../src/contracts/groupInvitations.ts';
const t=groupText('en');

test('owner invitation pages remain bounded, keyboard focused and correctable without changing private data',async({page})=>{
 const {guest,email}=await groupSetup(page),group=await createFamily(page,'Paged invitation history'),identity=await(await page.request.get('/api/v1/session')).json(),h=await authHarness();
 try{
  expect(/^auth-[a-z0-9-]+@example\.invalid$/.test(email)).toBe(true);
  const seeded=await h.admin.query(`insert into rise.group_invitations(id,group_id,created_by,token_hash,created_at,expires_at)
   select gen_random_uuid(),g.id,u.id,sha256(convert_to(g.id::text||':'||n::text,'UTF8')),now()-n*interval '1 minute',now()+interval '7 days'-n*interval '1 minute'
   from rise.groups g join auth.users u on u.id=g.owner_id cross join generate_series(1,40) n where g.id=$1 and u.id=$2 and u.email=$3`,[group.id,identity.account.id,email]);expect(seeded.rowCount).toBe(40);
 }finally{await h.close();}
 await familyInvitation(page);const first=(await readGroups(page)).find(g=>g.id===group.id)!;expect(first.invitations).toHaveLength(20);expect(first.invitationNext).toBeTruthy();
 const dialog=page.getByRole('dialog'),rows=dialog.locator('.group-row');await expect(rows).toHaveCount(20);
 const secondResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/groups/${group.id}/invitations`);await dialog.getByRole('button',{name:t('invitationsOlder'),exact:true}).click();const response=await secondResponse;expect(response.status()).toBe(200);const second=parseGroupInvitationPage(await response.json());expect(second.rows).toHaveLength(20);expect(second.rows.every(row=>!first.invitations.some(old=>old.id===row.id))).toBe(true);
 await expect(dialog.getByRole('heading',{name:t('invitations'),exact:true})).toBeFocused();await expect(rows).toHaveCount(20);await expect(dialog.getByRole('button',{name:t('copy'),exact:true})).toHaveCount(0);
 await dialog.getByRole('button',{name:t('invitationsOlder'),exact:true}).click();await expect(rows).toHaveCount(1);await expect(dialog.getByRole('button',{name:t('invitationsOlder'),exact:true})).toBeDisabled();await dialog.getByRole('button',{name:t('invitationsPrevious'),exact:true}).click();await expect(rows).toHaveCount(20);
 await rows.first().getByRole('button',{name:t('revoke'),exact:true}).click();await dialog.getByRole('checkbox',{name:t('confirm'),exact:true}).check();await dialog.locator('.group-confirm').getByRole('button',{name:t('revoke'),exact:true}).click();
 await expect.poll(async()=>(await readGroups(page)).find(g=>g.id===group.id)!.revision).toBe(first.revision+1);await expect(dialog.locator('.group-confirm')).toHaveCount(0);await expect(dialog.getByRole('button',{name:t('invitationsPrevious'),exact:true})).toBeDisabled();
 const verified=await page.request.get(`/api/v1/groups/${group.id}/invitations?cursor=${first.invitationNext}&revision=${first.revision+1}`);expect(verified.status()).toBe(200);expect(parseGroupInvitationPage(await verified.json()).rows[0]).toEqual({...second.rows[0],revoked:true});
 expect(await stored(page)).toEqual(guest);
});
