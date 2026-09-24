"""Capture UI-066 before: panel Close discards without confirm."""
import json
import re
import time
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright

API = "http://localhost:4000"
WEB = "http://localhost:5173"
OUT = Path("docs/ux-evidence")


def api(method, path, token, body=None):
    r = requests.request(
        method,
        API + path,
        headers={"authorization": f"Bearer {token}", "content-type": "application/json"},
        json=body,
        timeout=60,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"{method} {path} {r.status_code} {r.text[:400]}")
    return r.json() if r.text else None


token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
stamp = int(time.time())
project = api("POST", "/api/projects", token, {"name": f"UI-066 Before {stamp}"})["data"]
pid = project["id"]
suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
c1 = api("POST", f"/api/sections/{sec['id']}/cases", token, {"title": "Alpha case", "priority": "high"})["data"]
list_url = f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={sec['id']}&panelCaseId={c1['id']}&panelMode=edit"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(f"{WEB}/login", wait_until="networkidle")
    page.fill('input[type="email"]', "admin@example.com")
    page.fill('input[type="password"]', "password")
    page.get_by_role("button", name=re.compile(r"sign in|log in|login", re.I)).click()
    page.wait_for_url(re.compile(r".*/projects(?:/|\?|$)"), timeout=20000)
    page.goto(list_url, wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.locator("#case-title").fill("Should be discarded silently")
    page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / "ui-066-before-1280x720-panel-dirty.png"), full_page=False)
    page.get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
    page.wait_for_timeout(500)
    dialog = page.get_by_role("dialog").filter(has_text=re.compile(r"Discard", re.I)).count()
    page.screenshot(path=str(OUT / "ui-066-before-1280x720-panel-closed-no-dialog.png"), full_page=False)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(list_url, wait_until="networkidle")
    page.wait_for_timeout(800)
    page.locator("#case-title").fill("Mobile silent discard")
    page.get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / "ui-066-before-390x844-panel-closed-no-dialog.png"), full_page=False)
    browser.close()

out = {"dialogCountAfterClose": dialog, "closedWithoutConfirm": dialog == 0}
OUT.joinpath("ui-066-before-repro.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
print(json.dumps(out, indent=2))
if dialog != 0:
    raise SystemExit("Expected no discard dialog before fix")
