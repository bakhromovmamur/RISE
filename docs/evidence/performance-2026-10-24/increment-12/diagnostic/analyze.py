from pathlib import Path
import json,statistics,math
root=Path(__file__).parent

def summary(values):
    values=sorted(values)
    return {'count':len(values),'median':statistics.median(values),'mean':statistics.mean(values),'p95':values[math.ceil(.95*len(values))-1],'max':max(values)}

result={}
for mode in ['baseline','counterfactual','implementation']:
    folder=root/mode
    report=json.loads((folder/'report.json').read_text())
    capture=json.loads((folder/'stats.json').read_text())
    assert report['cleaned'] and not report.get('error') and not report['cleanupErrors']
    assert report['historyAndXpRestored'] and report['exactReplay']
    assert len(capture['workers'])==1 and capture['workers'][0]['requests']==228
    assert not capture['workers'][0]['metrics']['dropped']
    records=sorted(capture['workers'][0]['metrics']['completed'],key=lambda x:x['id'])
    assert len(records)==len(capture['timing'])==228
    assert {x['id'] for x in records}=={x['id']for x in capture['timing']}==set(range(1,229))
    assert all(t['mutation']['status']==200 and not t['recovered'] and all(x['status']==200 for x in t['reads']) for t in report['trials'])
    item={'captureId':capture['captureId'],'requests':228,'correctness':'PASS','scenarios':{}}
    for scenario in ['same-and-other','other-only']:
        trials=[t for t in report['trials'] if t['scenario']==scenario]
        reads=[x for t in trials for x in t['reads']]
        phases=[]
        for trial in trials:
            batch=[x for x in records if trial['index']*14+1<=x['id']<=trial['index']*14+13]
            assert len(batch)==13 and sum(x['family']=='personalCommand' for x in batch)==1
            metadata=[x for x in batch if x['family']=='groupsRead'];assert len(metadata)==12
            phases.extend(metadata)
        item['scenarios'][scenario]={'mutationMs':summary([t['mutation']['ms']for t in trials]),'readsMs':summary([x['ms']for x in reads]),'otherOwnerReadsMs':summary([x['ms']for x in reads if x['user']==1]),'phases':{name:summary([x['phases'].get(name,{}).get('ms',0)for x in phases])for name in ['pool.acquire','pool.held','db.sessionLock']}}
        if mode=='counterfactual':item['scenarios'][scenario]['requestAdmissionMs']=summary([x['phases'].get('request.sessionAdmission',{}).get('ms',0)for x in phases])
    result[mode]=item
    print(mode, {scenario:{'mutationMedian':round(x['mutationMs']['median'],1),'otherReadMedian':round(x['otherOwnerReadsMs']['median'],1),'otherReadP95':round(x['otherOwnerReadsMs']['p95'],1),'meanPoolAcquire':round(x['phases']['pool.acquire']['mean'],1),'meanSessionLock':round(x['phases']['db.sessionLock']['mean'],1)}for scenario,x in item['scenarios'].items()})
assert len({x['captureId']for x in result.values()})==3
(root/'comparison.json').write_text(json.dumps(result,indent=2)+'\n')
