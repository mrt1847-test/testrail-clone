import json,re,time
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
OUT=Path('docs/ux-evidence'); API='http://localhost:4196'; WEB='http://localhost:5196'
log=[]; token=None
def api(m,p,b=None):
 r=requests.request(m,API+p,json=b,headers={'authorization':f'Bearer {token}'},timeout=20)
 if 'auth/login' not in p: log.append({'method':m,'path':p,'body':b,'status':r.status_code,'response':r.json() if r.content else None})
 r.raise_for_status(); return r.json() if r.content else None
token=api('POST','/api/auth/login',{'email':'admin@example.com','password':'password'})['token']
project=api('POST','/api/projects',{'name':'E2E Review 0921 isolated'})['data']; pid=project['id']
sid=api('GET',f'/api/projects/{pid}/suites')['data'][0]['id']
def sec(name,parent=None):
 b={'name':name}
 if parent: b['parentId']=parent
 return api('POST',f'/api/suites/{sid}/sections',b)['data']['id']
root=sec('Commerce'); child=sec('Login',root); leaf=sec('Recovery',child); other=sec('Account'); twin=sec('Login',other)
templates=api('GET',f'/api/projects/{pid}/settings/templates')['data']; print('templates',templates)
textid=next(t['id'] for t in templates if t.get('systemKey')=='test_case_text')
stepsid=next(t['id'] for t in templates if t.get('systemKey')=='test_case_steps')
cases=[]
for section,title,pre,exp in [(root,'Root overview','Store is available','Catalog shown'),(child,'Login with valid shopper','Use shopper@example.test, empty cart','Account dashboard appears'),(leaf,'Recovery security check','Use locked account, no session','Generic confirmation; no account disclosure'),(twin,'Login from Account branch','Use support account, 2FA enabled','2FA challenge shown'),(child,'Title only outline','',''),(child,'Ten-step checkout — '+('long descriptive title ' * 8),'Cart has 2 distinct items','Order total and receipt match')]:
 c=api('POST',f'/api/sections/{section}/cases',{'title':title,'preconditions':pre,'expectedResult':exp,'caseTemplateId':stepsid if title.startswith('Ten') else textid})['data']; cases.append(c)
 if pre:
  for n in range(10 if title.startswith('Ten') else 1): api('POST',f"/api/cases/{c['id']}/steps",{'content':f'Action {n+1}: '+title[:35],'expected':f'Expected {n+1}: '+exp})
runs=[]
for name in ['Run A Chrome','Run B Firefox','Completed baseline']:
 runs.append(api('POST',f'/api/projects/{pid}/runs',{'name':name,'suiteId':int(sid),'includeAll':False,'caseIds':[c['id'] for c in cases]}))
api('POST',f"/api/runs/{runs[2]['run']['id']}/close",{})
fx={'projectId':pid,'suiteId':sid,'sections':[root,child,leaf,other,twin],'cases':cases,'runs':runs,'templates':templates}
OUT.joinpath('e2e-0921-fixture.json').write_text(json.dumps(fx,indent=2))
OUT.joinpath('e2e-0921-seed-requests.json').write_text(json.dumps(log,indent=2))
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True); page=browser.new_page(viewport={'width':1280,'height':720})
 page.goto(WEB+'/login'); page.locator('input[type=email]').fill('admin@example.com');page.locator('input[type=password]').fill('password');page.get_by_role('button',name=re.compile('Sign in',re.I)).click();page.wait_for_timeout(1500)
 page.goto(f'{WEB}/projects/{pid}/cases?suiteId={sid}&sectionId={child}',wait_until='networkidle');page.screenshot(path=str(OUT/'e2e-0921-cases-1280.png'));print(page.locator('body').inner_text());browser.close()
