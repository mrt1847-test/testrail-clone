import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('docs/ux-evidence');WEB='http://localhost:5196'; fx=json.loads((OUT/'e2e-0921-fixture.json').read_text());pid=fx['projectId'];sid=fx['suiteId'];child=fx['sections'][1]
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True);page=browser.new_page(viewport={'width':1280,'height':720})
 page.goto(WEB+'/login');page.locator('input[type=email]').fill('admin@example.com');page.locator('input[type=password]').fill('password');page.get_by_role('button',name=re.compile('Sign in',re.I)).click();page.wait_for_timeout(1200)
 page.goto(f'{WEB}/projects/{pid}/cases?suiteId={sid}&sectionId={child}',wait_until='networkidle');page.screenshot(path=str(OUT/'e2e-0921-cases-1280.png'));print(page.locator('body').inner_text());browser.close()
