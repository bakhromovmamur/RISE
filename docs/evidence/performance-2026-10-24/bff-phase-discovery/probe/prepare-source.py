from pathlib import Path
import shutil,json,hashlib,difflib
root=Path.cwd(); out=Path('/tmp/rise-bff-phase-probe');stage=out/'source';stage.mkdir()
for folder in ['src','server']:shutil.copytree(root/folder,stage/folder)
shutil.copy2(root/'package.json',stage/'package.json');(stage/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
changes={}
def edit(path,transform):
 p=stage/path;before=p.read_text();after=transform(before);assert before!=after;changes[path]=''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='original/'+path,tofile='instrumented/'+path));p.write_text(after)
def once(s,a,b):
 assert s.count(a)==1,(a,s.count(a));return s.replace(a,b)
def sessions(s):
 s='import { phase, instrumentClient } from "../diagnostics.ts";\n'+s
 s=once(s,'const client = await this.pool.connect();','const client = instrumentClient(await phase("pool.acquire", () => this.pool.connect()));')
 s=once(s,'const current = await this.read(input);','const current = await phase("auth.read", () => this.read(input));')
 return s
edit('server/auth/sessions.ts',sessions)
def personal(s):
 s='import { phase, syncPhase } from "../diagnostics.ts";\n'+s
 s=s.replace('await readRecords(client, actor)','await phase("personal.readRecords", () => readRecords(client, actor))')
 s=s.replace('state = hydrate(records)','state = syncPhase("personal.hydrate", () => hydrate(records))').replace('state = hydrate(before)','state = syncPhase("personal.hydrate", () => hydrate(before))')
 s=once(s,'else next = applyDomainCommand(state, command, context,{sharedPriorities:await authorizePriorityReferences(client,state,command)});','else { const sharedPriorities = await phase("personal.priorities", () => authorizePriorityReferences(client,state,command)); next = syncPhase("personal.domain", () => applyDomainCommand(state, command, context, {sharedPriorities})); }')
 s=once(s,'validateState(next);','syncPhase("personal.validate", () => validateState(next));')
 s=once(s,'await writeRecords(client, actor, nextRevision, before, project(next, started),operation.operationId);','const desired = syncPhase("personal.project", () => project(next, started));\n  await phase("personal.writeRecords", () => writeRecords(client, actor, nextRevision, before, desired,operation.operationId));')
 s=s.replace('await cancelForCommand(client,actor,operation.command)','await phase("personal.cancel", () => cancelForCommand(client,actor,operation.command))')
 s=s.replace('await total(client, actor)','await phase("personal.total", () => total(client, actor))')
 return s
edit('server/personal/repository.ts',personal)
def app(s):
 s='import { beginRequest, endRequest } from "./diagnostics.ts";\n'+s
 a='  app.addHook("onRequest", async (request, reply) => {'
 return once(s,a,'  app.addHook("onRequest", (request, _reply, done) => beginRequest(request, done));\n  app.addHook("onResponse", async (request, reply) => endRequest(request, reply.statusCode));\n'+a)
edit('server/app.ts',app)
(out/'instrumentation.patch').write_text(''.join(changes.values()))
shutil.copy2(Path(__file__).with_name('diagnostics.ts'),stage/'server/diagnostics.ts')
shutil.copy2(Path(__file__).with_name('source-tsconfig.json'),stage/'tsconfig.json')
h={str(p.relative_to(stage)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['server','src'] for p in sorted((stage/folder).rglob('*')) if p.is_file()}
(out/'copied-source-hashes.json').write_text(json.dumps(h,indent=2)+'\n')
print("Prepared isolated instrumented source; gateway/driver are supplied alongside this script")
