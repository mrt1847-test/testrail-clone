from e2e_0921_common import *
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);page=b.new_page(viewport={'width':1280,'height':720});page.set_default_timeout(5000);login(page)
 try:
  go(page,f'/projects/{pid}/my-tests');results['assigned-link']=page.locator('a').filter(has_text='Open test').evaluate_all('(es)=>es.map(x=>({text:x.innerText,aria:x.getAttribute("aria-label"),href:x.getAttribute("href")}))');page.locator('a').filter(has_text='Open test').click();page.wait_for_timeout(400);results['assigned-open']=capture(page,'assigned-open');page.reload(wait_until='networkidle');results['assigned-refresh']=capture(page,'assigned-refresh')
  setup=json.loads((OUT/'e2e-0921-resume.json').read_text(encoding='utf-8'))['results']['setup'];plid=setup['plan']['id'];go(page,f'/projects/{pid}/plans/{plid}');page.locator('a').filter(has_text='Open run').click();page.wait_for_timeout(400);results['plan-open']=capture(page,'plan-open');results['plan-run-api']=api('GET','/api/runs/'+page.url.split('/runs/')[1].split('?')[0]);results['runs-overview-api']=api('GET',f'/api/projects/{pid}/runs-overview');go(page,f'/projects/{pid}/runs');page.locator('a').filter(has_text='Run B Firefox').first.click();page.wait_for_timeout(400);results['list-open']=capture(page,'list-open');go(page,f'/projects/{pid}');page.locator('a').filter(has_text='Run A Chrome').first.click();page.wait_for_timeout(400);results['overview-open']=capture(page,'overview-open')
 except Exception as e:results['error']=str(e);print(traceback.format_exc())
 finally:save('resume-links');b.close()
