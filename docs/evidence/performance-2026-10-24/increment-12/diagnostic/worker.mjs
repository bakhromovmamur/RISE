import {parentPort,workerData} from 'node:worker_threads';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const original=workerData.root,root='/tmp/rise-bff-session-wait-probe/source',require=createRequire(`${root}/package.json`);
const {register}=await import(pathToFileURL(require.resolve('tsx/esm/api')));register();
const [{loadConfig},{database},{createApp},{Sessions}]=await Promise.all(['config','database','app','auth/sessions'].map(p=>import(pathToFileURL(`${root}/server/${p}.ts`))));
const config=loadConfig(parseEnv(await readFile(`${original}/.rise-infra/test/server.env`,'utf8')));
if(config.environment!=='test'||config.database.max!==5||config.host!=='127.0.0.1'||config.port!==4191||typeof workerData.socket!=='string'||!workerData.socket.startsWith('/private/tmp/rise-balanced-')&&!workerData.socket.startsWith('/tmp/rise-balanced-'))throw new Error('fixed_test_required');
config.database.max=5;
const {diagnosticSnapshot}=await import(pathToFileURL(`${root}/server/diagnostics.ts`));
const store=database(config);let app,stopping=false;
async function stop(){if(stopping)return;stopping=true;try{if(app)await app.close();await store.close();}catch{process.exitCode=1;}parentPort.postMessage({metrics:diagnosticSnapshot()});parentPort.close();}
parentPort.on('message',m=>{if(m.stop)void stop();});
try{await store.verify();app=await createApp(config,store.verify,()=>{},new Sessions(config,store.pool));await app.listen({path:workerData.socket});parentPort.postMessage({ready:true});}
catch{process.exitCode=1;await stop();}
