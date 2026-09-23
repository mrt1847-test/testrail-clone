import re,json
from pathlib import Path
p=Path('docs/E2E_USABILITY_REVIEW_2026-09-21.md');t=p.read_text(encoding='utf-8');missing=[]
for link in re.findall(r'\]\(([^)]+)\)',t):
 if not link.startswith(('http:','https:','#')) and not (p.parent/link).exists():missing.append(link)
print('report bytes',p.stat().st_size,'lines',len(t.splitlines()),'missing links',missing)
for name in ['authoring','remaining','execution','followup','context-next','resume-links','resume-final','final-live']:
 d=json.loads(Path(f'docs/ux-evidence/e2e-0921-{name}.json').read_text(encoding='utf-8'));print(name, 'checks',len(d['results']),'recorded requests',len(d['network']))
assert not missing
# Non-secret evidence assertions supporting the report's concrete claims.
def data(n):return json.loads(Path(f'docs/ux-evidence/e2e-0921-{n}.json').read_text(encoding='utf-8'))['results']
a=data('authoring');assert a['panel-input-after']=='' and a['panel-api']['data']['steps'][0]['content']=='Newly written instructions 0921';assert a['partial-next-values']=={'title':'','steps':''}
c=data('context-next');assert c['context-values']=={'scope':'subtree','search':''};assert c['next-success-values']['title']==''
r=data('remaining');assert [r[k]['data']['total'] for k in ['retry-before','retry-failed-api','retry-after']]==[1,1,2]
e=data('execution');assert e['before-cancel']['data']['total']==e['after-cancel']['data']['total']==2;assert e['normal-save']['url'].endswith('testId=2') and e['explicit-next']['url'].endswith('testId=5');assert e['closed-status-buttons']==0
f=data('final-live');assert len(f['run-before']['data']['instances'])==11 and len(f['run-after']['data']['instances'])==12
q=data('resume-final');assert len(q['dynamic-api']['data']['instances'])==2 and len(q['selected-still-six']['data']['instances'])==6;assert q['attachment-before']['data']['total']==q['attachment-after']['data']['total']==1
print('report evidence assertions PASS')
