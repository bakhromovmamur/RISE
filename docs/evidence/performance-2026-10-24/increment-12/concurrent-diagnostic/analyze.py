from pathlib import Path
import json,statistics,math
base=Path(__file__).parent
result={}
def stats(values):
 return {'count':len(values),'medianMs':statistics.median(values),'p95Ms':sorted(values)[math.ceil(len(values)*.95)-1],'maxMs':max(values)}
for mode in ['baseline','implementation']:
 folder=base/mode
 if not folder.exists():continue
 report=json.loads((folder/'report.json').read_text()); capture=json.loads((folder/'stats.json').read_text())
 assert report.get('error') is None and report['exactReplay'] and report['historyAndXpRestored'] and report['cleaned'] and not report['cleanupErrors']
 gateway=capture['timing']; workers=capture['workers']; requests=[r for w in workers for r in w['metrics']['completed']]
 assert len(requests)==len(gateway)==170+sum(t['recoveries'] for t in report['trials'])
 assert set(r['id'] for r in requests)==set(r['id'] for r in gateway)==set(range(1,len(requests)+1))
 assert all(w['metrics']['dropped']==0 and w['requests']==len(w['metrics']['completed']) for w in workers)
 mutations=[r for t in report['trials'] for r in t['mutations']];reads=[r for t in report['trials'] for r in t['reads']]
 assert len(mutations)==40 and len(reads)==80
 measured=[r for r in requests if r['family']=='personalCommand' and 'personal.domain' in r['phases']]
 result[mode]={'captureId':capture['captureId'],'captured':len(requests),'mutationsAccepted':sum(r['status']==200 for r in mutations),'readsAccepted':sum(r['status']==200 for r in reads),'recoveries':sum(t['recoveries'] for t in report['trials']),'mutation':stats([r['ms'] for r in mutations]),'metadata':stats([r['ms'] for r in reads]),'commandPhases':{name:stats([r['phases'][name]['ms'] for r in measured]) for name in ['pool.acquire','pool.held','personal.readRecords','personal.hydrate','personal.domain','personal.validate','personal.project','personal.writeRecords','personal.total']},'correctnessAndCleanup':'PASS'}
(base/'comparison.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
