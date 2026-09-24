"""UI-072 live verify: restore list search/filter/scope after add/cancel."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

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
        raise RuntimeError(f"{method} {path} {r.status_code} {r.text[:500]}")
    return r.json() if r.text else None


def login(page):
    page.goto(f"{WEB}/login", wait_until="networkidle")
    page.fill('input[type="email"]', "admin@example.com")
    page.fill('input[type="password"]', "password")
    page.get_by_role("button", name=re.compile(r"sign in|log in|login", re.I)).click()
    page.wait_for_url(re.compile(r".*/projects(?:/|\?|$)"), timeout=20000)
    page.wait_for_timeout(400)


def seed(token):
    stamp = int(time.time())
    project = api("POST", "/api/projects", token, {"name": f"UI-072 Return {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
    api(
        "POST",
        f"/api/sections/{sec['id']}/cases",
        token,
        {"title": "Existing login case", "priority": "high"},
    )
    return {
        "projectId": pid,
        "suiteId": suite_id,
        "sectionId": int(sec["id"]),
        "listUrl": (
            f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={sec['id']}"
            f"&q=login&priority=high&scope=subtree&groupBy=priority&display=compact"
        ),
    }


def qs(url: str) -> dict:
    return {k: v[0] if len(v) == 1 else v for k, v in parse_qs(urlparse(url).query).items()}


def main():
    token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
    fx = seed(token)
    report = {"fixture": fx, "checks": {}}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        login(page)

        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(800)
        before = qs(page.url)
        report["checks"]["listBefore"] = before

        # --- Cancel restores context ---
        page.get_by_role("link", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_url(re.compile(r".*/cases/new"), timeout=15000)
        page.wait_for_timeout(500)
        add_qs = qs(page.url)
        report["checks"]["addHasReturn"] = "return" in add_qs
        return_raw = unquote(add_qs.get("return", ""))
        report["checks"]["returnPayload"] = return_raw
        page.screenshot(path=str(OUT / "ui-072-after-1280x720-add-with-return.png"), full_page=False)

        page.get_by_role("button", name=re.compile(r"^Back to cases$", re.I)).click()
        # may show discard if dirty — form may be clean
        page.wait_for_timeout(400)
        if page.get_by_role("dialog").count():
            page.get_by_role("button", name=re.compile(r"discard|leave", re.I)).click()
            page.wait_for_timeout(400)
        page.wait_for_url(re.compile(r".*/cases(?:\?|$)"), timeout=15000)
        cancel_qs = qs(page.url)
        report["checks"]["cancelRestored"] = {
            "q": cancel_qs.get("q") == "login",
            "priority": cancel_qs.get("priority") == "high",
            "scope": cancel_qs.get("scope") == "subtree",
            "groupBy": cancel_qs.get("groupBy") == "priority",
            "display": cancel_qs.get("display") == "compact",
            "suiteId": cancel_qs.get("suiteId") == str(fx["suiteId"]),
            "sectionId": cancel_qs.get("sectionId") == str(fx["sectionId"]),
            "url": page.url,
        }
        page.screenshot(path=str(OUT / "ui-072-after-1280x720-cancel-restored.png"), full_page=False)

        # --- Save with matching filters keeps context + panel ---
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(500)
        page.get_by_role("link", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_url(re.compile(r".*/cases/new"), timeout=15000)
        page.locator("#case-title").wait_for(state="visible")
        page.locator("#case-title").fill("Another login path")
        if page.locator("#case-priority").count():
            page.locator("#case-priority").select_option(label="High")
        page.get_by_role("button", name=re.compile(r"^Add Test Case$|^Save$|^Add$", re.I)).last.click()
        page.wait_for_url(re.compile(r".*/cases(?:\?|$)"), timeout=20000)
        page.wait_for_timeout(600)
        save_qs = qs(page.url)
        report["checks"]["saveRestored"] = {
            "q": save_qs.get("q") == "login",
            "priority": save_qs.get("priority") == "high",
            "panelCaseId": save_qs.get("panelCaseId") is not None,
            "focusCaseId": save_qs.get("focusCaseId") is not None,
            "noSavedNotice": save_qs.get("savedNotice") is None,
            "url": page.url,
        }
        page.screenshot(path=str(OUT / "ui-072-after-1280x720-save-restored.png"), full_page=False)

        # --- Save outside filter keeps filters + notice link ---
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(500)
        page.get_by_role("link", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_url(re.compile(r".*/cases/new"), timeout=15000)
        page.locator("#case-title").wait_for(state="visible")
        page.locator("#case-title").fill("Checkout total mismatch")
        if page.locator("#case-priority").count():
            page.locator("#case-priority").select_option(label="Low")
        page.get_by_role("button", name=re.compile(r"^Add Test Case$|^Save$|^Add$", re.I)).last.click()
        page.wait_for_url(re.compile(r".*/cases(?:\?|$)"), timeout=20000)
        page.wait_for_timeout(700)
        outside_qs = qs(page.url)
        notice = page.locator("[data-case-saved-outside-filter]")
        report["checks"]["outsideFilter"] = {
            "qKept": outside_qs.get("q") == "login",
            "priorityKept": outside_qs.get("priority") == "high",
            "savedNotice": outside_qs.get("savedNotice") == "1",
            "savedCaseId": outside_qs.get("savedCaseId") is not None,
            "bannerVisible": notice.count() > 0,
            "openLink": notice.get_by_role("link", name=re.compile(r"Open saved case", re.I)).count() > 0
            if notice.count()
            else False,
            "url": page.url,
        }
        page.screenshot(path=str(OUT / "ui-072-after-1280x720-outside-filter.png"), full_page=False)

        # Browser back from add form
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(400)
        page.get_by_role("link", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_url(re.compile(r".*/cases/new"), timeout=15000)
        page.go_back()
        page.wait_for_timeout(600)
        back_qs = qs(page.url)
        report["checks"]["browserBack"] = {
            "q": back_qs.get("q") == "login",
            "priority": back_qs.get("priority") == "high",
            "url": page.url,
        }

        # 390
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(500)
        page.get_by_role("link", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_url(re.compile(r".*/cases/new"), timeout=15000)
        page.screenshot(path=str(OUT / "ui-072-after-390x844-add.png"), full_page=False)
        page.get_by_role("button", name=re.compile(r"^Back to cases$", re.I)).click()
        page.wait_for_timeout(400)
        if page.get_by_role("dialog").count():
            page.get_by_role("button", name=re.compile(r"discard|leave", re.I)).click()
            page.wait_for_timeout(400)
        page.wait_for_url(re.compile(r".*/cases(?:\?|$)"), timeout=15000)
        mobile_qs = qs(page.url)
        report["checks"]["mobile390"] = {
            "q": mobile_qs.get("q") == "login",
            "priority": mobile_qs.get("priority") == "high",
            "overflowX": page.evaluate(
                "() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"
            ),
        }
        page.screenshot(path=str(OUT / "ui-072-after-390x844-restored.png"), full_page=False)

        browser.close()

    report["allOk"] = (
        report["checks"]["addHasReturn"]
        and all(report["checks"]["cancelRestored"].values())
        if isinstance(report["checks"]["cancelRestored"], dict)
        else False
    )
    # fix allOk properly
    cr = report["checks"]["cancelRestored"]
    sr = report["checks"]["saveRestored"]
    of = report["checks"]["outsideFilter"]
    bb = report["checks"]["browserBack"]
    m = report["checks"]["mobile390"]
    report["allOk"] = (
        report["checks"]["addHasReturn"]
        and all(v is True for k, v in cr.items() if k != "url")
        and all(v is True for k, v in sr.items() if k != "url")
        and all(v is True for k, v in of.items() if k != "url")
        and all(bb.values())
        and m["q"]
        and m["priority"]
        and not m["overflowX"]
    )
    OUT.joinpath("ui-072-live-verify.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if not report["allOk"]:
        raise SystemExit("UI-072 live verify failed")


if __name__ == "__main__":
    main()
