// Isolated acceptance entry only. Production release packages do not contain this file.
import {buildRelease} from './release/package.ts';
import {selectRelease,serveReleases,deploymentDirectory} from './release/runtime.ts';
import {writePrivateJson} from '../../server/operations/files.ts';
import {join} from 'node:path';
import {failedRelease} from '../../tests/support/failedRelease.ts';
const a=await buildRelease(),b=await buildRelease();
const failed=await failedRelease(b);
await writePrivateJson(join(deploymentDirectory('test'),'test-releases.json'),{a:a.id,b:b.id,failed,webA:a.webRelease,webB:b.webRelease});
await selectRelease('test',a.id);
await serveReleases('test');
