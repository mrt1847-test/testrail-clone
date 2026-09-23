from e2e_0921_common import *
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);page=b.new_page(viewport={'width':1280,'height':720});page.set_default_timeout(4500);login(page)
 rid=fx['runs'][0]['run']['id'];tid=fx['runs'][0]['instances'][1]['id'];ridb=fx['runs'][1]['run']['id'];tidb=fx['runs'][1]['instances'][1]['id']
 def observe(r):
  if '/api/' in r.url and '/auth/' not in r.url and r.request.method!='GET':
   try:network.append({'method':r.request.method,'url':r.url,'body':r.request.post_data,'status':r.status,'response':r.json()})
   except:pass
 page.on('response',observe)
 def task(name,fn):
  try:fn()
  except Exception as e:results[name+'-error']=str(e);print(name,traceback.format_exc())
  save('execution')
 def normal():
  go(page,f'/projects/{pid}/runs/{rid}?testId={tid}');page.get_by_role('button',name='Add result',exact=True).click();results['panel-dialog']=capture(page,'result-dialog-panel');print('DIALOG',page.get_by_role('dialog').inner_text());print('INPUTS',page.get_by_role('dialog').locator('input,textarea,select').evaluate_all('(els)=>els.map(x=>({tag:x.tagName,id:x.id,aria:x.getAttribute("aria-label")}))'))
  page.keyboard.press('Tab');results['tab']=page.evaluate('document.activeElement.outerHTML');page.keyboard.press('Shift+Tab');results['shift-tab']=page.evaluate('document.activeElement.outerHTML')
  page.get_by_role('dialog').get_by_label('Status',exact=True).select_option(label='Failed');page.get_by_role('dialog').get_by_label('Comment',exact=True).first.fill('Observed account dashboard missing in Chrome; review fixture')
  page.get_by_role('dialog').get_by_role('button',name='Add Result',exact=True).click();page.wait_for_timeout(700);results['normal-save']=capture(page,'normal-save');results['normal-api']=api('GET',f'/api/tests/{tid}/results');results['run-b-before']=api('GET',f'/api/tests/{tidb}/results')
 task('normal',normal)
 def status():
  go(page,f'/projects/{pid}/runs/{rid}?testId={tid}');btn=page.get_by_role('button',name=re.compile('Status for C2'))
  btn.click();page.get_by_role('menuitemcheckbox',name='Blocked',exact=True).click();results['status-dialog']=capture(page,'result-dialog-status');results['before-cancel']=api('GET',f'/api/tests/{tid}/results');page.keyboard.press('Escape');page.wait_for_timeout(200)
  if page.get_by_role('button',name='Discard draft',exact=True).count():page.get_by_role('button',name='Discard draft',exact=True).click()
  page.wait_for_timeout(500);results['escape-focus']=capture(page,'result-escape-focus');results['after-cancel']=api('GET',f'/api/tests/{tid}/results')
 task('status',status)
 def retry():
  go(page,f'/projects/{pid}/runs/{ridb}?testId={tidb}');page.get_by_role('button',name='Add result',exact=True).click();dialog=page.get_by_role('dialog');dialog.get_by_label('Status',exact=True).select_option(label='Passed');dialog.get_by_label('Comment',exact=True).first.fill('Firefox succeeds, retry draft')
  page.route(f'**/api/tests/{tidb}/results',lambda route:route.fulfill(status=500,content_type='application/json',body='{"message":"review result failure"}') if route.request.method=='POST' else route.continue_());dialog.get_by_role('button',name='Add Result',exact=True).click();page.wait_for_timeout(400);results['failed-result']=capture(page,'result-failure');results['failed-result-api']=api('GET',f'/api/tests/{tidb}/results');page.unroute(f'**/api/tests/{tidb}/results');dialog.get_by_role('button',name='Add Result',exact=True).click();page.wait_for_timeout(700);results['retry-api']=api('GET',f'/api/tests/{tidb}/results');results['retry-ui']=capture(page,'result-retry');results['run-a-after']=api('GET',f'/api/tests/{tid}/results')
 task('retry',retry)
 def next_and_bulk():
  go(page,f'/projects/{pid}/runs/{rid}?testId={tid}');page.get_by_role('button',name='Pass & Next',exact=True).last.click();page.wait_for_timeout(700);results['explicit-next']=capture(page,'explicit-next')
  page.get_by_role('checkbox',name='Select all tests on this page',exact=True).check();results['bulk-select']=capture(page,'bulk-select');print('BULK',page.locator('body').inner_text()[-2400:])
 task('next-bulk',next_and_bulk)
 def viewports():
  for w,h in [(1440,1000),(1280,720),(390,844)]:
   page.set_viewport_size({'width':w,'height':h});go(page,f'/projects/{pid}/runs/{rid}?testId={fx["runs"][0]["instances"][-1]["id"]}');results[f'run-{w}']=capture(page,f'run-{w}');page.get_by_role('button',name='Add result',exact=True).click();results[f'dialog-{w}']=capture(page,f'dialog-{w}');page.keyboard.press('Escape')
  go(page,f'/projects/{pid}/runs/{fx["runs"][2]["run"]["id"]}');results['closed']=capture(page,'closed-run');results['closed-status-buttons']=page.get_by_role('button',name=re.compile('Status for C')).count()
 task('viewports',viewports);b.close()

