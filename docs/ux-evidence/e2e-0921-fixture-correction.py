import json,requests
from pathlib import Path
O=Path('docs/ux-evidence');f=json.loads((O/'e2e-0921-fixture.json').read_text());s=requests.Session();base='http://127.0.0.1:4196';s.headers['authorization']='Bearer '+s.post(base+'/api/auth/login',json={'email':'admin@example.com','password':'password'}).json()['token']; log=[]
def api(m,p,b=None):
 r=s.request(m,base+p,json=b);log.append({'method':m,'path':p,'body':b,'status':r.status_code,'response':r.json() if r.content else None});r.raise_for_status();return r.json() if r.content else None
root,child,leaf,other,twin=f['sections']
for a,b in [(child,root),(leaf,child),(twin,other)]:api('PATCH',f'/api/sections/{a}',{'parentSectionId':b})
for c in f['cases']:
 d=api('GET',f"/api/cases/{c['id']}")['data']
 for st in d.get('steps',[]):api('PATCH',f"/api/case-steps/{st['id']}",{'expectedResult':c['expectedResult']})
O.joinpath('e2e-0921-fixture-correction.json').write_text(json.dumps(log,indent=2));print('fixture parentSectionId corrected; expectedResult corrected')

