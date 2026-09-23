import json,re,time,traceback
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
OUT=Path('docs/ux-evidence');WEB='http://localhost:5196';API='http://127.0.0.1:4196';fx=json.loads((OUT/'e2e-0921-fixture.json').read_text());pid=fx['projectId'];sid=fx['suiteId'];root,child,leaf,other,twin=fx['sections'];results={};network=[]
s=requests.Session();s.headers['authorization']='Bearer '+s.post(API+'/api/auth/login',json={'email':'admin@example.com','password':'password'}).json()['token']
def api(m,p,b=None):
 r=s.request(m,API+p,json=b);network.append({'method':m,'path':p,'body':b,'status':r.status_code,'response':r.json() if r.content else None});r.raise_for_status();return r.json() if r.content else None
def capture(page,name):
 page.screenshot(path=str(OUT/('e2e-0921-'+name+'.png')));return {'url':page.url,'body':page.locator('body').inner_text(),'overflow':page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})'),'focus':page.evaluate('({tag:document.activeElement.tagName,id:document.activeElement.id,text:document.activeElement.textContent?.slice(0,70)})')}
def login(page):
 page.goto(WEB+'/login');page.locator('input[type=email]').fill('admin@example.com');page.locator('input[type=password]').fill('password');page.get_by_role('button',name=re.compile('Sign in',re.I)).click();page.wait_for_url('**/projects');page.wait_for_timeout(300)
def go(page,url):page.goto(WEB+url,wait_until='networkidle');page.wait_for_timeout(300)
def save(name):
 OUT.joinpath('e2e-0921-'+name+'.json').write_text(json.dumps({'results':results,'network':network},indent=2,ensure_ascii=False),encoding='utf-8')
