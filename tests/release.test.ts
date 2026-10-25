import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,chmod,lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {compatible,contracts,digest,inspectWeb,inventory,discardBuildStage,type ReleaseManifest} from '../scripts/infra/release/package.ts';

test('rollout rejects schema drift, missing applied migrations and incompatible rollback without downgrading',()=>{
  const migrations={'20261024000000_synthetic.sql':digest('synthetic')};
  const release:ReleaseManifest={format:1,id:'a'.repeat(64),createdAt:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,webRelease:'b'.repeat(20),contracts,migrations,files:{}};
  compatible(release,null,migrations,['20261024000000']);
  compatible(release,release,migrations,['20261024000000']);
  assert.throws(()=>compatible(release,null,migrations,[]),/schema_mismatch/);
  assert.throws(()=>compatible(release,null,migrations,['20261024000000','20261025000000']),/schema_mismatch/);
  assert.throws(()=>compatible(release,null,{'20261024000000_synthetic.sql':digest('changed')},['20261024000000']),/schema_mismatch/);
  assert.throws(()=>compatible(release,{...release,contracts:{...contracts,pwa:'future'}},migrations,['20261024000000']),/compatibility/);
});

test('release inventory detects changed bytes, extra files and escaping links',async t=>{
  const root=await mkdtemp(join(tmpdir(),'rise-release-inventory-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'node_modules'));await writeFile(join(root,'entry.ts'),'original');
  const original=await inventory(root);await writeFile(join(root,'entry.ts'),'changed');assert.notDeepEqual(await inventory(root),original);
  await writeFile(join(root,'unexpected.env'),'synthetic-only');assert.ok((await inventory(root))['unexpected.env']);
  await symlink('/etc/hosts',join(root,'node_modules/escape'));await assert.rejects(inventory(root),/link_escape/);
});

test('release admission requires a production shell and every worker asset digest',async t=>{
  const root=await mkdtemp(join(tmpdir(),'rise-release-web-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'dist'));
  const release='a'.repeat(20),html=`<meta name="rise-build" content="production"><meta name="rise-release" content="${release}">`;
  await writeFile(join(root,'dist/index.html'),html);
  const build={release,contract:contracts.pwa,assets:[{url:'/index.html',sha256:digest(html)}]};
  await writeFile(join(root,'dist/notifications-sw.js'),`const BUILD = ${JSON.stringify(build)};`);
  assert.equal(await inspectWeb(root),release);
  await writeFile(join(root,'dist/index.html'),html+'changed');await assert.rejects(inspectWeb(root),/incomplete/);
  await writeFile(join(root,'dist/index.html'),html.replace('production','review'));await assert.rejects(inspectWeb(root),/production_build/);
});

test('failed build cleanup removes its sealed stage without changing a linked retained directory',async t=>{
  const stage=await mkdtemp(join(tmpdir(),'rise-release-build-')),retained=await mkdtemp(join(tmpdir(),'rise-release-retained-'));
  const nested=join(stage,'nested');await mkdir(nested);
  t.after(async()=>{
    await chmod(stage,0o700).catch(()=>{});await chmod(nested,0o700).catch(()=>{});
    await rm(stage,{recursive:true,force:true});await chmod(retained,0o700);await rm(retained,{recursive:true,force:true});
  });
  await writeFile(join(nested,'entry.ts'),'synthetic staged code');await chmod(join(nested,'entry.ts'),0o400);
  await writeFile(join(retained,'entry.ts'),'retained synthetic release');await chmod(join(retained,'entry.ts'),0o400);await chmod(retained,0o500);
  await symlink(retained,join(stage,'linked-retained'));await chmod(nested,0o500);await chmod(stage,0o500);
  await discardBuildStage(stage);
  await assert.rejects(lstat(stage),{code:'ENOENT'});
  assert.equal(await readFile(join(retained,'entry.ts'),'utf8'),'retained synthetic release');
  assert.equal((await lstat(retained)).mode&0o777,0o500);
  await discardBuildStage(stage); // Repeated cleanup of this now-absent stage is harmless.
});

test('build cleanup refuses other directories and root links without changing their contents',async t=>{
  const retained=await mkdtemp(join(tmpdir(),'rise-release-retained-'));
  const stage=await mkdtemp(join(tmpdir(),'rise-release-build-'));
  t.after(async()=>{await rm(stage,{recursive:true,force:true});await rm(retained,{recursive:true,force:true});});
  await writeFile(join(retained,'entry.ts'),'retained synthetic release');
  await assert.rejects(discardBuildStage(retained),/invalid_release_build_stage/);
  const nested=join(retained,'rise-release-build-Abc123');await mkdir(nested);
  await assert.rejects(discardBuildStage(nested),/invalid_release_build_stage/);
  await rm(stage,{recursive:true});await symlink(retained,stage);
  await assert.rejects(discardBuildStage(stage),/invalid_release_build_stage/);
  assert.equal(await readFile(join(retained,'entry.ts'),'utf8'),'retained synthetic release');
  assert.ok((await lstat(nested)).isDirectory());
});
