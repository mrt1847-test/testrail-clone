"""Confirm UI-065 saved case instructions appear in a Run."""
import json
import re
import time
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright

API = "http://localhost:4000"
WEB = "http://localhost:5173"
OUT = Path("docs/ux-evidence")
VERIFY = json.loads(OUT.joinpath("ui-065-live-verify.json").read_text(encoding="utf-8"))


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
fx = VERIFY["fixture"]
pid = fx["projectId"]
# Find text case in checkout
cases = api("GET", f"/api/projects/{pid}/cases?sectionId={fx['checkoutId']}&page=1&pageSize=50", token)["data"]
text_case = next(c for c in cases if c.get("title") == "UI-065 text title")
steps_case = next((c for c in cases if c.get("title") == "UI-065 steps title"), None)
case_ids = [int(text_case["id"])] + ([int(steps_case["id"])] if steps_case else [])
created = api(
    "POST",
    f"/api/projects/{pid}/runs",
    token,
    {
        "name": "UI-065 instruction check",
        "suiteId": int(fx["suiteId"]),
        "includeAll": False,
        "caseIds": case_ids,
    },
)
run = created["run"]
inst = created["instances"]
text_inst = next(i for i in inst if int(i["caseId"]) == int(text_case["id"]))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(f"{WEB}/login", wait_until="networkidle")
    page.fill('input[type="email"]', "admin@example.com")
    page.fill('input[type="password"]', "password")
    page.get_by_role("button", name=re.compile(r"sign in|log in|login", re.I)).click()
    page.wait_for_url(re.compile(r".*/projects(?:/|\?|$)"), timeout=20000)
    page.goto(
        f"{WEB}/projects/{pid}/runs/{run['id']}?testId={text_inst['id']}",
        wait_until="networkidle",
    )
    page.wait_for_timeout(1200)
    body = page.locator("body").inner_text()
    ok = "Signed-in shopper" in body and ("Order confirms" in body or "Open cart" in body or "Pay" in body)
    page.screenshot(path=str(OUT / "ui-065-after-1280x720-run-instructions.png"), full_page=False)
    browser.close()

VERIFY["checks"]["runInstructions"] = {"ok": ok, "runId": run["id"], "testId": text_inst["id"]}
VERIFY["allOk"] = all(c.get("ok") for c in VERIFY["checks"].values() if isinstance(c, dict) and "ok" in c)
OUT.joinpath("ui-065-live-verify.json").write_text(json.dumps(VERIFY, indent=2), encoding="utf-8")
print(json.dumps({"allOk": VERIFY["allOk"], "runInstructions": ok}, indent=2))
if not VERIFY["allOk"]:
    raise SystemExit(1)
