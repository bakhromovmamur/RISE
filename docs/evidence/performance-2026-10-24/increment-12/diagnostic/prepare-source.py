from pathlib import Path
import sys,shutil,json,hashlib
root=Path.cwd(); evidence=Path(__file__).parent
assert len(sys.argv)==2 and sys.argv[1] in ['baseline','counterfactual','implementation']
mode=sys.argv[1]; stage=Path('/tmp/rise-bff-session-wait-probe/source')
# Refuse to overwrite a prior diagnostic source tree or use an unmatched build.
for name,expected in json.loads((evidence.parent/'source-hashes.json').read_text()).items():
    assert hashlib.sha256((root/name).read_bytes()).hexdigest()==expected,name
stage.mkdir()
for folder in ['src','server']:shutil.copytree(root/folder,stage/folder)
shutil.copy2(root/'package.json',stage/'package.json');(stage/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
(stage/'tsconfig.json').write_text(json.dumps({'extends':str(root/'tsconfig.server.json'),'include':['server/**/*.ts'],'exclude':[]},indent=2)+'\n')
if mode!='implementation':shutil.copy2(evidence/'before-sessions.ts',stage/'server/auth/sessions.ts')
shutil.copy2(evidence/('counterfactual-diagnostics.ts'if mode=='counterfactual'else'diagnostics.ts'),stage/'server/diagnostics.ts')
def once(text,before,after):
    assert text.count(before)==1,before
    return text.replace(before,after)
p=stage/'server/auth/sessions.ts';s=p.read_text();s='import { phase, instrumentClient } from "../diagnostics.ts";\n'+s
s=once(s,'const client = await this.pool.connect();','const client = instrumentClient(await phase("pool.acquire", () => this.pool.connect()));')
s=once(s,'''    try { await client.query("begin"); const result = await run(client); await client.query("commit"); return result; }
    catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }''','''    return phase("pool.held",async()=>{
      try { await client.query("begin"); const result = await run(client); await client.query("commit"); return result; }
      catch (error) { await client.query("rollback"); throw error; }
      finally { client.release(); }
    });''')
method='readCurrent'if mode=='implementation'else'read'
s=once(s,f'const current = await this.{method}(input);',f'const current = await phase("auth.read", () => this.{method}(input));');p.write_text(s)
p=stage/'server/personal/repository.ts';s='import { phase, syncPhase } from "../diagnostics.ts";\n'+p.read_text()
s=s.replace('await readRecords(client, actor)','await phase("personal.readRecords", () => readRecords(client, actor))')
s=s.replace('state = hydrate(records)','state = syncPhase("personal.hydrate", () => hydrate(records))').replace('state = hydrate(before)','state = syncPhase("personal.hydrate", () => hydrate(before))')
s=once(s,'else next = applyDomainCommand(state, command, context,{sharedPriorities:await authorizePriorityReferences(client,state,command)});','else { const sharedPriorities = await phase("personal.priorities", () => authorizePriorityReferences(client,state,command)); next = syncPhase("personal.domain", () => applyDomainCommand(state, command, context, {sharedPriorities})); }')
s=once(s,'validateState(next);','syncPhase("personal.validate", () => validateState(next));')
s=once(s,'await writeRecords(client, actor, nextRevision, before, project(next, started),operation.operationId);','const desired = syncPhase("personal.project", () => project(next, started));\n  await phase("personal.writeRecords", () => writeRecords(client, actor, nextRevision, before, desired,operation.operationId));')
s=s.replace('await cancelForCommand(client,actor,operation.command)','await phase("personal.cancel", () => cancelForCommand(client,actor,operation.command))').replace('await total(client, actor)','await phase("personal.total", () => total(client, actor))');p.write_text(s)
p=stage/'server/app.ts';s='import { beginRequest, endRequest } from "./diagnostics.ts";\n'+p.read_text();needle='  app.addHook("onRequest", async (request, reply) => {'
s=once(s,needle,'  app.addHook("onRequest", (request, _reply, done) => beginRequest(request, done));\n  app.addHook("onResponse", async (request, reply) => endRequest(request, reply.statusCode));\n'+needle);p.write_text(s)
print('Prepared isolated',mode,'source; use the archived driver/adapter at the recorded /tmp path.')
