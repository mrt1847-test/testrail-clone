"""Debug why UI-066 discard dialog is missing."""
import re
import time
import json
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright

API = "http://localhost:4000"
WEB = "http://localhost:5173"

def api(method, path, token, body=None):
    r = requests.request(method, API + path, headers={"authorization": f"Bearer {token}", "content-type": "application/json"}, json=body, timeout=60)
    if r.status_code >= 400:
        raise RuntimeError(f"{method} {path} {r.status_code} {r.text[:300]}")
    return r.json() if r.text else None

token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
stamp = int(time.time())
project = api("POST", "/api/projects", token, {"name": f"UI-066 dbg {stamp}"})["data"]
pid = project["id"]
suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
c1 = api("POST", f"/api/sections/{sec['id']}/cases", token, {"title": "Alpha case", "priority": "high"})["data"]
url = f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={sec['id']}&panelCaseId={c1['id']}&panelMode=edit"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(f"{WEB}/login", wait_until="networkidle")
    page.fill('input[type="email"]', "admin@example.com")
    page.fill('input[type="password"]', "password")
    page.get_by_role("button", name=re.compile(r"sign in|log in|login", re.I)).click()
    page.wait_for_url(re.compile(r".*/projects(?:/|\?|$)"), timeout=20000)
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(1500)
    page.locator("#case-title").click()
    page.locator("#case-title").press("Control+A")
    page.keyboard.type("Edited title for dirty", delay=20)
    page.wait_for_timeout(1000)
    info = page.evaluate(
        """() => ({
          url: location.href,
          title: document.querySelector('#case-title')?.value,
          dialogs: [...document.querySelectorAll('[role=dialog]')].map(el => el.innerText.slice(0,200)),
          closeButtons: [...document.querySelectorAll('button')].filter(b => /^Close$/i.test(b.textContent||'')).map(b => b.outerHTML.slice(0,120)),
          hasProviderHint: !!document.body.innerText.includes('Discard')
        })"""
    )
    page.get_by_role("complementary", name=re.compile(r"Edit test case", re.I)).get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
    page.wait_for_timeout(800)
    after = page.evaluate(
        """() => ({
          url: location.href,
          dialogs: [...document.querySelectorAll('[role=dialog]')].map(el => el.innerText.slice(0,300)),
          bodyHasDiscard: document.body.innerText.includes('Discard'),
          fixedOverlay: !!document.querySelector('.fixed.inset-0'),
          ui066Dirty: window.__ui066Dirty ?? null,
          ui066Leave: window.__ui066Leave ?? null
        })"""
    )
    Path("docs/ux-evidence/ui-066-debug.json").write_text(json.dumps({"beforeClose": info, "afterClose": after}, indent=2), encoding="utf-8")
    page.screenshot(path="docs/ux-evidence/ui-066-debug.png")
    browser.close()
print("wrote debug")
