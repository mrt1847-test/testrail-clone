from e2e_0921_common import *
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);page=b.new_page(viewport={'width':1280,'height':720});page.set_default_timeout(5000);login(page)
 def response(r):
  if '/api/' in r.url and '/auth/' not in r.url and r.request.method!='GET':
   try: network.append({'method':r.request.method,'url':r.url,'body':r.request.post_data,'status':r.status,'response':r.json()})
   except:pass
 page.on('response',response)
 try:
  go(page,f'/projects/{pid}/cases?suiteId={sid}&sectionId={child}')
  for scope in ['direct','subtree','all']:
   page.get_by_label('Case query scope').select_option(scope);page.wait_for_timeout(500);results['scope-'+scope]=capture(page,'scope-'+scope)
  page.get_by_label('Case query scope').select_option('direct');page.wait_for_timeout(300)
  page.get_by_role('button',name='Add Case',exact=True).last.click();results['quick-open']=capture(page,'quick-open');print('QUICK INPUTS',page.locator('input').evaluate_all('(els)=>els.map(x=>({placeholder:x.placeholder,id:x.id}))'))
  inp=page.get_by_placeholder(re.compile('title',re.I)).last;inp.fill('Keyboard quick case');page.keyboard.press('Enter');page.wait_for_timeout(700);results['quick-enter']=capture(page,'quick-enter')
  go(page,f'/projects/{pid}/cases/new?suiteId={sid}&sectionId={child}')
  page.locator('#case-title').fill('E2E Text authoring');page.locator('#case-preconditions').fill('Shopper with empty cart');page.locator('#case-steps-text').fill('Open catalog\nAdd item');page.locator('#case-expected-result').fill('Cart contains item')
  page.locator('#case-section').select_option(str(twin));results['section-preserve']=capture(page,'section-preserve');results['section-values']={x:page.locator('#case-'+x).input_value() for x in ['title','preconditions','steps-text','expected-result']}
  page.get_by_role('button',name='Add Test Case',exact=True).click();page.wait_for_timeout(1000);results['text-saved']=capture(page,'text-saved')
 except Exception as e:results['first-error']=str(e);print(traceback.format_exc())
 finally:save('cases');b.close()
