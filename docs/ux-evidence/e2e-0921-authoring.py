from e2e_0921_common import *
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);page=b.new_page(viewport={'width':1280,'height':720});page.set_default_timeout(4500);login(page)
 def observe(r):
  if '/api/' in r.url and '/auth/' not in r.url and r.request.method!='GET':
   try:network.append({'method':r.request.method,'url':r.url,'body':r.request.post_data,'status':r.status,'response':r.json()})
   except:pass
 page.on('response',observe)
 def task(name,fn):
  try: fn()
  except Exception as e:results[name+'-error']=str(e);print(name,traceback.format_exc())
  save('authoring')
 def panel():
  cid=fx['cases'][4]['id'];go(page,f'/projects/{pid}/cases?suiteId={sid}&sectionId={child}&panelCaseId={cid}')
  page.get_by_role('button',name='Edit',exact=True).click();page.locator('#case-title').fill('Draft changed title');page.get_by_role('button',name='Close',exact=True).click();results['panel-close']=capture(page,'panel-close-guard')
  page.get_by_role('button',name='Keep editing',exact=True).click();results['keep-title']=page.locator('#case-title').input_value()
  page.locator('#case-title').fill('Title only outline');page.locator('#case-steps-text').fill('Newly written instructions 0921');page.get_by_role('button',name='Save',exact=True).click();page.wait_for_timeout(900);results['panel-save']=capture(page,'panel-save-stale');results['panel-api']=api('GET',f'/api/cases/{cid}');results['panel-input-after']=page.locator('#case-steps-text').input_value() if page.locator('#case-steps-text').count() else None
  page.reload(wait_until='networkidle');page.wait_for_timeout(500);results['panel-reload']=capture(page,'panel-reload')
 task('panel',panel)
 def failed_create():
  go(page,f'/projects/{pid}/cases/new?suiteId={sid}&sectionId={child}');page.locator('#case-title').fill('Partial create 0921');page.locator('#case-steps-text').fill('Important lost draft');page.locator('#case-preconditions').fill('Precondition preserved on server')
  page.route(re.compile(r'/api/cases/\d+/steps$'),lambda route:route.fulfill(status=500,content_type='application/json',body='{"message":"review injected steps failure"}') if route.request.method=='POST' else route.continue_())
  page.get_by_role('button',name='Add Test Case',exact=True).click();page.wait_for_timeout(800);results['partial-normal']=capture(page,'partial-normal');results['partial-cases']=api('GET',f'/api/projects/{pid}/cases?q=Partial%20create')
  page.unroute(re.compile(r'/api/cases/\d+/steps$'))
 task('partial',failed_create)
 def next_failure():
  go(page,f'/projects/{pid}/cases/new?suiteId={sid}&sectionId={child}');page.locator('#case-title').fill('Partial next 0921');page.locator('#case-steps-text').fill('Next draft must survive')
  page.route(re.compile(r'/api/cases/\d+/steps$'),lambda route:route.fulfill(status=500,content_type='application/json',body='{"message":"review injected steps failure"}') if route.request.method=='POST' else route.continue_())
  page.get_by_role('button',name=re.compile(r'Add.*Next')).click();page.wait_for_timeout(800);results['partial-next']=capture(page,'partial-next');results['partial-next-values']={'title':page.locator('#case-title').input_value(),'steps':page.locator('#case-steps-text').input_value()};page.unroute(re.compile(r'/api/cases/\d+/steps$'))
 task('next-failure',next_failure)
 def steps():
  go(page,f'/projects/{pid}/cases/new?suiteId={sid}&sectionId={child}');page.locator('#case-template').select_option(next(str(t['id']) for t in fx['templates'] if t['systemKey']=='test_case_steps'));page.locator('#case-title').fill('UI structured steps 0921');print('steps textareas',page.locator('textarea').evaluate_all('(els)=>els.map(x=>({id:x.id,placeholder:x.placeholder}))'));results['steps-form']=capture(page,'steps-form')
 task('steps',steps)
 b.close()
