import {buildRelease,verifyRelease} from './release/package.ts';
import {selectRelease,rollbackRelease,serveReleases} from './release/runtime.ts';
async function main(){
  const [action,environment,id,flag,...extra]=process.argv.slice(2);
  if(extra.length)throw new Error('invalid_release_arguments');
  if(action==='build'&&!environment){const release=await buildRelease();process.stdout.write(JSON.stringify({release:release.id,webRelease:release.webRelease})+'\n');return;}
  if(!['local','test'].includes(environment))throw new Error('local_release_only');
  const target=environment as 'local'|'test';
  if(action==='select'&&id&&(!flag||flag==='paused')){const selected=await selectRelease(target,id,flag!=='paused');process.stdout.write(JSON.stringify({prepared:selected.id,request:selected.request})+'\n');}
  else if(action==='verify'&&id&&!flag){await verifyRelease(id);process.stdout.write('Release integrity verified.\n');}
  else if(action==='rollback'&&!id){await rollbackRelease(target);process.stdout.write('Compatible rollback prepared.\n');}
  else if(action==='serve'&&!id)await serveReleases(target);
  else throw new Error('invalid_release_arguments');
}
main().catch(error=>{
  process.stderr.write(error instanceof Error&&error.message==='release_build_cleanup_failed'
    ?'Local release build failed and temporary build cleanup is incomplete; review local disk space and permissions before retrying. Saved data and retained releases were not removed.\n'
    :'Local release operation failed; verify the package and protected configuration. Check deployment records if activation began. Data and schema were not downgraded.\n');
  process.exitCode=1;
});
