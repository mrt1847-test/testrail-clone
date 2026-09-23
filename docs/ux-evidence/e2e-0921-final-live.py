from e2e_0921_common import *
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);page=b.new_page(viewport={'width':1280,'height':720});page.set_default_timeout(5000);login(page)
 def observe(r):
  if '/api/' in r.url and '/auth/' not in r.url:
   try:
    if r.request.method!='GET' or any(x in r.url for x in ['overview','plans/','/runs/']):network.append({'method':r.request.method,'url':r.url,'body':r.request.post_data,'status':r.status,'response':r.json()})
   except:pass
 page.on('response',observe)
 def task(name,fn):
  try:fn()
  except Exception as e:results[name+'-error']=str(e);print(name,traceback.format_exc())
  save('final-live')
 def create():
  go(page,f'/projects/{pid}/runs/new?suiteId={sid}');page.locator('#run-create-name').fill('UI All membership 0921');results['composition']=capture(page,'composition-all');page.get_by_role('button',name='Create run',exact=True).click();page.wait_for_timeout(700);results['created']=capture(page,'created-all');results['run-before']=api('GET','/api/runs/'+page.url.split('/runs/')[1].split('?')[0]);api('POST',f'/api/sections/{leaf}/cases',{'title':'Added after All run'});page.reload(wait_until='networkidle');page.wait_for_timeout(500);results['all-reopen']=capture(page,'all-reopen');results['run-after']=api('GET','/api/runs/'+page.url.split('/runs/')[1].split('?')[0])
 def attachment():
  rid=fx['runs'][1]['run']['id'];tid=fx['runs'][1]['instances'][0]['id'];go(page,f'/projects/{pid}/runs/{rid}?testId={tid}');page.get_by_role('button',name='Add result',exact=True).click();d=page.get_by_role('dialog');d.get_by_label('Status',exact=True).select_option(label='Failed');d.get_by_label('Comment',exact=True).first.fill('Result with attachment recovery');d.locator('input[type=file]').set_input_files({'name':'review-evidence.txt','mimeType':'text/plain','buffer':b'E2E review bytes 0921'});d.get_by_role('button',name='Add Result',exact=True).click();page.wait_for_timeout(700);results['attachment-partial']=capture(page,'attachment-partial');results['attachment-results']=api('GET',f'/api/tests/{tid}/results');print('ATTACH',d.inner_text());page.keyboard.press('Escape');page.wait_for_timeout(300);results['attachment-leave-dialog']=capture(page,'attachment-leave-dialog');print('LEAVE',page.locator('body').inner_text()[-700:])
 def resumes():
  go(page,f'/projects/{pid}/my-tests');page.get_by_role('link',name='Open test',exact=True).click();page.wait_for_timeout(500);results['my-tests-open']=capture(page,'my-tests-open');page.reload(wait_until='networkidle');results['my-tests-refresh']=capture(page,'my-tests-refresh')
  data=json.loads((OUT/'e2e-0921-resume.json').read_text(encoding='utf-8'))['results']['setup'];plid=data['plan']['id'];go(page,f'/projects/{pid}/plans/{plid}');page.get_by_role('link',name=re.compile('Open run')).click();page.wait_for_timeout(500);results['plan-open']=capture(page,'plan-open');results['plan-run-api']=api('GET','/api/runs/'+page.url.split('/runs/')[1].split('?')[0]);go(page,f'/projects/{pid}/runs');page.get_by_role('link',name=re.compile('Run B Firefox')).first.click();page.wait_for_timeout(400);results['list-open']=capture(page,'list-open')
 for name,fn in [('create',create),('attachment',attachment),('resumes',resumes)]:task(name,fn)
 b.close()
