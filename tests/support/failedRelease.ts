import {cp,mkdtemp,readFile,writeFile,chmod,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {digest,inventory,releases,releaseDirectory,type ReleaseManifest} from '../../scripts/infra/release/package.ts';
/** Synthetic sealed candidate: probe succeeds, actual listener startup fails. Never included in release builds. */
export async function failedRelease(source:ReleaseManifest){
  const directory=await mkdtemp(join(releases,'.synthetic-failure-'));
  await cp(releaseDirectory(source.id),directory,{recursive:true,verbatimSymlinks:true});await chmod(directory,0o700);
  const entry=join(directory,'scripts/infra/release/entry.ts');await chmod(entry,0o600);
  await writeFile(entry,(await readFile(entry,'utf8')).replace('const config=loadConfig(input.env);',"if(!input.probe)throw new Error('synthetic_start_failure');\n  const config=loadConfig(input.env);"));await chmod(entry,0o400);
  const {id:previousId,...body}=source;void previousId;
  body.files=await inventory(directory);
  const id=digest(JSON.stringify(body)),manifest={id,...body};
  const file=join(directory,'release.json');await chmod(file,0o600);await writeFile(file,JSON.stringify(manifest)+'\n');await chmod(file,0o400);
  await rename(directory,releaseDirectory(id));await chmod(releaseDirectory(id),0o500);return id;
}
