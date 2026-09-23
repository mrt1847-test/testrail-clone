from e2e_0921_common import *
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);page=b.new_page(viewport={'width':1280,'height':720});page.set_default_timeout(5000);login(page)
 def task(name,fn):
  try:fn()
  except Exception as e:results[name+'-error']=str(e);print(name,traceback.format_exc())
  save('remaining')
 def observe(r):
  if '/api/' in r.url and '/auth/' not in r.url and r.request.method!='GET':
   try:network.append({'method':r.request.method,'url':r.url,'body':r.request.post_data,'status':r.status,'response':r.json()})
   except:pass
 page.on('response',observe)
 def steps():
  go(page,f'/projects/{pid}/cases/new?suiteId={sid}&sectionId={child}');page.locator('#case-template').select_option(next(str(t['id']) for t in fx['templates'] if t['systemKey']=='test_case_steps'));page.locator('#case-title').fill('Structured UI 0921');page.locator('#case-preconditions').fill('Signed-in tester');page.locator('[id^=case-step-action-]').fill('Open order');page.locator('[id^=case-step-expected-]').fill('Order is shown');page.get_by_role('button',name=re.compile('Add step',re.I)).click();page.locator('[id^=case-step-action-]').last.fill('Verify total');page.locator('[id^=case-step-expected-]').last.fill('Total includes tax');page.locator('#case-section').select_option(str(leaf));results['steps-preserved']=capture(page,'steps-preserved');page.get_by_role('button',name='Add Test Case',exact=True).click();page.wait_for_timeout(800);results['steps-saved']=capture(page,'steps-saved');c=api('GET',f'/api/projects/{pid}/cases?q=Structured%20UI')['data'][0];results['steps-api']=api('GET',f"/api/cases/{c['id']}")
 def template():
  go(page,f'/projects/{pid}/cases/new?suiteId={sid}&sectionId={child}');page.locator('#case-title').fill('Template draft');page.locator('#case-steps-text').fill('Keep important instructions');page.locator('#case-template').select_option(next(str(t['id']) for t in fx['templates'] if t['systemKey']=='test_case_steps'));results['template-warning']=capture(page,'template-warning');print('TEMPLATE',page.get_by_role('dialog').inner_text());page.get_by_role('button',name='Keep editing',exact=True).click();results['template-keep']=capture(page,'template-keep')
 def context():
  go(page,f'/projects/{pid}/cases?suiteId={sid}&sectionId={child}&sectionScope=direct&q=Login');page.get_by_role('button',name=re.compile('More actions')).click();print('MENU',page.get_by_role('menu').inner_text());page.get_by_role('menuitem',name=re.compile('Add Test Case|Full',re.I)).click();page.wait_for_timeout(500);results['context-entry']=capture(page,'context-entry');page.get_by_role('button',name='Cancel',exact=True).click();page.wait_for_timeout(500);results['context-cancel']=capture(page,'context-cancel')
 def retry():
  run=fx['runs'][1];rid=run['run']['id'];tid=run['instances'][1]['id'];go(page,f'/projects/{pid}/runs/{rid}?testId={tid}');before=api('GET',f'/api/tests/{tid}/results');results['retry-before']=before;page.get_by_role('button',name='Add result',exact=True).click();d=page.get_by_role('dialog');d.get_by_label('Status',exact=True).select_option(label='Passed');d.get_by_label('Comment',exact=True).first.fill('Retry properly injected 0921')
  page.route(f'**/api/runs/{rid}/results',lambda route:route.fulfill(status=500,content_type='application/json',body='{"message":"review controlled failure"}'));d.get_by_role('button',name='Add Result',exact=True).click();page.wait_for_timeout(400);results['retry-failed']=capture(page,'retry-real-failure');results['retry-failed-api']=api('GET',f'/api/tests/{tid}/results');page.unroute(f'**/api/runs/{rid}/results');print('RETRY',d.inner_text());d.get_by_role('button',name=re.compile('Retry|Add Result',re.I)).first.click();page.wait_for_timeout(700);results['retry-saved']=capture(page,'retry-saved');results['retry-after']=api('GET',f'/api/tests/{tid}/results')
 def bulk():
  rid=fx['runs'][0]['run']['id'];go(page,f'/projects/{pid}/runs/{rid}');page.get_by_role('checkbox',name='Select all tests on this page',exact=True).check();page.get_by_label('Result status',exact=True).select_option(label='Blocked');page.get_by_role('button',name='Apply result',exact=True).click();page.wait_for_timeout(800);results['bulk-applied']=capture(page,'bulk-applied');results['bulk-requery']=[api('GET',f"/api/tests/{x['id']}/results") for x in fx['runs'][0]['instances']]
 def mobile():
  page.set_viewport_size({'width':390,'height':844});rid=fx['runs'][0]['run']['id'];go(page,f'/projects/{pid}/runs/{rid}');results['mobile-list']=capture(page,'mobile-list');page.get_by_role('button',name=re.compile('Select C')).first.click();page.wait_for_timeout(300);results['mobile-selected']=capture(page,'mobile-selected');page.get_by_role('button',name='Back to tests',exact=True).click();page.wait_for_timeout(400);results['mobile-return']=capture(page,'mobile-return')
 for n,fn in [('steps',steps),('template',template),('context',context),('retry',retry),('bulk',bulk),('mobile',mobile)]:task(n,fn)
 b.close()
