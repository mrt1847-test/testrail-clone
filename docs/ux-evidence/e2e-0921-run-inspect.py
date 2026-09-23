from e2e_0921_common import *
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);page=b.new_page(viewport={'width':1280,'height':720});login(page)
 rid=fx['runs'][0]['run']['id'];tid=fx['runs'][0]['instances'][1]['id']
 go(page,f'/projects/{pid}/runs/{rid}?testId={tid}');results['run']=capture(page,'run-inspect');print(page.locator('body').inner_text());save('run-inspect');b.close()
