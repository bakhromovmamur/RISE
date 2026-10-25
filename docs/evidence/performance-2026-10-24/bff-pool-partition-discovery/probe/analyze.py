from pathlib import Path
import json,math,statistics,collections
p=Path('/tmp/rise-bff-two-thread-probe');d=json.loads((p/'mixed.json').read_text());s=json.loads((p/'stats.json').read_text())
rows=[dict(r,worker=i) for i,w in enumerate(s['workers']) for r in w['metrics']['completed']]
assert not any(w['metrics']['dropped'] for w in s['workers'])
assert len(rows)==len(s['timing'])
gateway={x['id']:x for x in s['timing']}
assert len(gateway)==len(rows)
def summary(vals):
 vals=sorted(vals)
 return {'count':len(vals),'sum':sum(vals),'p50':statistics.median(vals),'p95':vals[math.ceil(len(vals)*.95)-1],'max':max(vals)} if vals else {'count':0}
allPersonal=sorted([r for r in rows if r['family']=='personalCommand'],key=lambda r:r['id'])
firstCount=d['mixed']['personal']['accepted']+d['mixed']['personal']['failed']
measuredPersonal=allPersonal[:firstCount]
personal=[r for r in measuredPersonal if 'personal.domain' in r['phases']]
recoveryPersonal=[r for r in allPersonal[firstCount:] if 'personal.domain' in r['phases']]
start=min(r['started'] for r in measuredPersonal);end=start+d['mixed']['measuredMs']
window=[r for r in rows if start<=r['started']<end]
sharedCount=d['mixed']['shared']['accepted']+d['mixed']['shared']['failed']
measuredShared=sorted([r for r in rows if r['family']=='sharedCommand' and r['id']>=measuredPersonal[0]['id']],key=lambda r:r['id'])[:sharedCount]
output={'scope':'Instrumented least-pending HTTP run; Mutation attempts mapped by gateway order and actual first-attempt counts; fresh spans exclude recovery/replay; other-family window starts at first fresh worker request and uses measured duration, so boundary attribution is approximate','gate':{k:d['mixed'][k] for k in ['personal','shared','convergence','passed']},'resources':{},'freshPersonal':{},'families':{}}
for name,group in [('freshPersonal',personal),('allMeasuredPersonal',measuredPersonal),('recoveryPersonal',recoveryPersonal),*[(f,measuredShared if f=='sharedCommand' else [r for r in window if r['family']==f]) for f in sorted(set(r['family'] for r in window))]]:
 data={'requestMs':summary([r['ms'] for r in group]),'gatewayMs':summary([gateway[r['id']]['ms'] for r in group]),'workerStartLagMs':summary([r['started']-gateway[r['id']]['started'] for r in group]),'phases':{}}
 for phase in sorted(set(k for r in group for k in r['phases'])):
  data['phases'][phase]={'wallMs':summary([r['phases'].get(phase,{}).get('ms',0) for r in group]),'cpuMs':summary([r['phases'].get(phase,{}).get('cpuMs',0) for r in group])}
 data['leafQueryMs']=summary([sum(v['ms'] for k,v in r['phases'].items() if k.startswith('db.')) for r in group])
 data['slowest']=[{'id':r['id'],'worker':r['worker'],'ms':r['ms'],'phases':r['phases']} for r in sorted(group,key=lambda r:r['ms'],reverse=True)[:3]]
 if name=='freshPersonal':output[name]=data
 else:output['families'][name]=data
for i,w in enumerate(s['workers']):
 samples=[x for x in w['metrics']['resources'] if start<=x['at']<end]
 output['resources'][str(i)]={'intervals':len(samples),'threadCpuPercent':summary([100*x['threadCpuMs']/x['intervalMs'] for x in samples]),'eventLoopUtilization':summary([x['eventLoop']['utilization'] for x in samples]),'heapUsed':summary([x['heapUsed'] for x in samples]),'gcTotalMs':samples[-1]['gc']['totalMs']-samples[0]['gc']['totalMs'] if samples else 0}
resources=json.loads((p/'resources.json').read_text());output['hostAndDatabase']={'samples':len(resources),'failed':sum('error' in r for r in resources),'activeVacuumSamples':sum(any(x['count'] for x in r.get('vacuum',[])) for r in resources),'load1':summary([r['loadAverage'][0] for r in resources if 'loadAverage'in r]),'freeBytes':summary([r['freeBytes'] for r in resources if 'freeBytes'in r])}
(p/'analysis.json').write_text(json.dumps(output,indent=2)+'\n')
print('Gate',output['gate'])
for name in ['freshPersonal','groupsRead','sharedCommand']:
 x=output['freshPersonal'] if name=='freshPersonal' else output['families'].get(name,{})
 print(name,'request',x.get('requestMs'),'worker start lag',x.get('workerStartLagMs'))
 for phase,m in x.get('phases',{}).items():print(' ',phase, 'mean',round(m['wallMs']['sum']/m['wallMs']['count'],1),'p95',round(m['wallMs']['p95'],1))
print('Worker resources',output['resources']);print('Host/DB',output['hostAndDatabase'])
